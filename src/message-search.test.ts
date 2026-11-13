import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  searchMessages,
  type MessageSearchDependencies,
} from './message-search.js';

const publicMessage = {
  channel_id: 'C1234',
  channel_name: 'general',
  content: 'Public project update',
  message_ts: '1234567890.123456',
  author_user_id: 'U1234',
  permalink: 'https://example.slack.com/archives/C1234/p1234567890123456',
};

function fixture(
  response: unknown = {
    ok: true,
    results: { messages: [publicMessage] },
    response_metadata: { next_cursor: 'public-next' },
  }
) {
  const publicCalls: Record<string, unknown>[] = [];
  const methods: string[] = [];
  const legacyCalls: Record<string, unknown>[] = [];
  const channels: string[] = [];
  const dependencies: MessageSearchDependencies = {
    safeSearchMode: true,
    apiCall: async (method, input) => {
      methods.push(method);
      publicCalls.push(input);
      return response;
    },
    legacySearch: async (input) => {
      legacyCalls.push(input);
      return {
        ok: true,
        messages: {
          matches: [],
          pagination: {
            total_count: 871029,
            page_count: 100,
            first: 1,
            last: 20,
          },
        },
      };
    },
    channelName: async (id) => {
      channels.push(id);
      return 'general';
    },
  };
  return { dependencies, publicCalls, legacyCalls, channels, methods };
}

test('safe search uses a public-only API request and returns public messages with a cursor', async () => {
  const f = fixture();
  const result = await searchMessages(
    { query: 'project OR deadline', limit: 7, cursor: 'previous' },
    f.dependencies
  );
  assert.deepEqual(f.methods, ['assistant.search.context']);
  assert.deepEqual(f.publicCalls, [
    {
      query: 'project OR deadline',
      channel_types: ['public_channel'],
      content_types: ['messages'],
      include_context_messages: false,
      include_message_blocks: false,
      disable_semantic_search: true,
      highlight: false,
      sort: 'score',
      sort_dir: 'desc',
      limit: 7,
      cursor: 'previous',
    },
  ]);
  assert.deepEqual(f.legacyCalls, []);
  assert.deepEqual(result, {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          contract: 'slack-public-search-v1',
          messages: {
            matches: [
              {
                channel: { id: 'C1234', name: 'general' },
                text: publicMessage.content,
                ts: publicMessage.message_ts,
                user: 'U1234',
                permalink: publicMessage.permalink,
              },
            ],
          },
          next_cursor: 'public-next',
        }),
      },
    ],
  });
});

test('safe filters use IDs without looking up a potentially private channel', async () => {
  const f = fixture();
  await searchMessages(
    {
      query: 'project',
      in_channel: 'C1234',
      from_user: 'U1234',
      before: '2026-11-01',
      after: '2026-10-01',
      on: '2026-10-15',
      during: 'October',
      sort: 'timestamp',
      sort_dir: 'asc',
    },
    f.dependencies
  );
  assert.equal(
    f.publicCalls[0]?.query,
    'project in:<#C1234> from:<@U1234> before:2026-11-01 after:2026-10-01 on:2026-10-15 during:October'
  );
  assert.deepEqual(f.channels, []);
});

test('safe search does not expose totals, ranks, extra result kinds, or raw response fields', async () => {
  const f = fixture({
    ok: true,
    total: 871029,
    results: {
      messages: [{ ...publicMessage, score: 999, iid: 'hidden-index' }],
      files: ['PRIVATE_FILE'],
    },
    messages: {
      pagination: { total_count: 871029, page_count: 100, first: 1, last: 20 },
    },
    response_metadata: { next_cursor: '', private_count: 871029 },
    debug: 'PRIVATE_METADATA',
  });
  const result = await searchMessages({ query: 'project' }, f.dependencies);
  assert.match(result.content[0].text, /Public project update/);
  assert.doesNotMatch(
    result.content[0].text,
    /871029|pagination|total|score|iid|PRIVATE|first|last|page_count/
  );
});

test('a public search with no matches has the same empty response even if unrelated metadata is present', async () => {
  const plain = fixture({ ok: true, results: { messages: [] } });
  const extra = fixture({
    ok: true,
    results: { messages: [] },
    total_count: 871029,
    messages: { pagination: { total_count: 871029 } },
  });
  const a = await searchMessages({ query: 'project' }, plain.dependencies);
  const b = await searchMessages({ query: 'project' }, extra.dependencies);
  assert.deepEqual(a, b);
  assert.deepEqual(JSON.parse(a.content[0].text), {
    contract: 'slack-public-search-v1',
    messages: { matches: [] },
    next_cursor: '',
  });
});

test('an empty public result set may omit the messages collection', async () => {
  const f = fixture({ ok: true, results: {} });
  const result = await searchMessages({ query: 'project' }, f.dependencies);
  assert.deepEqual(JSON.parse(result.content[0].text), {
    contract: 'slack-public-search-v1',
    messages: { matches: [] },
    next_cursor: '',
  });
});

for (const error of ['missing_scope', 'invalid_auth', 'ratelimited']) {
  test(`safe search surfaces ${error} without a legacy fallback`, async () => {
    const f = fixture({ ok: false, error, raw_private_metadata: 871029 });
    await assert.rejects(
      searchMessages({ query: 'project' }, f.dependencies),
      error === 'missing_scope' ? /search:read.public/ : new RegExp(error)
    );
    assert.deepEqual(f.legacyCalls, []);
  });
}

test('an SDK platform error also reports the required scope without exposing its response', async () => {
  const f = fixture();
  f.dependencies.apiCall = async () => {
    throw Object.assign(new Error('PRIVATE_RAW_RESPONSE'), {
      data: { error: 'missing_scope', total_count: 871029 },
    });
  };
  await assert.rejects(
    searchMessages({ query: 'project' }, f.dependencies),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /search:read.public/);
      assert.doesNotMatch(error.message, /PRIVATE|871029/);
      return true;
    }
  );
  assert.deepEqual(f.legacyCalls, []);
});

test('transport failures and malformed or legacy responses never expose raw data', async () => {
  const transport = fixture();
  transport.dependencies.apiCall = async () => {
    throw new Error('PRIVATE_RAW_RESPONSE');
  };
  await assert.rejects(
    searchMessages({ query: 'project' }, transport.dependencies),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(
        error.message,
        'Slack public search failed. Check the connection and retry.'
      );
      return true;
    }
  );
  for (const response of [
    {
      ok: true,
      messages: { matches: [], pagination: { total_count: 871029 } },
    },
    { ok: true, results: { messages: [{ content: 'PRIVATE_RAW_RESPONSE' }] } },
  ]) {
    const f = fixture(response);
    await assert.rejects(searchMessages({ query: 'project' }, f.dependencies), {
      message: 'Slack public search returned an invalid response.',
    });
    assert.deepEqual(f.legacyCalls, []);
  }
});

test('safe search defaults to twenty results and supports messages without a channel name or author', async () => {
  const f = fixture({
    ok: true,
    results: {
      messages: [
        {
          channel_id: 'C1234',
          content: 'Public update',
          message_ts: '1234567890.123456',
          permalink: publicMessage.permalink,
        },
      ],
    },
  });
  const result = await searchMessages({ query: 'project' }, f.dependencies);
  assert.equal(f.publicCalls[0].limit, 20);
  assert.equal('cursor' in f.publicCalls[0], false);
  const payload = JSON.parse(result.content[0].text);
  assert.deepEqual(payload.messages.matches[0].channel, { id: 'C1234' });
  assert.equal('user' in payload.messages.matches[0], false);
  assert.equal(payload.next_cursor, '');
});

for (const args of [
  { page: 1 },
  { count: 10 },
  { limit: 21 },
  { channel_types: ['private_channel'] },
]) {
  test(`safe input rejects legacy pagination and scope overrides: ${JSON.stringify(args)}`, async () => {
    const f = fixture();
    await assert.rejects(
      searchMessages({ query: 'project', ...args }, f.dependencies)
    );
    assert.deepEqual(f.publicCalls, []);
    assert.deepEqual(f.legacyCalls, []);
  });
}

test('non-safe mode preserves legacy pagination and channel-name lookup', async () => {
  const f = fixture();
  f.dependencies.safeSearchMode = false;
  const result = await searchMessages(
    { query: 'project', in_channel: 'C1234', count: 40, page: 3 },
    f.dependencies
  );
  assert.deepEqual(f.legacyCalls, [
    {
      query: 'project in:general',
      count: 40,
      page: 3,
      highlight: false,
      sort: 'score',
      sort_dir: 'desc',
    },
  ]);
  assert.deepEqual(f.publicCalls, []);
  assert.deepEqual(f.channels, ['C1234']);
  assert.equal(
    JSON.parse(result.content[0].text).messages.pagination.total_count,
    871029
  );
});
