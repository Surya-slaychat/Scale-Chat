import type { StoryFeedItem } from '../types';
import { SEED_STORY_FEED } from './seed';

/**
 * Seam for the eventual NestJS `stories` module:
 *   - listFeed → GET /stories
 *   - markViewed → POST /stories/:id/view
 *   - create → POST /stories (after signed upload)
 */
export interface StoriesRepository {
  listFeed(): Promise<StoryFeedItem[]>;
  markViewed(storyId: string): Promise<void>;
  subscribe(listener: () => void): () => void;
}

const listeners = new Set<() => void>();
let cache: StoryFeedItem[] = clone(SEED_STORY_FEED);

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function notify(): void {
  listeners.forEach((l) => l());
}

export const mockStoriesRepository: StoriesRepository = {
  async listFeed() {
    return clone(cache);
  },
  async markViewed(storyId) {
    cache = cache.map((feedItem) => {
      const stories = feedItem.stories.map((s) =>
        s.id === storyId ? { ...s, viewed: true } : s
      );
      return {
        ...feedItem,
        stories,
        hasUnviewed: stories.some((s) => !s.viewed),
      };
    });
    notify();
  },
  subscribe(listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
