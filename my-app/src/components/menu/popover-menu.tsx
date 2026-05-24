import { Feather } from '@expo/vector-icons';
import { useEffect, useState, type RefObject } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  type ColorValue,
  type View as ViewType,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FontWeight, Radius, Shadow, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type PopoverItem = {
  key: string;
  label: string;
  icon?: React.ComponentProps<typeof Feather>['name'];
  iconColor?: ColorValue;
  trailing?: React.ReactNode;
  destructive?: boolean;
  selected?: boolean;
  onPress: () => void;
};

type Placement = 'bottom-right' | 'bottom-left' | 'top-center';

type Props = {
  visible: boolean;
  onDismiss: () => void;
  anchorRef: RefObject<ViewType | null>;
  items: PopoverItem[];
  /**
   * Where the menu sits relative to its anchor.
   *  - bottom-right (default): card flows down + aligns right edge with the anchor's right edge.
   *  - bottom-left: card flows down + aligns left edges.
   *  - top-center: card sits above the anchor, horizontally centered (used by the FAB).
   */
  placement?: Placement;
  /** Override menu width. Defaults to 192. */
  width?: number;
};

type Rect = { x: number; y: number; w: number; h: number };

/**
 * Anchored pop-over menu. Measures the anchor's screen position and renders a
 * floating themed card with icon-label rows. Used by the Contact Page header
 * (3-dot, +), the floating FAB, and the Filter pill.
 */
export function PopoverMenu({
  visible,
  onDismiss,
  anchorRef,
  items,
  placement = 'bottom-right',
  width = 192,
}: Props) {
  const theme = useTheme();
  const [anchor, setAnchor] = useState<Rect | null>(null);

  useEffect(() => {
    if (!visible) return;
    const node = anchorRef.current;
    if (!node) return;
    node.measureInWindow((x, y, w, h) => setAnchor({ x, y, w, h }));
  }, [visible, anchorRef]);

  if (!visible || !anchor) {
    return (
      <Modal transparent animationType="none" visible={visible} onRequestClose={onDismiss}>
        <Pressable style={styles.backdrop} onPress={onDismiss} />
      </Modal>
    );
  }

  const position = computePosition(anchor, placement, width);

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <View
          style={[
            styles.card,
            {
              top: position.top,
              left: position.left,
              width,
              backgroundColor: theme.menuBackground,
              borderColor: theme.menuBorder,
            },
            Shadow.floating,
          ]}>
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            const labelColor = item.destructive ? theme.danger : theme.text;
            return (
              <Pressable
                key={item.key}
                onPress={() => {
                  onDismiss();
                  item.onPress();
                }}
                style={({ pressed }) => [
                  styles.row,
                  !isLast && { borderBottomColor: theme.menuBorder, borderBottomWidth: 0.5 },
                  pressed && { backgroundColor: theme.menuHover },
                ]}>
                {item.icon ? (
                  <Feather
                    name={item.icon}
                    size={16}
                    color={(item.iconColor as string | undefined) ?? labelColor}
                    style={styles.icon}
                  />
                ) : (
                  <View style={styles.icon} />
                )}
                <ThemedText style={[styles.label, { color: labelColor }]}>
                  {item.label}
                </ThemedText>
                {item.selected ? (
                  <Feather name="check" size={14} color={theme.text} />
                ) : (
                  item.trailing ?? null
                )}
              </Pressable>
            );
          })}
        </View>
      </Pressable>
    </Modal>
  );
}

function computePosition(anchor: Rect, placement: Placement, width: number) {
  const gap = 8;
  switch (placement) {
    case 'bottom-left':
      return { top: anchor.y + anchor.h + gap, left: anchor.x };
    case 'top-center':
      // Card sits above the anchor, centred — used by the FAB.
      // Caller is responsible for ensuring there's enough space above.
      return {
        top: Math.max(48, anchor.y - 220),
        left: Math.max(12, anchor.x + anchor.w / 2 - width / 2),
      };
    case 'bottom-right':
    default:
      return {
        top: anchor.y + anchor.h + gap,
        left: Math.max(12, anchor.x + anchor.w - width),
      };
  }
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  card: {
    position: 'absolute',
    borderRadius: Radius.card,
    borderWidth: 0.5,
    paddingVertical: Spacing.one,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    height: 44,
    gap: Spacing.two,
  },
  icon: {
    width: 18,
    height: 18,
    textAlign: 'center',
  },
  label: {
    flex: 1,
    fontSize: 14,
    fontWeight: FontWeight.medium,
  },
});
