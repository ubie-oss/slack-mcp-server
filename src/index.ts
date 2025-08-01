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
import { randomUUID } from 'node:crypto';
import {
  ListChannelsRequestSchema,
  PostMessageRequestSchema,
  ReplyToThreadRequestSchema,
  AddReactionRequestSchema,
  GetChannelHistoryRequestSchema,
  GetThreadRepliesRequestSchema,
  GetUsersRequestSchema,
  GetUserProfilesRequestSchema,
  ListChannelsResponseSchema,
  GetUsersResponseSchema,
  GetUserProfilesResponseSchema,
  UserProfileResponseSchema,
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

const userClient = new WebClient(process.env.SLACK_USER_TOKEN);

// Parse command line arguments
function parseArguments() {
  const args = process.argv.slice(2);
  let port: number | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-port' && i + 1 < args.length) {
      const portValue = parseInt(args[i + 1], 10);
      if (isNaN(portValue) || portValue <= 0 || portValue > 65535) {
        console.error(`Invalid port number: ${args[i + 1]}`);
        process.exit(1);
      }
      port = portValue;
      i++; // Skip the next argument since it's the port value
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Usage: slack-mcp-server [options]

Options:
  -port <number>    Start the server with Streamable HTTP transport on the specified port
  -h, --help        Show this help message

Examples:
  slack-mcp-server                  # Start with stdio transport (default)
  slack-mcp-server -port 3000       # Start with Streamable HTTP transport on port 3000
`);
      process.exit(0);
    } else if (args[i].startsWith('-')) {
      console.error(`Unknown option: ${args[i]}`);
      console.error('Use --help for usage information');
      process.exit(1);
    }
  }

  return { port };
}

function createServer(): Server {
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
          description:
            'Get messages from a channel in chronological order. Use this when: 1) You need the latest conversation flow without specific filters, 2) You want ALL messages including bot/automation messages, 3) You need to browse messages sequentially with pagination. Do NOT use if you have specific search criteria (user, keywords, dates) - use slack_search_messages instead.',
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
          name: 'slack_get_user_profiles',
          description: 'Get multiple users profile information in bulk',
          inputSchema: zodToJsonSchema(GetUserProfilesRequestSchema),
        },
        {
          name: 'slack_search_messages',
          description:
            'Search for messages with specific criteria/filters. Use this when: 1) You need to find messages from a specific user, 2) You need messages from a specific date range, 3) You need to search by keywords, 4) You want to filter by channel. This tool is optimized for targeted searches. For general channel browsing without filters, use slack_get_channel_history instead.',
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
          const args = ListChannelsRequestSchema.parse(
            request.params.arguments
          );
          const response = await userClient.conversations.list({
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
          const response = await userClient.chat.postMessage({
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
          const args = ReplyToThreadRequestSchema.parse(
            request.params.arguments
          );
          const response = await userClient.chat.postMessage({
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
          const response = await userClient.reactions.add({
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
          const response = await userClient.conversations.history({
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
          const response = await userClient.conversations.replies({
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
          const response = await userClient.users.list({
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

        case 'slack_get_user_profiles': {
          const args = GetUserProfilesRequestSchema.parse(
            request.params.arguments
          );

          // Use Promise.all for concurrent API calls
          const profilePromises = args.user_ids.map(async (userId) => {
            try {
              const response = await userClient.users.profile.get({
                user: userId,
              });
              if (!response.ok) {
                return {
                  user_id: userId,
                  error: response.error || 'Unknown error',
                };
              }
              const parsed = UserProfileResponseSchema.parse(response);
              return {
                user_id: userId,
                profile: parsed.profile,
              };
            } catch (error) {
              return {
                user_id: userId,
                error: error instanceof Error ? error.message : 'Unknown error',
              };
            }
          });

          const results = await Promise.all(profilePromises);
          const responseData = GetUserProfilesResponseSchema.parse({
            profiles: results,
          });

          return {
            content: [{ type: 'text', text: JSON.stringify(responseData) }],
          };
        }

        case 'slack_search_messages': {
          const parsedParams = SearchMessagesRequestSchema.parse(
            request.params.arguments
          );

          let query = parsedParams.query || '';

          if (parsedParams.in_channel) {
            // Resolve channel name from ID
            const channelInfo = await userClient.conversations.info({
              channel: parsedParams.in_channel,
            });
            if (!channelInfo.ok || !channelInfo.channel?.name) {
              throw new Error(
                `Failed to get channel info: ${channelInfo.error}`
              );
            }
            query += ` in:${channelInfo.channel.name}`;
          }

          // Handle from_user - always use user ID format
          if (parsedParams.from_user) {
            query += ` from:<@${parsedParams.from_user}>`;
          }

          // Date modifiers
          if (parsedParams.before) {
            query += ` before:${parsedParams.before}`;
          }
          if (parsedParams.after) {
            query += ` after:${parsedParams.after}`;
          }
          if (parsedParams.on) {
            query += ` on:${parsedParams.on}`;
          }
          if (parsedParams.during) {
            query += ` during:${parsedParams.during}`;
          }

          // Trim and log the final query for debugging
          query = query.trim();
          console.log('Search query:', query);

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

  return server;
}

async function runStdioServer() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Slack MCP Server running on stdio');
}

async function runHttpServer(port: number) {
  const app = express();
  app.use(express.json());

  // Map to store transports by session ID
  const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

  // Handle POST requests for client-to-server communication
  app.post('/mcp', async (req, res) => {
    try {
      // Check for existing session ID
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports[sessionId]) {
        // Reuse existing transport
        transport = transports[sessionId];
      } else {
        // Create new transport
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newSessionId) => {
            // Store the transport by session ID
            transports[newSessionId] = transport;
            console.error(`New MCP session initialized: ${newSessionId}`);
          },
        });

        // Clean up transport when closed
        transport.onclose = () => {
          if (transport.sessionId) {
            delete transports[transport.sessionId];
            console.error(`MCP session closed: ${transport.sessionId}`);
          }
        };

        const server = createServer();
        await server.connect(transport);
      }

      // Handle the request
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

  // Handle GET requests for server-to-client notifications via SSE
  app.get('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }

    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
  });

  // Handle DELETE requests for session termination
  app.delete('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }

    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.listen(port, () => {
    console.error(
      `Slack MCP Server running on Streamable HTTP at http://localhost:${port}/mcp`
    );
    console.error(`Health check available at http://localhost:${port}/health`);
  });
}

async function main() {
  const { port } = parseArguments();

  if (port !== undefined) {
    // Run with Streamable HTTP transport
    await runHttpServer(port);
  } else {
    // Run with stdio transport (default)
    await runStdioServer();
  }
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
