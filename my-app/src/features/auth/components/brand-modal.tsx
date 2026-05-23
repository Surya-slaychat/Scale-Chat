import { Modal, Pressable, StyleSheet, View, type ViewProps } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = ViewProps & {
  visible: boolean;
  onRequestClose?: () => void;
  dismissOnBackdrop?: boolean;
};

export function BrandModal({
  visible,
  onRequestClose,
  dismissOnBackdrop = false,
  style,
  children,
  ...rest
}: Props) {
  const theme = useTheme();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onRequestClose}
      statusBarTranslucent>
      <Pressable
        style={styles.backdrop}
        onPress={() => {
          if (dismissOnBackdrop) onRequestClose?.();
        }}>
        <Pressable onPress={() => undefined}>
          <ThemedView
            style={[
              styles.card,
              {
                backgroundColor: theme.surfaceModal,
                borderColor: Brand.primary,
              },
              style,
            ]}
            {...rest}>
            {children}
          </ThemedView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 24,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.three,
  },
});

export const ModalSpacer = ({ size = Spacing.two }: { size?: number }) => (
  <View style={{ height: size }} />
);
