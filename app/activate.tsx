import { Redirect } from 'expo-router';
import { ActivateScreen } from '@/screens/ActivateScreen';
import { useLicenseStore } from '@/stores/licenseStore';

export default function ActivateRoute() {
  const isActivated = useLicenseStore((s) => s.isActivated);

  if (isActivated) {
    return <Redirect href="/login" />;
  }

  return <ActivateScreen />;
}
