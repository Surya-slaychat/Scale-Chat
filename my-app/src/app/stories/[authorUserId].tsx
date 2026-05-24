import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Brand, FontWeight, Spacing } from '@/constants/theme';
import { Avatar } from '@/features/chat/components/avatar';
import { mockStoriesRepository } from '@/features/stories/data/stories-repository';
import { useStoryFeed } from '@/features/stories/hooks/use-story-feed';

/**
 * Story viewer — shell. Tap-right advances, tap-left goes back, swipe-down
 * (later: PanGestureHandler) dismisses. Marks each story viewed on display.
 */
export default function StoryViewer() {
  const router = useRouter();
  const { authorUserId } = useLocalSearchParams<{ authorUserId: string }>();
  const { feed } = useStoryFeed();
  const [index, setIndex] = useState(0);

  const group = useMemo(() => feed.find((f) => f.author.id === authorUserId), [feed, authorUserId]);
  const story = group?.stories[index];

  useEffect(() => {
    if (story) {
      void mockStoriesRepository.markViewed(story.id);
    }
  }, [story]);

  if (!group || !story) {
    return (
      <View style={[styles.root, { backgroundColor: '#000' }]}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.empty}>
            <ThemedText style={styles.title}>No stories</ThemedText>
            <Pressable onPress={() => router.back()} style={styles.close}>
              <Feather name="x" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const total = group.stories.length;
  const advance = () => {
    if (index + 1 < total) setIndex(index + 1);
    else router.back();
  };
  const reverse = () => {
    if (index > 0) setIndex(index - 1);
  };

  return (
    <View style={[styles.root, { backgroundColor: story.backgroundColor ?? Brand.cardWelcome }]}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.progressRow}>
          {group.stories.map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressSeg,
                { backgroundColor: i < index ? '#FFFFFF' : 'rgba(255,255,255,0.35)' },
                i === index && { backgroundColor: '#FFFFFF' },
              ]}
            />
          ))}
        </View>

        <View style={styles.headerRow}>
          <Avatar contact={group.author} size={36} />
          <ThemedText style={styles.author} numberOfLines={1}>
            {group.author.displayName}
          </ThemedText>
          <Pressable onPress={() => router.back()} hitSlop={10} style={styles.close}>
            <Feather name="x" size={22} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={styles.content}>
          {story.caption ? <ThemedText style={styles.caption}>{story.caption}</ThemedText> : null}
        </View>

        <View style={styles.tapZones}>
          <Pressable style={styles.tapZone} onPress={reverse} />
          <Pressable style={styles.tapZone} onPress={advance} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  progressRow: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  progressSeg: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  author: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: FontWeight.semibold,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    justifyContent: 'center',
    alignItems: 'center',
  },
  caption: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },
  tapZones: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 60,
    bottom: 80,
    flexDirection: 'row',
  },
  tapZone: { flex: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: FontWeight.bold,
  },
});
