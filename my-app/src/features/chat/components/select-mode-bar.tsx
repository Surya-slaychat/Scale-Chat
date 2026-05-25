import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, FontWeight, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  count: number;
  onCancel: () => void;
  onMarkRead: () => void;
  onFavourite: () => void;
  onArchive: () => void;
  busy?: boolean;
};

/**
 * Header replacement when the chat list is in select mode (Figma "Chat select
 * mode" — BRD §3.5). Mirrors the gradient header card so the page doesn't
 * jump as the mode toggles; only the inner content swaps.
 */
export function SelectModeBar({ count, onCancel, onMarkRead, onFavourite, onArchive, busy }: Props) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onCancel}
        accessibilityLabel="Exit select mode"
        style={({ pressed }) => [
          styles.iconBtn,
          { backgroundColor: theme.headerCardIconBg },
          pressed && { opacity: 0.7 },
        ]}>
        <Feather name="x" size={18} color={theme.headerCardText} />
      </Pressable>

      <ThemedText style={[styles.count, { color: theme.headerCardText }]}>
        {count} selected
      </ThemedText>

      <View style={styles.actions}>
        <ActionBtn icon="eye" label="Mark read" onPress={onMarkRead} disabled={busy || count === 0} />
        <ActionBtn icon="star" label="Favourite" onPress={onFavourite} disabled={busy || count === 0} />
        <ActionBtn icon="archive" label="Archive" onPress={onArchive} disabled={busy || count === 0} />
      </View>
    </View>
  );
}

function ActionBtn({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.actionBtn,
        { backgroundColor: theme.headerCardIconBg },
        pressed && { opacity: 0.7 },
        disabled && { opacity: 0.4 },
      ]}>
      <Feather name={icon} size={16} color={Brand.accent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: {
    flex: 1,
    fontSize: 16,
    fontWeight: FontWeight.semibold,
    letterSpacing: -0.2,
    marginLeft: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
