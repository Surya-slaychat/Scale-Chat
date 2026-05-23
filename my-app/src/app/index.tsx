import { Redirect } from 'expo-router';

import { useAuth } from '@/features/auth/hooks/use-auth';

export default function Index() {
  const { isAuthenticated, hasVerifiedPhone } = useAuth();

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }
  if (hasVerifiedPhone) {
    // User verified phone but hasn't completed profile yet — resume mid-onboarding.
    return <Redirect href="/profile" />;
  }
  return <Redirect href="/welcome" />;
}
