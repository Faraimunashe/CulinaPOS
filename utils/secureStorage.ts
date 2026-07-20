import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/** SecureStore is native-only; web uses in-memory storage. */
const webMemory = new Map<string, string>();

export async function setSecureItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    webMemory.set(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function getSecureItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return webMemory.get(key) ?? null;
  }
  return SecureStore.getItemAsync(key);
}

export async function deleteSecureItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    webMemory.delete(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
