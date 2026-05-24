import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand, FontWeight, Radius, Shadow, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';

export type FloatingTabKey = 'calls' | 'lists' | 'chats' | 'profile';

export type FloatingTabBarProps = {
  active: FloatingTabKey;
  onSelect: (key: FloatingTabKey) => void;
  onFabPress: () => void;
};

type SlotConfig = {
  key: FloatingTabKey;
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
};

const SLOTS_LEFT: SlotConfig[] = [
  { key: 'calls', icon: 'phone', label: 'Calls' },
  { key: 'lists', icon: 'list', label: 'Lists' },
];

const SLOTS_RIGHT: SlotConfig[] = [
  { key: 'chats', icon: 'message-circle', label: 'Chats' },
  { key: 'profile', icon: 'user', label: 'Profile' },
];

/**
 * Floating 5-slot pill tab bar — Figma "Contact Page" bottom bar.
 *   [ Calls ][ Lists ]( + )[ Chats ][ Profile ]
 * The centre FAB is raised, has a lime ring, and triggers `onFabPress` rather
 * than navigating — wired by the parent layout to open the New-Chat popover.
 */
export function FloatingTabBar({ active, onSelect, onFabPress }: FloatingTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View pointerEvents="box-none" style={[styles.host, { bottom: insets.bottom + Spacing.three }]}>
      <View
        style={[
          styles.bar,
          { backgroundColor: theme.tabBarBackground },
          Shadow.floating,
        ]}>
        <View style={styles.cluster}>
          {SLOTS_LEFT.map((slot) => (
            <Slot
              key={slot.key}
              slot={slot}
              active={slot.key === active}
              onPress={() => onSelect(slot.key)}
            />
          ))}
        </View>

        <View style={styles.cluster}>
          {SLOTS_RIGHT.map((slot) => (
            <Slot
              key={slot.key}
              slot={slot}
              active={slot.key === active}
              onPress={() => onSelect(slot.key)}
            />
          ))}
        </View>
      </View>

      {/* Status dots flanking the FAB. */}
      <View pointerEvents="none" style={[styles.dot, styles.dotLeft, { backgroundColor: theme.onlineDot }]} />
      <View pointerEvents="none" style={[styles.dot, styles.dotRight, { backgroundColor: theme.onlineDot }]} />

      <View pointerEvents="box-none" style={styles.fabWrap}>
        <Pressable
          accessibilityLabel="New chat"
          accessibilityRole="button"
          onPress={onFabPress}
          style={({ pressed }) => [
            styles.fabRing,
            { borderColor: Brand.accent },
            pressed && { transform: [{ scale: 0.96 }] },
          ]}>
          <View style={[styles.fab, { backgroundColor: theme.tabBarFAB }]}>
            <Feather name="plus" size={22} color="#FFFFFF" />
          </View>
        </Pressable>
      </View>
    </View>
  );
}

type SlotProps = {
  slot: SlotConfig;
  active: boolean;
  onPress: () => void;
};

function Slot({ slot, active, onPress }: SlotProps) {
  const theme = useTheme();
  const color = active ? theme.tabBarIconActive : theme.tabBarIcon;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={slot.label}
      style={({ pressed }) => [styles.slot, pressed && { opacity: 0.7 }]}>
      <Feather name={slot.icon} size={20} color={color} />
      <ThemedText style={[styles.slotLabel, { color }]} numberOfLines={1}>
        {slot.label}
      </ThemedText>
    </Pressable>
  );
}

const BAR_HEIGHT = 64;
const FAB_SIZE = 56;

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  bar: {
    flexDirection: 'row',
    width: '88%',
    height: BAR_HEIGHT,
    borderRadius: Radius.bubblePill,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    width: '38%',
    justifyContent: 'space-around',
  },
  slot: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    gap: 2,
  },
  slotLabel: {
    fontSize: 10,
    fontWeight: FontWeight.medium,
  },
  fabWrap: {
    position: 'absolute',
    top: -FAB_SIZE / 2 + Spacing.one,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabRing: {
    width: FAB_SIZE + 10,
    height: FAB_SIZE + 10,
    borderRadius: (FAB_SIZE + 10) / 2,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: BAR_HEIGHT / 2 - 4,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotLeft: {
    left: '40%',
  },
  dotRight: {
    right: '40%',
  },
});
