import { Redirect } from 'expo-router';
import type { Href } from 'expo-router';
import { LoginScreen } from '@/screens/LoginScreen';
import { useAuthStore } from '@/stores/authStore';
import { useLicenseStore } from '@/stores/licenseStore';

export default function LoginRoute() {
  const isActivated = useLicenseStore((s) => s.isActivated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isActivated) {
    return <Redirect href={'/activate' as Href} />;
  }

  if (isAuthenticated) {
    return <Redirect href="/(app)" />;
  }

  return <LoginScreen />;
}
