import { useRouter } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FontWeight, Spacing } from '@/constants/theme';

import { StoriesCopy } from '../copy';
import { useStoryFeed } from '../hooks/use-story-feed';
import { StoryCircle } from './story-circle';

type Props = {
  /** When the row sits on the blue header card the title needs to be white. */
  onLightBackground?: boolean;
};

/** Horizontal "Status" row — first cell is "add", followed by author groups. */
export function StatusRow({ onLightBackground = true }: Props) {
  const router = useRouter();
  const { feed } = useStoryFeed();

  const textColor = onLightBackground ? '#FFFFFF' : undefined;

  return (
    <View style={styles.wrap}>
      <ThemedText style={[styles.title, textColor ? { color: textColor } : null]}>
        {StoriesCopy.sectionTitle}
      </ThemedText>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        data={feed}
        keyExtractor={(item) => item.author.id}
        ListHeaderComponent={
          <StoryCircle
            variant="add"
            label={StoriesCopy.yourStory}
            labelColor={textColor}
            onPress={() => router.push('/stories/composer')}
          />
        }
        ItemSeparatorComponent={() => <View style={{ width: Spacing.two }} />}
        renderItem={({ item }) => (
          <StoryCircle
            contact={item.author}
            label={item.author.displayName.split(' ')[0] ?? item.author.displayName}
            hasUnviewed={item.hasUnviewed}
            labelColor={textColor}
            onPress={() =>
              router.push({
                pathname: '/stories/[authorUserId]',
                params: { authorUserId: item.author.id },
              })
            }
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.two,
  },
  title: {
    fontSize: 13,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.2,
    paddingHorizontal: Spacing.three,
  },
  list: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.one,
  },
});
