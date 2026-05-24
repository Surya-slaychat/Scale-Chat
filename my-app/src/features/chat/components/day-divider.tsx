import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, FontWeight, Spacing } from '@/constants/theme';

type Props = { label: string };

/**
 * "Today" / "Yesterday" pill that breaks runs of messages in a thread.
 * Figma 1:3084 — `rgba(36,36,36,0.74)` pill, `#777` Poppins Regular 11px.
 */
export function DayDivider({ label }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.pill}>
        <ThemedText style={styles.text}>{label}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    marginVertical: Spacing.two + 2,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: Brand.chatDayPill,
  },
  text: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: FontWeight.regular,
    color: Brand.chatDayPillText,
    letterSpacing: -0.1,
  },
});
