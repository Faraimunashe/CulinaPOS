import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';

export function useRequireAdmin(): boolean {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    if (user && !isAdmin) {
      router.replace('/(app)');
    }
  }, [user, isAdmin, router]);

  return isAdmin;
}
