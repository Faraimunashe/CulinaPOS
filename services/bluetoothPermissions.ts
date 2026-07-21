import { Linking, PermissionsAndroid, Platform } from 'react-native';

function isGranted(
  results: Record<string, string>,
  permission: string
): boolean {
  return results[permission] === PermissionsAndroid.RESULTS.GRANTED;
}

/**
 * Android 12+ requires runtime Nearby Devices permissions before scanning
 * or connecting. Older Android needs location permission for Bluetooth scans.
 */
export async function ensureBluetoothPermissions(): Promise<void> {
  if (Platform.OS !== 'android') return;

  const apiLevel =
    typeof Platform.Version === 'number'
      ? Platform.Version
      : Number(Platform.Version);

  if (apiLevel >= 31) {
    const scan = PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN;
    const connect = PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT;
    const location = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;

    const already = await Promise.all([
      PermissionsAndroid.check(scan),
      PermissionsAndroid.check(connect),
      PermissionsAndroid.check(location),
    ]);

    if (already.every(Boolean)) return;

    const results = await PermissionsAndroid.requestMultiple([
      scan,
      connect,
      location,
    ]);

    const missing: string[] = [];
    if (!isGranted(results, scan)) missing.push('Nearby devices (scan)');
    if (!isGranted(results, connect)) missing.push('Nearby devices (connect)');
    if (!isGranted(results, location)) missing.push('Location');

    if (missing.length > 0) {
      const permanentlyDenied = Object.values(results).some(
        (value) => value === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
      );
      throw new Error(
        permanentlyDenied
          ? `Bluetooth permission denied. Enable ${missing.join(
              ', '
            )} in system Settings for Culina POS.`
          : `Bluetooth permission required: allow ${missing.join(
              ', '
            )} to find and connect printers.`
      );
    }
    return;
  }

  const location = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
  if (await PermissionsAndroid.check(location)) return;

  const result = await PermissionsAndroid.request(location, {
    title: 'Bluetooth printer access',
    message:
      'Culina POS needs location permission to scan for nearby Bluetooth printers.',
    buttonPositive: 'Allow',
    buttonNegative: 'Deny',
  });

  if (result !== PermissionsAndroid.RESULTS.GRANTED) {
    throw new Error(
      result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
        ? 'Location permission denied. Enable Location for Culina POS in system Settings to scan printers.'
        : 'Location permission is required to scan for Bluetooth printers.'
    );
  }
}

export async function openAppPermissionSettings(): Promise<void> {
  await Linking.openSettings();
}
