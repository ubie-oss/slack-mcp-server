#!/usr/bin/env node

import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { WebClient } from '@slack/web-api';
import dotenv from 'dotenv';
import express from 'express';
import {
  ListChannelsRequestSchema,
  PostMessageRequestSchema,
  ReplyToThreadRequestSchema,
  AddReactionRequestSchema,
  GetChannelHistoryRequestSchema,
  GetThreadRepliesRequestSchema,
  GetUsersRequestSchema,
  GetUserProfileRequestSchema,
  GetUserProfilesRequestSchema,
  ListChannelsResponseSchema,
  GetUsersResponseSchema,
  GetUserProfileResponseSchema,
  GetUserProfilesResponseSchema,
  SearchMessagesRequestSchema,
  SearchMessagesResponseSchema,
  ConversationsHistoryResponseSchema,
  ConversationsRepliesResponseSchema,
} from './schemas.js';

dotenv.config();

if (!process.env.SLACK_BOT_TOKEN) {
  console.error(
    'SLACK_BOT_TOKEN is not set. Please set it in your environment or .env file.'
  );
  process.exit(1);
}

if (!process.env.SLACK_USER_TOKEN) {
  console.error(
    'SLACK_USER_TOKEN is not set. Please set it in your environment or .env file.'
  );
  process.exit(1);
}

const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);
const userClient = new WebClient(process.env.SLACK_USER_TOKEN);

const server = new Server(
  {
    name: 'slack-mcp-server',
    version: '0.0.1',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'slack_list_channels',
        description: 'List public channels in the workspace with pagination',
        inputSchema: zodToJsonSchema(ListChannelsRequestSchema),
      },
      {
        name: 'slack_post_message',
        description: 'Post a new message to a Slack channel',
        inputSchema: zodToJsonSchema(PostMessageRequestSchema),
      },
      {
        name: 'slack_reply_to_thread',
        description: 'Reply to a specific message thread in Slack',
        inputSchema: zodToJsonSchema(ReplyToThreadRequestSchema),
      },
      {
        name: 'slack_add_reaction',
        description: 'Add a reaction emoji to a message',
        inputSchema: zodToJsonSchema(AddReactionRequestSchema),
      },
      {
        name: 'slack_get_channel_history',
        description: 'Get recent messages from a channel',
        inputSchema: zodToJsonSchema(GetChannelHistoryRequestSchema),
      },
      {
        name: 'slack_get_thread_replies',
        description: 'Get all replies in a message thread',
        inputSchema: zodToJsonSchema(GetThreadRepliesRequestSchema),
      },
      {
        name: 'slack_get_users',
        description:
          'Retrieve basic profile information of all users in the workspace',
        inputSchema: zodToJsonSchema(GetUsersRequestSchema),
      },
      {
        name: 'slack_get_user_profile',
        description: "Get a user's profile information",
        inputSchema: zodToJsonSchema(GetUserProfileRequestSchema),
      },
      {
        name: 'slack_get_user_profiles',
        description: "Get multiple users' profile information in batch",
        inputSchema: zodToJsonSchema(GetUserProfilesRequestSchema),
      },
      {
        name: 'slack_search_messages',
        description: 'Search for messages in the workspace',
        inputSchema: zodToJsonSchema(SearchMessagesRequestSchema),
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    if (!request.params) {
      throw new Error('Params are required');
    }
    switch (request.params.name) {
      case 'slack_list_channels': {
        const args = ListChannelsRequestSchema.parse(request.params.arguments);
        const response = await slackClient.conversations.list({
          limit: args.limit,
          cursor: args.cursor,
          types: 'public_channel', // Only public channels
        });
        if (!response.ok) {
          throw new Error(`Failed to list channels: ${response.error}`);
        }
        const parsed = ListChannelsResponseSchema.parse(response);

        return {
          content: [{ type: 'text', text: JSON.stringify(parsed) }],
        };
      }

      case 'slack_post_message': {
        const args = PostMessageRequestSchema.parse(request.params.arguments);
        const response = await slackClient.chat.postMessage({
          channel: args.channel_id,
          text: args.text,
        });
        if (!response.ok) {
          throw new Error(`Failed to post message: ${response.error}`);
        }
        return {
          content: [{ type: 'text', text: 'Message posted successfully' }],
        };
      }

      case 'slack_reply_to_thread': {
        const args = ReplyToThreadRequestSchema.parse(request.params.arguments);
        const response = await slackClient.chat.postMessage({
          channel: args.channel_id,
          thread_ts: args.thread_ts,
          text: args.text,
        });
        if (!response.ok) {
          throw new Error(`Failed to reply to thread: ${response.error}`);
        }
        return {
          content: [
            { type: 'text', text: 'Reply sent to thread successfully' },
          ],
        };
      }
      case 'slack_add_reaction': {
        const args = AddReactionRequestSchema.parse(request.params.arguments);
        const response = await slackClient.reactions.add({
          channel: args.channel_id,
          timestamp: args.timestamp,
          name: args.reaction,
        });
        if (!response.ok) {
          throw new Error(`Failed to add reaction: ${response.error}`);
        }
        return {
          content: [{ type: 'text', text: 'Reaction added successfully' }],
        };
      }

      case 'slack_get_channel_history': {
        const args = GetChannelHistoryRequestSchema.parse(
          request.params.arguments
        );
        const response = await slackClient.conversations.history({
          channel: args.channel_id,
          limit: args.limit,
          cursor: args.cursor,
        });
        if (!response.ok) {
          throw new Error(`Failed to get channel history: ${response.error}`);
        }
        const parsedResponse =
          ConversationsHistoryResponseSchema.parse(response);
        return {
          content: [{ type: 'text', text: JSON.stringify(parsedResponse) }],
        };
      }

      case 'slack_get_thread_replies': {
        const args = GetThreadRepliesRequestSchema.parse(
          request.params.arguments
        );
        const response = await slackClient.conversations.replies({
          channel: args.channel_id,
          ts: args.thread_ts,
          limit: args.limit,
          cursor: args.cursor,
        });
        if (!response.ok) {
          throw new Error(`Failed to get thread replies: ${response.error}`);
        }
        const parsedResponse =
          ConversationsRepliesResponseSchema.parse(response);
        return {
          content: [{ type: 'text', text: JSON.stringify(parsedResponse) }],
        };
      }

      case 'slack_get_users': {
        const args = GetUsersRequestSchema.parse(request.params.arguments);
        const response = await slackClient.users.list({
          limit: args.limit,
          cursor: args.cursor,
        });
        if (!response.ok) {
          throw new Error(`Failed to get users: ${response.error}`);
        }
        const parsed = GetUsersResponseSchema.parse(response);

        return {
          content: [{ type: 'text', text: JSON.stringify(parsed) }],
        };
      }

      case 'slack_get_user_profile': {
        const args = GetUserProfileRequestSchema.parse(
          request.params.arguments
        );
        const response = await slackClient.users.profile.get({
          user: args.user_id,
        });
        if (!response.ok) {
          throw new Error(`Failed to get user profile: ${response.error}`);
        }
        const parsed = GetUserProfileResponseSchema.parse(response);
        return {
          content: [{ type: 'text', text: JSON.stringify(parsed) }],
        };
      }

      case 'slack_get_user_profiles': {
        const args = GetUserProfilesRequestSchema.parse(
          request.params.arguments
        );

        // Fetch multiple user profiles in parallel
        const profilePromises = args.user_ids.map(async (userId) => {
          try {
            const response = await slackClient.users.profile.get({
              user: userId,
            });
            if (!response.ok) {
              return {
                user_id: userId,
                profile: null,
                error: response.error || 'Failed to get profile',
              };
            }
            return {
              user_id: userId,
              profile: response.profile,
            };
          } catch (error) {
            return {
              user_id: userId,
              profile: null,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        });

        const profiles = await Promise.all(profilePromises);
        const result = GetUserProfilesResponseSchema.parse({
          ok: true,
          profiles,
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(result) }],
        };
      }

      case 'slack_search_messages': {
        const parsedParams = SearchMessagesRequestSchema.parse(
          request.params.arguments
        );

        let query = parsedParams.query;
        if (parsedParams.in_channel) {
          query += ` in:${parsedParams.in_channel}`;
        }
        if (parsedParams.in_group) {
          query += ` in:${parsedParams.in_group}`;
        }
        if (parsedParams.in_dm) {
          query += ` in:<@${parsedParams.in_dm}>`;
        }
        if (parsedParams.from_user) {
          query += ` from:<@${parsedParams.from_user}>`;
        }
        if (parsedParams.from_bot) {
          query += ` from:${parsedParams.from_bot}`;
        }

        const response = await userClient.search.messages({
          query: query,
          highlight: parsedParams.highlight,
          sort: parsedParams.sort,
          sort_dir: parsedParams.sort_dir,
          count: parsedParams.count,
          page: parsedParams.page,
        });

        if (!response.ok) {
          throw new Error(`Failed to search messages: ${response.error}`);
        }

        const parsed = SearchMessagesResponseSchema.parse(response);
        return {
          content: [{ type: 'text', text: JSON.stringify(parsed) }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${request.params.name}`);
    }
  } catch (error) {
    console.error('Error handling request:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    throw new Error(errorMessage);
  }
});

async function runHttpServer(port: number) {
  console.error(
    `Starting Slack MCP Server with HTTP transport on port ${port}`
  );

  const app = express();
  app.use(express.json());

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => Math.random().toString(36).substring(2, 15),
  });
  await server.connect(transport);

  // POST /mcp - Handle all MCP requests
  app.post('/mcp', async (req, res) => {
    try {
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('Error handling MCP request:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
          },
          id: null,
        });
      }
    }
  });

  app.listen(port, () => {
    console.error(`Slack MCP Server listening on http://localhost:${port}`);
  });
}

async function runServer() {
  const args = process.argv.slice(2);
  let port: number | undefined;

  // Parse --port option
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && i + 1 < args.length) {
      port = parseInt(args[i + 1], 10);
      if (isNaN(port)) {
        console.error('Invalid port number');
        process.exit(1);
      }
    }
  }

  // Use Streamable HTTP transport if port is specified
  if (port !== undefined) {
    await runHttpServer(port);
  } else {
    // Default is Stdio transport
    console.error('Starting Slack MCP Server with stdio transport');
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Slack MCP Server running on stdio');
  }
}

runServer().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
