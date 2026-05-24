import { Stack } from 'expo-router';

/**
 * Modals group — presents create / picker screens above the tab bar.
 * Per Expo Router v56, `presentation: 'modal'` ships a native sheet on iOS and
 * an over-the-stack overlay on Android / web.
 */
export default function ModalsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: 'modal',
        animation: 'slide_from_bottom',
      }}>
      <Stack.Screen name="new-chat" />
      <Stack.Screen name="add-contact" />
      <Stack.Screen name="create-group" />
      <Stack.Screen name="create-super-group" />
    </Stack>
  );
}
