import { z } from 'zod';
import {
  PublicSearchApiResponseSchema,
  PublicSearchMessagesRequestSchema,
  SearchMessagesRequestSchema,
  SearchMessagesResponseSchema,
} from './schemas.js';

export type MessageSearchDependencies = {
  safeSearchMode: boolean;
  apiCall(method: string, input: Record<string, unknown>): Promise<unknown>;
  legacySearch(
    input: { query: string } & Record<string, unknown>
  ): Promise<unknown>;
  channelName(channelId: string): Promise<string>;
};

export async function searchMessages(
  args: unknown,
  dependencies: MessageSearchDependencies
) {
  if (dependencies.safeSearchMode)
    return searchPublicMessages(args, dependencies.apiCall);
  const input = SearchMessagesRequestSchema.parse(args);
  const channel = input.in_channel
    ? await dependencies.channelName(input.in_channel)
    : undefined;
  const query = buildQuery(input, channel);
  const response = await dependencies.legacySearch({
    query: query.trim(),
    highlight: input.highlight,
    sort: input.sort,
    sort_dir: input.sort_dir,
    count: input.count,
    page: input.page,
  });
  const parsed = SearchMessagesResponseSchema.parse(response);
  if (!parsed.ok) throw new Error(`Failed to search messages: ${parsed.error}`);
  return textResult(parsed);
}

async function searchPublicMessages(
  args: unknown,
  apiCall: MessageSearchDependencies['apiCall']
) {
  const input = PublicSearchMessagesRequestSchema.parse(args);
  let raw: unknown;
  try {
    raw = await apiCall('assistant.search.context', {
      query: buildQuery(
        input,
        input.in_channel ? `<#${input.in_channel}>` : undefined
      ),
      channel_types: ['public_channel'],
      content_types: ['messages'],
      include_context_messages: false,
      include_message_blocks: false,
      disable_semantic_search: true,
      highlight: input.highlight,
      sort: input.sort,
      sort_dir: input.sort_dir,
      limit: input.limit,
      ...(input.cursor ? { cursor: input.cursor } : {}),
    });
  } catch (error) {
    const platform = z
      .object({ data: z.object({ error: z.string() }) })
      .safeParse(error);
    throw publicSearchError(
      platform.success ? platform.data.data.error : undefined
    );
  }
  const failure = z
    .object({ ok: z.literal(false), error: z.string().optional() })
    .safeParse(raw);
  if (failure.success) throw publicSearchError(failure.data.error);
  const response = PublicSearchApiResponseSchema.safeParse(raw);
  if (!response.success)
    throw new Error('Slack public search returned an invalid response.');
  return textResult({
    contract: 'slack-public-search-v1',
    messages: {
      matches: response.data.results.messages.map((message) => ({
        channel: { id: message.channel_id, name: message.channel_name },
        text: message.content,
        ts: message.message_ts,
        ...(message.author_user_id ? { user: message.author_user_id } : {}),
        permalink: message.permalink,
      })),
    },
    next_cursor: response.data.response_metadata?.next_cursor ?? '',
  });
}

function buildQuery(
  input: Pick<
    z.output<typeof SearchMessagesRequestSchema>,
    'query' | 'from_user' | 'before' | 'after' | 'on' | 'during'
  >,
  channel: string | undefined
) {
  let query = input.query;
  if (channel) query += ` in:${channel}`;
  if (input.from_user) query += ` from:<@${input.from_user}>`;
  for (const name of ['before', 'after', 'on', 'during'] as const) {
    if (input[name]) query += ` ${name}:${input[name]}`;
  }
  return query.trim();
}

function publicSearchError(code: string | undefined) {
  if (code === 'missing_scope') {
    return new Error(
      'Public message search requires search:read.public on the user token. Reauthorize the Slack app with this scope. Safe search does not fall back to legacy search.'
    );
  }
  const known = [
    'invalid_auth',
    'token_expired',
    'token_revoked',
    'ratelimited',
    'feature_not_enabled',
    'assistant_search_context_disabled',
    'not_allowed_token_type',
    'not_authed',
    'account_inactive',
  ];
  return new Error(
    known.includes(code ?? '')
      ? `Slack public search failed: ${code}.`
      : 'Slack public search failed. Check the connection and retry.'
  );
}

function textResult(payload: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
  };
}
