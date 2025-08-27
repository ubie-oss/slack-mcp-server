import { z } from 'zod';

//
// Basic schemas
//

export const ChannelSchema = z
  .object({
    conversation_host_id: z.string().optional(),
    created: z.number().optional(),
    id: z.string().optional(),
    is_archived: z.boolean().optional(),
    name: z.string().optional(),
    name_normalized: z.string().optional(),
    num_members: z.number().optional(),
    purpose: z
      .object({
        creator: z.string().optional(),
        last_set: z.number().optional(),
        value: z.string().optional(),
      })
      .optional(),
    shared_team_ids: z.array(z.string()).optional(),
    topic: z
      .object({
        creator: z.string().optional(),
        last_set: z.number().optional(),
        value: z.string().optional(),
      })
      .optional(),
    updated: z.number().optional(),
  })
  .strip();

const ReactionSchema = z
  .object({
    count: z.number().optional(),
    name: z.string().optional(),
    url: z.string().optional(),
    users: z.array(z.string()).optional(),
  })
  .strip();

const ConversationsHistoryMessageSchema = z
  .object({
    reactions: z.array(ReactionSchema).optional(),
    reply_count: z.number().optional(),
    reply_users: z.array(z.string()).optional(),
    reply_users_count: z.number().optional(),
    subtype: z.string().optional(),
    text: z.string().optional(),
    thread_ts: z.string().optional(),
    ts: z.string().optional(),
    type: z.string().optional(),
    user: z.string().nullable().optional(),
  })
  .strip();

const MemberSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    real_name: z.string().optional(),
  })
  .strip();

const ProfileSchema = z
  .object({
    display_name: z.string().optional(),
    display_name_normalized: z.string().optional(),
    email: z.string().email().optional(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    phone: z.string().optional(),
    real_name: z.string().optional(),
    real_name_normalized: z.string().optional(),
    title: z.string().optional(),
  })
  .strip();

const SearchMessageSchema = z
  .object({
    channel: z
      .object({
        id: z.string().optional(),
        name: z.string().optional(),
      })
      .optional(),
    permalink: z.string().url().optional(),
    text: z.string().optional(),
    ts: z.string().optional(),
    type: z.string().optional(),
    user: z.string().nullable().optional(),
  })
  .strip();

//
// Request schemas
//

export const AddReactionRequestSchema = z.object({
  channel_id: z
    .string()
    .describe('The ID of the channel containing the message'),
  reaction: z.string().describe('The name of the emoji reaction (without ::)'),
  timestamp: z
    .string()
    .regex(/^\d{10}\.\d{6}$/, {
      message: "Timestamp must be in the format '1234567890.123456'",
    })
    .describe(
      "The timestamp of the message to react to in the format '1234567890.123456'"
    ),
});

export const GetChannelHistoryRequestSchema = z.object({
  channel_id: z
    .string()
    .describe(
      'The ID of the channel. Use this tool for: browsing latest messages without filters, getting ALL messages including bot/automation messages, sequential pagination. If you need to search by user, keywords, or dates, use slack_search_messages instead.'
    ),
  cursor: z
    .string()
    .optional()
    .describe('Pagination cursor for next page of results'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(1000) // Align with Slack API's default limit
    .optional()
    .default(100) // The reference repository uses 10, but aligning with list_channels etc., set to 100
    .describe('Number of messages to retrieve (default 100)'),
});

export const GetThreadRepliesRequestSchema = z.object({
  channel_id: z
    .string()
    .describe('The ID of the channel containing the thread'),
  thread_ts: z
    .string()
    .regex(/^\d{10}\.\d{6}$/, {
      message: "Timestamp must be in the format '1234567890.123456'",
    })
    .describe(
      "The timestamp of the parent message in the format '1234567890.123456'. Timestamps in the format without the period can be converted by adding the period such that 6 numbers come after it."
    ),
  cursor: z
    .string()
    .optional()
    .describe('Pagination cursor for next page of results'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional()
    .default(100)
    .describe('Number of replies to retrieve (default 100)'),
});

export const GetUsersRequestSchema = z.object({
  cursor: z
    .string()
    .optional()
    .describe('Pagination cursor for next page of results'),
  limit: z
    .number()
    .int()
    .min(1)
    .optional()
    .default(100)
    .describe('Maximum number of users to return (default 100)'),
});

export const GetUserProfilesRequestSchema = z.object({
  user_ids: z
    .array(z.string())
    .min(1)
    .max(100)
    .describe('Array of user IDs to retrieve profiles for (max 100)'),
});

export const ListChannelsRequestSchema = z.object({
  cursor: z
    .string()
    .optional()
    .describe('Pagination cursor for next page of results'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(1000) // Align with Slack API's default limit (conversations.list is actually cursor-based)
    .optional()
    .default(100)
    .describe('Maximum number of channels to return (default 100)'),
});

export const PostMessageRequestSchema = z.object({
  channel_id: z.string().describe('The ID of the channel to post to'),
  text: z.string().describe('The message text to post'),
});

export const ReplyToThreadRequestSchema = z.object({
  channel_id: z
    .string()
    .describe('The ID of the channel containing the thread'),
  text: z.string().describe('The reply text'),
  thread_ts: z
    .string()
    .regex(/^\d{10}\.\d{6}$/, {
      message: "Timestamp must be in the format '1234567890.123456'",
    })
    .describe(
      "The timestamp of the parent message in the format '1234567890.123456'. Timestamps in the format without the period can be converted by adding the period such that 6 numbers come after it."
    ),
});

export const SearchChannelsRequestSchema = z.object({
  query: z
    .string()
    .describe(
      'Search channels by partial name match (case-insensitive). Searches across channel names.'
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(20)
    .describe('Maximum number of channels to return (default 20)'),
  include_archived: z
    .boolean()
    .optional()
    .default(false)
    .describe('Include archived channels in results (default false)'),
});

export const SearchUsersRequestSchema = z.object({
  query: z
    .string()
    .describe(
      'Search users by name, display name, or real name (partial match, case-insensitive)'
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(20)
    .describe('Maximum number of users to return (default 20)'),
  include_bots: z
    .boolean()
    .optional()
    .default(false)
    .describe('Include bot users in results (default false)'),
});

export const SearchMessagesRequestSchema = z.object({
  query: z
    .string()
    .optional()
    .default('')
    .describe(
      'Basic search query text only. Use this tool when you need to: search by keywords, filter by user/date/channel, find specific messages with criteria. For general channel browsing without filters, use slack_get_channel_history instead. Do NOT include modifiers like "from:", "in:", etc. - use the dedicated fields instead.'
    )
    .refine(
      (val) => {
        if (!val) return true;
        const modifierPattern =
          /\b(from|in|before|after|on|during|has|is|with):/i;
        return !modifierPattern.test(val);
      },
      {
        message:
          'Query field cannot contain modifiers (from:, in:, before:, etc.). Please use the dedicated fields for these filters.',
      }
    ),

  in_channel: z
    .string()
    .regex(/^C[A-Z0-9]+$/, {
      message: 'Must be a valid Slack channel ID (e.g., "C1234567")',
    })
    .optional()
    .describe(
      'Search within a specific channel. Must be a Slack channel ID (e.g., "C1234567"). Use slack_list_channels to find channel IDs first.'
    ),

  from_user: z
    .string()
    .regex(/^U[A-Z0-9]+$/, {
      message: 'Must be a valid Slack user ID (e.g., "U1234567")',
    })
    .optional()
    .describe(
      'Search for messages from a specific user. IMPORTANT: You cannot use display names or usernames directly. First use slack_get_users to find the user by name and get their user ID (e.g., "U1234567"), then use that ID here.'
    ),

  // Date modifiers
  before: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, {
      message: 'Date must be in YYYY-MM-DD format',
    })
    .optional()
    .describe('Search for messages before this date (YYYY-MM-DD)'),
  after: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, {
      message: 'Date must be in YYYY-MM-DD format',
    })
    .optional()
    .describe('Search for messages after this date (YYYY-MM-DD)'),
  on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, {
      message: 'Date must be in YYYY-MM-DD format',
    })
    .optional()
    .describe('Search for messages on this specific date (YYYY-MM-DD)'),
  during: z
    .string()
    .optional()
    .describe(
      'Search for messages during a specific time period (e.g., "July", "2023", "last week")'
    ),

  highlight: z
    .boolean()
    .optional()
    .default(false)
    .describe('Enable highlighting of search results'),
  sort: z
    .enum(['score', 'timestamp'])
    .optional()
    .default('score')
    .describe('Search result sort method (score or timestamp)'),
  sort_dir: z
    .enum(['asc', 'desc'])
    .optional()
    .default('desc')
    .describe('Sort direction (ascending or descending)'),

  count: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(20)
    .describe('Number of results per page (max 100)'),
  page: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(1)
    .describe('Page number of results (max 100)'),
});

const SearchPaginationSchema = z.object({
  first: z.number().optional(),
  last: z.number().optional(),
  page: z.number().optional(),
  page_count: z.number().optional(),
  per_page: z.number().optional(),
  total_count: z.number().optional(),
});

//
// Response schemas
//

const BaseResponseSchema = z
  .object({
    error: z.string().optional(),
    ok: z.boolean().optional(),
    response_metadata: z
      .object({
        next_cursor: z.string().optional(),
      })
      .optional(),
  })
  .strip();

export const ConversationsHistoryResponseSchema = BaseResponseSchema.extend({
  messages: z.array(ConversationsHistoryMessageSchema).optional(),
});

export const ConversationsRepliesResponseSchema = BaseResponseSchema.extend({
  messages: z.array(ConversationsHistoryMessageSchema).optional(),
});

export const GetUsersResponseSchema = BaseResponseSchema.extend({
  members: z.array(MemberSchema).optional(),
});

export const UserProfileResponseSchema = BaseResponseSchema.extend({
  profile: ProfileSchema.optional(),
});

export const GetUserProfilesResponseSchema = z.object({
  profiles: z.array(
    z.object({
      user_id: z.string(),
      profile: ProfileSchema.optional(),
      error: z.string().optional(),
    })
  ),
});

export const ListChannelsResponseSchema = BaseResponseSchema.extend({
  channels: z.array(ChannelSchema).optional(),
});

export const SearchMessagesResponseSchema = BaseResponseSchema.extend({
  messages: z
    .object({
      matches: z.array(SearchMessageSchema).optional(),
      pagination: SearchPaginationSchema.optional(),
    })
    .optional(),
});
