import type { ConvertedPrice } from '@/types';

export function formatMoney(amount: number, symbol = '$'): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `${symbol}${safe.toFixed(2)}`;
}

export function formatPrimaryPrice(prices: ConvertedPrice[] = []): string {
  const primary = prices.find((p) => p.is_primary) ?? prices[0];
  if (!primary) return 'No price';
  return formatMoney(primary.price, primary.currency_symbol);
}

export function formatConvertedPrices(prices: ConvertedPrice[] = []): string {
  if (!prices.length) return 'No price';
  const primary = prices.find((p) => p.is_primary);
  const others = prices.filter((p) => !p.is_primary);
  const ordered = primary ? [primary, ...others] : prices;
  return ordered
    .map((p) => formatMoney(p.price, p.currency_symbol || p.currency_name))
    .join(' · ');
}
