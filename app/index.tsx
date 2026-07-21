import { Redirect } from 'expo-router';
import type { Href } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useLicenseStore } from '@/stores/licenseStore';

export default function Index() {
  const isActivated = useLicenseStore((s) => s.isActivated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isActivated) {
    return <Redirect href={'/activate' as Href} />;
  }

  if (isAuthenticated) {
    return <Redirect href="/(app)" />;
  }

  return <Redirect href="/login" />;
}
