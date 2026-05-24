import { Stack } from 'expo-router';

import { Brand } from '@/constants/theme';

export default function ChatLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Brand.chatBody },
        animation: 'slide_from_right',
      }}
    />
  );
}
