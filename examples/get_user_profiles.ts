import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { config } from 'dotenv';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config();

const slackToken = process.env.EXMAPLES_SLACK_BOT_TOKEN;
const userToken = process.env.EXMAPLES_SLACK_USER_TOKEN;
const userIdsEnv = process.env.EXAMPLES_USER_IDS;

if (!slackToken) {
  throw new Error('EXMAPLES_SLACK_BOT_TOKEN environment variable is required');
}

if (!userToken) {
  throw new Error('EXMAPLES_SLACK_USER_TOKEN environment variable is required');
}

if (!userIdsEnv) {
  throw new Error('EXAMPLES_USER_IDS environment variable is required');
}

const env = {
  SLACK_BOT_TOKEN: slackToken,
  SLACK_USER_TOKEN: userToken,
} as const satisfies Record<string, string>;

async function main() {
  const client = new Client(
    {
      name: 'slack-get-user-profiles-example-client',
      version: '1.0.0',
    },
    {
      capabilities: {},
    }
  );

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
    await client.connect(transport);
    console.log('Connected to MCP server');

    const ids = userIdsEnv
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    const response = (await client.callTool(
      {
        name: 'slack_get_user_profiles',
        arguments: {
          user_ids: ids,
        },
      },
      CallToolResultSchema
    )) as CallToolResult;

    if (
      Array.isArray(response.content) &&
      response.content.length > 0 &&
      response.content[0]?.type === 'text'
    ) {
      const slackResponse = JSON.parse(response.content[0].text);

      console.log('Profiles retrieved successfully!');
      console.dir(slackResponse, { depth: null });
    } else {
      console.error('Unexpected response format');
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await transport.close();
  }
}

main();
