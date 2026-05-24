import { useEffect, useState } from 'react';

import { mockStoriesRepository } from '../data/stories-repository';
import type { StoryFeedItem } from '../types';

/** Reactive story feed — re-renders consumers when any story is viewed. */
export function useStoryFeed(): { feed: StoryFeedItem[]; loading: boolean } {
  const [feed, setFeed] = useState<StoryFeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function refresh() {
      const next = await mockStoriesRepository.listFeed();
      if (!active) return;
      setFeed(next);
      setLoading(false);
    }

    refresh();
    const unsubscribe = mockStoriesRepository.subscribe(refresh);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return { feed, loading };
}
