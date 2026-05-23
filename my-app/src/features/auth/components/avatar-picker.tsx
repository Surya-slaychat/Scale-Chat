import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  uri?: string;
  onPicked: (uri: string) => void;
  label?: string;
};

export function AvatarPicker({ uri, onPicked, label }: Props) {
  const theme = useTheme();

  async function pick() {
    Haptics.selectionAsync().catch(() => undefined);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Photo permission needed',
        'Allow photo library access in Settings to add a profile picture.'
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset?.uri) return;
    onPicked(asset.uri);
  }

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={pick}
        style={[styles.circle, { backgroundColor: theme.surfaceMuted }]}
        accessibilityRole="button"
        accessibilityLabel={label ?? 'Add profile picture'}>
        {uri ? (
          <Image source={{ uri }} style={styles.image} contentFit="cover" />
        ) : (
          <Feather name="user" size={48} color={theme.inputPlaceholder} />
        )}
      </Pressable>
      {label ? (
        <ThemedText style={[styles.label, { color: theme.textSecondary }]}>{label}</ThemedText>
      ) : null}
      {uri ? (
        <View style={[styles.editBadge, { backgroundColor: Brand.primary }]} pointerEvents="none">
          <Feather name="edit-2" size={12} color="#FFFFFF" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: Spacing.two,
    position: 'relative',
  },
  circle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: 96,
    height: 96,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
  editBadge: {
    position: 'absolute',
    right: '32%',
    top: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
