import { Alert } from 'react-native';
import type { Order } from '@/types';
import * as printService from '@/services/printService';
import type { PrintJobResult } from '@/services/printService';

export function askPrintRestaurantCopy(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      'Restaurant copy?',
      'Customer receipt printed. Print the restaurant copy as well?',
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
  message: string;
}

/**
 * Prints customer copy, then asks whether to print the restaurant copy.
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
      message:
        customer.status === 'skipped'
          ? (customer.reason ?? 'Customer receipt not printed')
          : (customer.reason ?? 'Customer receipt failed'),
    };
  }

  const wantsRestaurant = await askPrintRestaurantCopy();
  if (!wantsRestaurant) {
    return {
      customer,
      restaurant: null,
      message: 'Customer receipt printed',
    };
  }

  const restaurant = await printService.printRestaurantCopy(order, {
    force: true,
  });

  if (restaurant.status === 'printed') {
    return {
      customer,
      restaurant,
      message: 'Customer and restaurant receipts printed',
    };
  }

  return {
    customer,
    restaurant,
    message: `Customer printed · restaurant copy failed: ${
      restaurant.reason ?? 'unknown'
    }`,
  };
}
