/**
 * Stories ("Status") domain types. Mirrors the eventual shape from
 * `packages/shared/src/schemas/stories.ts`. Authors are masked in cross-user
 * payloads once the privacy interceptor flips to fail-closed.
 */

import type { Contact } from '@/features/chat/types';

export type StoryKind = 'image' | 'video' | 'text';

export type Story = {
  id: string;
  kind: StoryKind;
  /** Remote URL for image/video kinds. */
  mediaUri?: string;
  caption?: string;
  /** Background colour for text-only stories. */
  backgroundColor?: string;
  /** ISO timestamp — when this story expires (24h after createdAt). */
  expiresAt: string;
  createdAt: string;
  /** Has the current viewer already opened this story? */
  viewed: boolean;
};

/** Grouped feed item — one author with N active stories. */
export type StoryFeedItem = {
  author: Contact;
  stories: Story[];
  hasUnviewed: boolean;
};
