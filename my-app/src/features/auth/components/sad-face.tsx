import { StyleSheet, View } from 'react-native';

import { Brand } from '@/constants/theme';

/**
 * Stroke-style sad emoji used in the error modals (Figma 20:353 / 20:419).
 * Drawn from primitives so we don't depend on an asset.
 */
export function SadFace({ size = 88 }: { size?: number }) {
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, borderColor: Brand.accent },
      ]}>
      <View style={styles.features}>
        <View style={styles.eyesRow}>
          <View style={[styles.eye, { backgroundColor: Brand.accent }]} />
          <View style={[styles.eye, { backgroundColor: Brand.accent }]} />
        </View>
        <View style={[styles.mouth, { borderColor: Brand.accent }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  features: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  eyesRow: {
    flexDirection: 'row',
    gap: 16,
  },
  eye: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  mouth: {
    width: 28,
    height: 14,
    borderTopWidth: 0,
    borderLeftWidth: 2.5,
    borderRightWidth: 2.5,
    borderBottomWidth: 2.5,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    transform: [{ rotate: '180deg' }],
  },
});
