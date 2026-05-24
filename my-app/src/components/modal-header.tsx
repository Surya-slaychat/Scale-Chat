import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { FontWeight, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';

type Props = {
  title: string;
  /** Right-side action button (e.g. "Save"). */
  trailing?: React.ReactNode;
};

/** Shared title bar for the (modals) stack. */
export function ModalHeader({ title, trailing }: Props) {
  const router = useRouter();
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => router.back()}
        accessibilityLabel="Close"
        hitSlop={8}
        style={({ pressed }) => [
          styles.btn,
          { backgroundColor: theme.surfaceMuted },
          pressed && { opacity: 0.7 },
        ]}>
        <Feather name="x" size={18} color={theme.text} />
      </Pressable>
      <ThemedText style={styles.title}>{title}</ThemedText>
      <View style={styles.trailing}>{trailing ?? <View style={styles.btn} />}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: FontWeight.semibold,
  },
  btn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trailing: {
    minWidth: 36,
    alignItems: 'flex-end',
  },
});
