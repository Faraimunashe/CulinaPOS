import { Alert } from 'react-native';
import type { Order } from '@/types';
import * as printService from '@/services/printService';
import * as printerSettingsService from '@/services/printerSettingsService';
import type { PrintJobResult } from '@/services/printService';

export function askPrintRestaurantCopy(
  kind: 'first' | 'another' = 'first'
): Promise<boolean> {
  const title =
    kind === 'first' ? 'Restaurant copy?' : 'Another restaurant copy?';
  const message =
    kind === 'first'
      ? 'Customer receipt printed. Print the restaurant copy as well?'
      : 'Print a second restaurant copy?';

  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        {
          text: 'No',
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: 'Yes',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: false }
    );
  });
}

export interface ReceiptPrintSummary {
  customer: PrintJobResult;
  restaurant: PrintJobResult | null;
  restaurantCopies: PrintJobResult[];
  message: string;
}

function summarizeRestaurantPrints(copies: PrintJobResult[]): {
  restaurant: PrintJobResult | null;
  restaurantCopies: PrintJobResult[];
  kitchenMessage: string | null;
} {
  const printed = copies.filter((c) => c.status === 'printed').length;
  const failed = copies.find((c) => c.status !== 'printed');

  if (printed === 0 && failed) {
    return {
      restaurant: failed,
      restaurantCopies: copies,
      kitchenMessage: `restaurant copy failed: ${failed.reason ?? 'unknown'}`,
    };
  }

  if (printed === 0) {
    return {
      restaurant: null,
      restaurantCopies: copies,
      kitchenMessage: null,
    };
  }

  if (printed === 1 && !failed) {
    return {
      restaurant: copies[0] ?? null,
      restaurantCopies: copies,
      kitchenMessage: 'restaurant receipt printed',
    };
  }

  if (printed >= 2 && !failed) {
    return {
      restaurant: copies[copies.length - 1] ?? null,
      restaurantCopies: copies,
      kitchenMessage: '2 restaurant receipts printed',
    };
  }

  return {
    restaurant: failed ?? copies[copies.length - 1] ?? null,
    restaurantCopies: copies,
    kitchenMessage: `${printed} restaurant copy printed · one failed: ${
      failed?.reason ?? 'unknown'
    }`,
  };
}

/**
 * Asks for up to two restaurant copies (second only if setting enabled).
 * Each copy is confirmed before printing.
 */
export async function promptAndPrintRestaurantCopies(
  order: Order
): Promise<{
  restaurant: PrintJobResult | null;
  restaurantCopies: PrintJobResult[];
  kitchenMessage: string | null;
}> {
  const wantsFirst = await askPrintRestaurantCopy('first');
  if (!wantsFirst) {
    return {
      restaurant: null,
      restaurantCopies: [],
      kitchenMessage: null,
    };
  }

  const first = await printService.printRestaurantCopy(order, {
    force: true,
  });
  const restaurantCopies = [first];

  if (first.status !== 'printed') {
    return summarizeRestaurantPrints(restaurantCopies);
  }

  const settings = await printerSettingsService.getPrinterSettings();
  if (settings.offer_second_kitchen_copy !== 1) {
    return summarizeRestaurantPrints(restaurantCopies);
  }

  const wantsSecond = await askPrintRestaurantCopy('another');
  if (!wantsSecond) {
    return summarizeRestaurantPrints(restaurantCopies);
  }

  const second = await printService.printRestaurantCopy(order, {
    force: true,
  });
  restaurantCopies.push(second);

  return summarizeRestaurantPrints(restaurantCopies);
}

/**
 * Prints customer copy, then asks for restaurant copies (up to 2 when enabled).
 */
export async function printReceiptsWithPrompt(
  order: Order,
  options?: { force?: boolean }
): Promise<ReceiptPrintSummary> {
  const customer = await printService.printCustomerReceipt(order, options);

  if (customer.status !== 'printed') {
    return {
      customer,
      restaurant: null,
      restaurantCopies: [],
      message:
        customer.status === 'skipped'
          ? (customer.reason ?? 'Customer receipt not printed')
          : (customer.reason ?? 'Customer receipt failed'),
    };
  }

  const kitchen = await promptAndPrintRestaurantCopies(order);
  if (!kitchen.kitchenMessage) {
    return {
      customer,
      restaurant: null,
      restaurantCopies: kitchen.restaurantCopies,
      message: 'Customer receipt printed',
    };
  }

  if (kitchen.kitchenMessage.startsWith('restaurant copy failed')) {
    return {
      customer,
      restaurant: kitchen.restaurant,
      restaurantCopies: kitchen.restaurantCopies,
      message: `Customer printed · ${kitchen.kitchenMessage}`,
    };
  }

  if (kitchen.kitchenMessage.includes('failed')) {
    return {
      customer,
      restaurant: kitchen.restaurant,
      restaurantCopies: kitchen.restaurantCopies,
      message: `Customer printed · ${kitchen.kitchenMessage}`,
    };
  }

  return {
    customer,
    restaurant: kitchen.restaurant,
    restaurantCopies: kitchen.restaurantCopies,
    message: `Customer and ${kitchen.kitchenMessage}`,
  };
}
