import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { listLowStockItemsForOrder } from '@/services/inventoryService';
import type { InventoryItem } from '@/types';

const LOW_STOCK_CHANNEL_ID = 'low-stock-alerts';

type NotificationsModule = typeof import('expo-notifications');

let notificationsModule: NotificationsModule | null | undefined;
let handlerConfigured = false;

function isNotificationsNativeAvailable(): boolean {
  // Package entry loads ExpoPushTokenManager; without it, import throws.
  return requireOptionalNativeModule('ExpoPushTokenManager') != null;
}

async function getNotifications(): Promise<NotificationsModule | null> {
  if (notificationsModule !== undefined) {
    return notificationsModule;
  }

  if (Platform.OS === 'web' || !isNotificationsNativeAvailable()) {
    notificationsModule = null;
    return null;
  }

  try {
    notificationsModule = await import('expo-notifications');
    return notificationsModule;
  } catch {
    notificationsModule = null;
    return null;
  }
}

async function configureHandler(Notifications: NotificationsModule): Promise<void> {
  if (handlerConfigured) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  handlerConfigured = true;
}

async function ensureNotificationPermission(
  Notifications: NotificationsModule
): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(LOW_STOCK_CHANNEL_ID, {
      name: 'Low stock alerts',
      description:
        'Alerts when a sale leaves inventory at or below its alert level.',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250],
      lightColor: '#C1121F',
      sound: 'default',
    });
  }

  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;

  const requested = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: false,
      allowSound: true,
    },
  });
  return requested.granted;
}

function describeItem(item: InventoryItem): string {
  if (item.quantity <= 0) {
    return `${item.name} is out of stock`;
  }
  return `${item.name}: ${item.quantity} ${item.unit} left`;
}

/**
 * Sends an immediate local notification for low-stock inventory touched by
 * this sale. Notification failures never affect a completed order.
 */
export async function notifyLowStockForOrder(orderId: number): Promise<boolean> {
  try {
    const items = await listLowStockItemsForOrder(orderId);
    if (items.length === 0) return false;

    const Notifications = await getNotifications();
    if (!Notifications) return false;

    await configureHandler(Notifications);
    if (!(await ensureNotificationPermission(Notifications))) return false;

    const visibleItems = items.slice(0, 3);
    const remainder = items.length - visibleItems.length;
    const body = `${visibleItems.map(describeItem).join(' · ')}${
      remainder > 0 ? ` · +${remainder} more` : ''
    }`;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: items.length === 1 ? 'Low stock alert' : 'Low stock alerts',
        body,
        sound: 'default',
        color: '#C1121F',
        data: {
          type: 'LOW_STOCK',
          orderId,
          inventoryItemIds: items.map((item) => item.id),
        },
      },
      trigger:
        Platform.OS === 'android'
          ? {
              type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
              seconds: 1,
              channelId: LOW_STOCK_CHANNEL_ID,
            }
          : null,
    });
    return true;
  } catch {
    return false;
  }
}
