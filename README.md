# slack-mcp-server

A [MCP(Model Context Protocol)](https://www.anthropic.com/news/model-context-protocol) server for accessing Slack API. This server allows AI assistants to interact with the Slack API through a standardized interface.

## Transport Support

This server supports both traditional and modern MCP transport methods:

- **Stdio Transport** (default): Process-based communication for local integration
- **Streamable HTTP Transport**: HTTP-based communication for web applications and remote clients

## Features

Available tools:

- `slack_list_channels` - List public channels in the workspace with pagination
- `slack_post_message` - Post a new message to a Slack channel
- `slack_reply_to_thread` - Reply to a specific message thread in Slack
- `slack_add_reaction` - Add a reaction emoji to a message
- `slack_get_channel_history` - Get recent messages from a channel
- `slack_get_thread_replies` - Get all replies in a message thread
- `slack_get_users` - Retrieve basic profile information of all users in the workspace
- `slack_get_user_profiles` - Get multiple users' profile information in bulk (efficient for batch operations)
- `slack_search_messages` - Search for messages in the workspace with powerful filters:
  - Basic query search
  - Location filters: `in_channel`
  - User filters: `from_user`, `with`
  - Date filters: `before` (YYYY-MM-DD), `after` (YYYY-MM-DD), `on` (YYYY-MM-DD), `during` (e.g., "July", "2023")
  - Content filters: `has` (emoji reactions), `is` (saved/thread)
  - Sorting options by relevance score or timestamp

## Quick Start

### Installation

```bash
npm install @ubie-oss/slack-mcp-server
```

NOTE: Its now hosted in GitHub Registry so you need your PAT.

### Configuration

You need to set the following environment variables:

- `SLACK_BOT_TOKEN`: Slack Bot User OAuth Token
- `SLACK_USER_TOKEN`: Slack User OAuth Token (required for some features like message search)
- `SLACK_SAFE_SEARCH` (optional): When set to `true`, message searches use Slack's Real-time Search API with `channel_types: ["public_channel"]`. The user token must have the `search:read.public` scope. The public-channel restriction applies before results are selected and paginated; clients cannot override it. This option affects message search, not the permissions of other tools.

You can also create a `.env` file to set these environment variables:

```
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_USER_TOKEN=xoxp-your-user-token
SLACK_SAFE_SEARCH=true  # Optional: Enable safe search mode
```

### Public message search

With `SLACK_SAFE_SEARCH=true`, `slack_search_messages` calls [`assistant.search.context`](https://docs.slack.dev/reference/methods/assistant.search.context/) using the **user token**, public channels only, message results only, and keyword search. It does not call legacy `search.messages`, including when the new API is unavailable or the token lacks a required scope.

The search tool keeps the existing keyword, channel, user, date and sorting fields. Public mode uses `limit` (1–20, default 20) and `cursor` instead of `count` and `page`. Pass `next_cursor` back with the same query and filters to read another page. An empty cursor marks the end of the results.

```json
{"query":"project update","limit":20,"cursor":"cursor-from-the-previous-response"}
```

Each successful MCP call returns a single text content block containing this JSON contract. It has no total counts, page numbers, ranking metadata, contextual messages or other result types. `channel.name` and `user` may be omitted; `next_cursor` is always a string.

```json
{
  "contract": "slack-public-search-v1",
  "messages": {
    "matches": [{
      "channel": {"id": "C1234567", "name": "general"},
      "text": "Public project update",
      "ts": "1234567890.123456",
      "user": "U1234567",
      "permalink": "https://example.slack.com/archives/C1234567/p1234567890123456"
    }]
  },
  "next_cursor": ""
}
```

To upgrade an existing safe-search deployment:

1. Add the `search:read.public` **user** scope to the Slack app and reauthorize it. A token with only legacy `search:read` is insufficient. Do not share tokens in configuration examples or logs.
2. Deploy this server with safe search enabled. Verify a public query and a subsequent cursor request. A `missing_scope` error explains the required scope; other API failures do not trigger a legacy fallback.
3. Upgrade clients to accept the `slack-public-search-v1` response and cursor input. Clients that depend on a public-only boundary should reject legacy responses instead of forwarding their metadata.

When `SLACK_SAFE_SEARCH` is unset or false, the existing legacy search API, `count`/`page` inputs and response shape remain unchanged.

### Usage

#### Start the MCP server

**Stdio Transport (default)**:
```bash
npx @ubie-oss/slack-mcp-server
```

**Streamable HTTP Transport**:
```bash
npx @ubie-oss/slack-mcp-server -port 3000
```

You can also run the installed module with node:
```bash
# Stdio transport
node node_modules/.bin/slack-mcp-server

# HTTP transport  
node node_modules/.bin/slack-mcp-server -port 3000
```

**Command Line Options**:
- `-port <number>`: Start with Streamable HTTP transport on specified port
- `-h, --help`: Show help message

#### Client Configuration

**For Stdio Transport (Claude Desktop, etc.)**:

```json
{
  "slack": {
    "command": "npx",
    "args": [
      "-y",
      "@ubie-oss/slack-mcp-server"
    ],
    "env": {
      "NPM_CONFIG_//npm.pkg.github.com/:_authToken": "<your-github-pat>",
      "SLACK_BOT_TOKEN": "<your-bot-token>",
      "SLACK_USER_TOKEN": "<your-user-token>",
      "SLACK_SAFE_SEARCH": "true"
    }
  }
}
```

**For Streamable HTTP Transport (Web applications)**:

Start the server:
```bash
SLACK_BOT_TOKEN=<your-bot-token> SLACK_USER_TOKEN=<your-user-token> npx @ubie-oss/slack-mcp-server -port 3000
```

Connect to: `http://localhost:3000/mcp`

See [examples/README.md](examples/README.md) for detailed client examples.

## Implementation Pattern

This server adopts the following implementation pattern:

1. Define request/response using Zod schemas
   - Request schema: Define input parameters
   - Response schema: Define responses limited to necessary fields

2. Implementation flow:
   - Validate request with Zod schema
   - Call Slack WebAPI
   - Parse response with Zod schema to limit to necessary fields
   - Return as JSON

For example, the `slack_list_channels` implementation parses the request with `ListChannelsRequestSchema`, calls `slackClient.conversations.list`, and returns the response parsed with `ListChannelsResponseSchema`.

## Development

### Available Scripts

- `npm run dev` - Start the server in development mode with hot reloading
- `npm run build` - Build the project for production
- `npm run start` - Start the production server
- `npm run lint` - Run linting checks (ESLint and Prettier)
- `npm test` - Run the message-search boundary tests with Node's test runner
- `npm run fix` - Automatically fix linting issues

### Contributing

1. Fork the repository
2. Create your feature branch
3. Run tests and linting: `npm run lint`
4. Commit your changes
5. Push to the branch
6. Create a Pull Request
