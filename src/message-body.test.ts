import assert from 'node:assert/strict';
import { test } from 'node:test';
import { zodToJsonSchema } from 'zod-to-json-schema';

import {
  PostMessageRequestSchema,
  ReplyToThreadRequestSchema,
} from './schemas.js';
import { toSlackMessageBody } from './message-body.js';

const thread_ts = '1234567890.123456';

test('text is Markdown by default, so Slack renders it', () => {
  const args = PostMessageRequestSchema.parse({
    channel_id: 'C1234',
    text: '**新機能**:\n\n- item',
  });

  assert.deepEqual(toSlackMessageBody(args), {
    markdown_text: '**新機能**:\n\n- item',
  });
});

test('format slack_mrkdwn posts text as Slack mrkdwn', () => {
  const args = ReplyToThreadRequestSchema.parse({
    channel_id: 'C1234',
    thread_ts,
    text: '*bold*',
    format: 'slack_mrkdwn',
  });

  assert.deepEqual(toSlackMessageBody(args), { text: '*bold*' });
});

test('Markdown over Slack 12,000 character limit is rejected', () => {
  const text = 'a'.repeat(12_001);

  assert.throws(() =>
    PostMessageRequestSchema.parse({ channel_id: 'C1', text })
  );
  assert.doesNotThrow(() =>
    PostMessageRequestSchema.parse({
      channel_id: 'C1',
      text,
      format: 'slack_mrkdwn',
    })
  );
});

test('tool input schemas offer format to the agent', () => {
  for (const schema of [PostMessageRequestSchema, ReplyToThreadRequestSchema]) {
    const json = zodToJsonSchema(schema) as {
      properties: Record<string, { enum?: string[]; default?: string }>;
    };
    assert.deepEqual(json.properties.format.enum, ['markdown', 'slack_mrkdwn']);
    assert.equal(json.properties.format.default, 'markdown');
  }
});
