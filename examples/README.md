# Examples

This directory contains example clients for the Slack MCP Server, demonstrating both stdio and Streamable HTTP transport methods.

## Available Examples

### 1. Stdio Client (`get_users.ts`)
Uses the traditional stdio transport to communicate with the MCP server.

### 2. Streamable HTTP Client (`get_users_http.ts`)
Uses the newer Streamable HTTP transport to communicate with the MCP server over HTTP.

## Setup

1. Set up your environment variables in `.env`:
```env
# For the server
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_USER_TOKEN=xoxp-your-user-token

# For the examples (same values, different variable names)
EXMAPLES_SLACK_BOT_TOKEN=xoxb-your-bot-token
EXMAPLES_SLACK_USER_TOKEN=xoxp-your-user-token
```

## Usage

### Running the Stdio Example

```bash
# Run the stdio client example
npm run examples
```

### Running the HTTP Example

```bash
# Terminal 1: Start the HTTP server
npm run start -- -port 3000

# Terminal 2: Run the HTTP client example
npm run examples:http

# Or specify a custom server URL
npm run examples:http http://localhost:3001/mcp
```

## What the Examples Do

Both examples:
1. Connect to the Slack MCP Server
2. List available tools
3. Call the `slack_get_users` tool with a limit of 100 users
4. Display the retrieved user information including:
   - User name
   - Real name
   - User ID
   - Pagination information if more users are available

## Transport Comparison

### Stdio Transport
- **Pros**: Simple, no network setup required
- **Cons**: Process-based communication, harder to debug network issues
- **Use case**: Local development, direct integration

### Streamable HTTP Transport  
- **Pros**: Standard HTTP, easier debugging, supports web-based clients
- **Cons**: Requires server setup, network configuration
- **Use case**: Web applications, remote clients, production deployments

## Troubleshooting

### Common Issues

1. **Missing environment variables**: Ensure all required `SLACK_BOT_TOKEN`, `SLACK_USER_TOKEN`, `EXMAPLES_SLACK_BOT_TOKEN`, and `EXMAPLES_SLACK_USER_TOKEN` are set.

2. **Connection refused (HTTP)**: Make sure the HTTP server is running on the specified port before running the HTTP client.

3. **Permission errors**: Ensure your Slack tokens have the necessary permissions to list users in your workspace. 