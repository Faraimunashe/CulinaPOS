import { Redirect } from 'expo-router';
import { LoginScreen } from '@/screens/LoginScreen';
import { useAuthStore } from '@/stores/authStore';

export default function LoginRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (isAuthenticated) {
    return <Redirect href="/(app)" />;
  }

  return <LoginScreen />;
}
