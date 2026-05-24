import { Tabs, useRouter } from 'expo-router';
import { useCallback } from 'react';

import { FloatingTabBar, type FloatingTabKey } from '@/components/floating-tab-bar';

/**
 * Custom JS Tabs layout for the Contact Page.
 *
 * Replaces the previous `NativeTabs` setup to match the Figma "Contact Page"
 * bottom bar (5 floating slots with a raised centre FAB). The FAB is not a
 * route — it shortcuts to the New-Chat modal so users get the primary action
 * with a single tap.
 */
export default function TabsLayout() {
  const router = useRouter();

  const renderTabBar = useCallback(
    ({ state, navigation }: { state: { routes: { name: string }[]; index: number }; navigation: { navigate: (name: string) => void } }) => {
      const activeRoute = state.routes[state.index]?.name ?? 'index';
      const active = routeToTabKey(activeRoute);

      return (
        <FloatingTabBar
          active={active}
          onSelect={(key) => {
            const target = tabKeyToRoute(key);
            navigation.navigate(target);
          }}
          onFabPress={() => router.push('/new-chat')}
        />
      );
    },
    [router]
  );

  return (
    <Tabs
      screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}
      tabBar={renderTabBar}>
      <Tabs.Screen name="index" options={{ title: 'Chats' }} />
      <Tabs.Screen name="calls" options={{ title: 'Calls' }} />
      <Tabs.Screen name="lists" options={{ title: 'Lists' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}

function routeToTabKey(routeName: string): FloatingTabKey {
  if (routeName === 'calls') return 'calls';
  if (routeName === 'lists') return 'lists';
  if (routeName === 'profile') return 'profile';
  return 'chats';
}

function tabKeyToRoute(key: FloatingTabKey): string {
  if (key === 'calls') return 'calls';
  if (key === 'lists') return 'lists';
  if (key === 'profile') return 'profile';
  return 'index';
}
