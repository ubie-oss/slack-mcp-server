import { z } from 'zod';

const SLACK_MARKDOWN_TEXT_LIMIT = 12_000;

export const messageBodyFields = {
  text: z
    .string()
    .describe(
      'The message. Written in standard Markdown by default (**bold**, *italic*, headings, lists, tables, code blocks, [label](https://example.com)), which Slack renders.'
    ),
  format: z
    .enum(['markdown', 'slack_mrkdwn'])
    .default('markdown')
    .describe(
      `How Slack reads text. markdown (default) renders standard Markdown, up to ${SLACK_MARKDOWN_TEXT_LIMIT} characters. slack_mrkdwn reads Slack's own syntax: *bold*, _italic_, ~strike~, <https://example.com|label>.`
    ),
};

type MessageBodyArgs = { text: string; format: 'markdown' | 'slack_mrkdwn' };

export function fitsSlackMarkdownLimit(args: MessageBodyArgs) {
  return (
    args.format !== 'markdown' || args.text.length <= SLACK_MARKDOWN_TEXT_LIMIT
  );
}

export const slackMarkdownLimitError = {
  message: `Markdown text must be at most ${SLACK_MARKDOWN_TEXT_LIMIT} characters`,
  path: ['text'],
};

export function toSlackMessageBody(
  args: MessageBodyArgs
): { text: string } | { markdown_text: string } {
  return args.format === 'markdown'
    ? { markdown_text: args.text }
    : { text: args.text };
}
