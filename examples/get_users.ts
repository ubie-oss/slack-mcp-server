import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { config } from 'dotenv';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

// Get the directory of the current file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file
config();

// Get and validate necessary environment variables
const slackToken = process.env.SLACK_BOT_TOKEN;
const userToken = process.env.SLACK_USER_TOKEN;

if (!slackToken) {
  throw new Error('SLACK_BOT_TOKEN environment variable is required');
}

if (!userToken) {
  throw new Error('SLACK_USER_TOKEN environment variable is required');
}

// After validation, can be safely treated as a string
const env = {
  SLACK_BOT_TOKEN: slackToken,
  SLACK_USER_TOKEN: userToken,
} as const satisfies Record<string, string>;

async function main() {
  // Initialize MCP client
  const client = new Client(
    {
      name: 'slack-get-users-example-client',
      version: '1.0.0',
    },
    {
      capabilities: {},
    }
  );

  // Create transport for connecting to the server
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [
      '--import',
      resolve(__dirname, '../ts-node-loader.js'),
      resolve(__dirname, '../src/index.ts'),
    ],
    env,
  });

  try {
    // Connect to the server
    await client.connect(transport);
    console.log('Connected to MCP server');

    // List available tools
    const toolsResponse = await client.listTools();
    console.log('Available tools:', toolsResponse.tools);

    // Call slack_get_users
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
  }
}

main();
