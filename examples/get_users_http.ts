import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { config } from 'dotenv';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

// Load environment variables from .env file
config();

// Get and validate necessary environment variables
const slackToken = process.env.EXMAPLES_SLACK_BOT_TOKEN;
const userToken = process.env.EXMAPLES_SLACK_USER_TOKEN;

if (!slackToken) {
  throw new Error('EXMAPLES_SLACK_BOT_TOKEN environment variable is required');
}

if (!userToken) {
  throw new Error('EXMAPLES_SLACK_USER_TOKEN environment variable is required');
}

async function main() {
  // Parse command line arguments for server URL
  const args = process.argv.slice(2);
  const serverUrl = args[0] || 'http://localhost:3000/mcp';

  console.log(`Connecting to MCP server at: ${serverUrl}`);

  // Initialize MCP client
  const client = new Client(
    {
      name: 'slack-get-users-http-example-client',
      version: '1.0.0',
    },
    {
      capabilities: {},
    }
  );

  // Create Streamable HTTP transport for connecting to the server
  const transport = new StreamableHTTPClientTransport(new URL(serverUrl));

  try {
    // Connect to the server
    await client.connect(transport);
    console.log('Connected to MCP server via HTTP');

    // List available tools
    const toolsResponse = await client.listTools();
    console.log(
      'Available tools:',
      toolsResponse.tools.map((t) => t.name).join(', ')
    );

    // Call slack_get_users
    console.log('\nCalling slack_get_users...');
    const response = (await client.callTool(
      {
        name: 'slack_get_users',
        arguments: {
          limit: 100,
        },
      },
      CallToolResultSchema
    )) as CallToolResult;

    if (
      Array.isArray(response.content) &&
      response.content.length > 0 &&
      response.content[0]?.type === 'text'
    ) {
      // Parse the response and display user information
      const slackResponse = JSON.parse(response.content[0].text);

      console.log('Slack users retrieved successfully!');
      console.log('Total users:', slackResponse.members?.length || 0);

      // Display basic information for each user
      if (slackResponse.members && slackResponse.members.length > 0) {
        console.log('\nUser information:');
        slackResponse.members.forEach(
          (user: { id: string; name: string; real_name?: string }) => {
            console.log(
              `- ${user.name} (${user.real_name || 'N/A'}) [ID: ${user.id}]`
            );
          }
        );

        // Display pagination information if available
        if (slackResponse.response_metadata?.next_cursor) {
          console.log(
            `\nMore users available. Next cursor: ${slackResponse.response_metadata.next_cursor}`
          );
        }
      }
    } else {
      console.error('Unexpected response format');
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    // Close the connection
    await transport.close();
    console.log('Connection closed');
  }
}

main();
