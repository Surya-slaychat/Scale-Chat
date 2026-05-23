import { Stack } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';

export default function SetupLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
        animation: 'slide_from_right',
      }}>
      <Stack.Screen name="welcome" options={{ gestureEnabled: false }} />
      <Stack.Screen name="terms" />
      <Stack.Screen name="phone" />
      <Stack.Screen name="otp" />
      <Stack.Screen name="profile" />
      <Stack.Screen
        name="complete"
        options={{ presentation: 'transparentModal', animation: 'fade', gestureEnabled: false }}
      />
    </Stack>
  );
}
