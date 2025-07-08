# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Model Context Protocol (MCP) server that provides AI assistants with standardized access to Slack APIs. It's written in TypeScript and supports both stdio (process-based) and HTTP transport methods.

## Development Commands

### Building and Running
- `npm run build` - Compile TypeScript to JavaScript in `/dist`
- `npm run dev` - Start server in development mode with hot reloading
- `npm start` - Run the production build

### Code Quality
- `npm run lint` - Run both ESLint and Prettier checks
- `npm run fix` - Auto-fix all linting issues
- `npm run lint:eslint` - Run ESLint only
- `npm run lint:prettier` - Run Prettier only

### Examples
- `npm run examples` - Run stdio transport example
- `npm run examples:http` - Run HTTP transport example

## Architecture

### Core Structure
The server follows a schema-driven design pattern:

1. **Request/Response Schemas** (`src/schemas.ts`):
   - All Slack API interactions are validated with Zod schemas
   - Request schemas define input parameters
   - Response schemas filter API responses to only necessary fields

2. **Main Server** (`src/index.ts`):
   - Dual transport support via command-line flag
   - Tool registration and request handling
   - Environment variable validation

### Transport Modes
- **Stdio (default)**: For CLI integration (Claude Desktop, etc.)
- **HTTP**: For web applications via `-port` flag

### Available Tools
All tools follow the pattern: validate request → call Slack API → parse response → return JSON

- Channel operations: list, post message, get history
- Thread operations: reply, get replies  
- User operations: get users, profiles, bulk profiles
- Message operations: search, add reactions

### Tool Selection Guidelines

**When to use `slack_search_messages`:**
- You need to find messages with specific criteria (keywords, user, date range, channel)
- You want to filter/narrow down results based on conditions
- You're looking for targeted information rather than browsing

**When to use `slack_get_channel_history`:**
- You want to see the latest conversation flow without specific filters
- You need ALL messages including bot/automation messages (search excludes these)
- You want to browse messages chronologically with pagination
- You don't have specific search criteria and just want to understand recent activity

### Environment Requirements
Must set in environment or `.env` file:
- `SLACK_BOT_TOKEN`: Bot User OAuth Token
- `SLACK_USER_TOKEN`: User OAuth Token (for search)

## Key Implementation Notes

1. **No Test Suite**: Currently no tests implemented (`"test": "echo \"No tests yet\""`)

2. **Type Safety**: All Slack API responses are parsed through Zod schemas to ensure type safety and limit response size

3. **Error Handling**: The server validates tokens on startup and provides clear error messages

4. **Publishing**: Uses GitHub Package Registry - requires PAT for installation

5. **ES Modules**: Project uses `"type": "module"` - use ES import syntax

## Common Tasks

### Adding a New Slack Tool
1. Define request/response schemas in `src/schemas.ts`
2. Add tool registration in `src/index.ts` server setup
3. Implement handler following existing pattern: validate → API call → parse → return
4. Update README.md with new tool documentation

### Search Messages Considerations
1. **Query Field**: The `query` field accepts plain text search terms only. Modifiers like `from:`, `in:`, `before:` etc. are NOT allowed in the query field - use the dedicated fields instead
2. **Date Search**: The `on:` modifier may not find results due to timezone differences between the Slack workspace and the user's local time
3. **ID-Only Fields**: All search modifier fields require proper Slack IDs for consistency and reliability:
   - `in_channel`: Channel ID (e.g., `C1234567`) - use `slack_list_channels` to find channel IDs. The server automatically converts channel IDs to channel names for search compatibility.
   - `from_user`: User ID (e.g., `U1234567`) - use `slack_get_users` to find user IDs
4. **Required Workflow**: Always use the appropriate listing tools first to convert names to IDs before searching
5. **Debug**: Search queries are logged to console for troubleshooting

### Known API Limitations
1. **Bot Message Exclusion**: The `search.messages` API excludes bot/automation messages by default, unlike the Slack UI
2. **Indexing Delays**: Messages are not indexed immediately; there can be delays between posting and searchability
3. **Proximity Filtering**: When multiple messages match in close proximity, only one result may be returned
4. **Rate Limiting**: Non-Marketplace apps have severe rate limits (1 request/minute, 15 messages max as of 2025)
5. **Comprehensive Alternative**: Use `conversations.history` for retrieving all messages including bot messages

### Modifying Schemas
When updating schemas, ensure backward compatibility and update both request validation and response filtering to maintain efficiency.