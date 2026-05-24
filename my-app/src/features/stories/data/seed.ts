import { SEED_CONTACT_BY_ID } from '@/features/chat/data/seed';

import type { StoryFeedItem } from '../types';

const NOW = Date.now();
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const hoursAhead = (h: number) => new Date(NOW + h * 3_600_000).toISOString();

export const SEED_STORY_FEED: StoryFeedItem[] = [
  {
    author: SEED_CONTACT_BY_ID['c-naman']!,
    hasUnviewed: true,
    stories: [
      {
        id: 's-naman-1',
        kind: 'image',
        caption: 'Lunch view',
        expiresAt: hoursAhead(22),
        createdAt: minutesAgo(20),
        viewed: false,
      },
    ],
  },
  {
    author: SEED_CONTACT_BY_ID['c-megha']!,
    hasUnviewed: true,
    stories: [
      {
        id: 's-megha-1',
        kind: 'text',
        backgroundColor: '#6F7FE8',
        caption: 'Friday vibes ✨',
        expiresAt: hoursAhead(18),
        createdAt: hoursAgo(6),
        viewed: false,
      },
    ],
  },
  {
    author: SEED_CONTACT_BY_ID['c-priya']!,
    hasUnviewed: false,
    stories: [
      {
        id: 's-priya-1',
        kind: 'image',
        expiresAt: hoursAhead(8),
        createdAt: hoursAgo(16),
        viewed: true,
      },
    ],
  },
];
