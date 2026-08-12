import { formatMoney } from '@/utils/formatMoney';
import type {
  DailyCloseSummary,
  ProductSalesRow,
} from '@/services/reportService';

/** Soft cap per SMS body so the gateway accepts the message. */
const SMS_CHUNK_MAX = 1000;

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

function clampSms(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= SMS_CHUNK_MAX) return trimmed;
  return `${trimmed.slice(0, SMS_CHUNK_MAX - 3)}...`;
}

function formatDisplayDate(iso: string): string {
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!y || !m || !d || m < 1 || m > 12) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function formatPeriod(dateFrom: string, dateTo: string): string {
  if (dateFrom === dateTo) return formatDisplayDate(dateFrom);
  return `${formatDisplayDate(dateFrom)} - ${formatDisplayDate(dateTo)}`;
}

function divider(): string {
  // ASCII only — GSM/SMS gateways often turn Unicode box lines into "?"
  return '------------';
}

function money(amount: number, symbol = '$'): string {
  return formatMoney(amount, symbol);
}

function qtyLabel(qty: number): string {
  const n = Number(qty) || 0;
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function aggregatePayments(
  rows: {
    payment_method_name: string;
    total: number;
    order_count: number;
    currency_symbol?: string;
  }[]
): { name: string; total: number; order_count: number; symbol: string }[] {
  const map = new Map<
    string,
    { name: string; total: number; order_count: number; symbol: string }
  >();
  for (const row of rows) {
    const key = row.payment_method_name || 'Unknown';
    const existing = map.get(key);
    if (existing) {
      existing.total += Number(row.total) || 0;
      existing.order_count += Number(row.order_count) || 0;
    } else {
      map.set(key, {
        name: key,
        total: Number(row.total) || 0,
        order_count: Number(row.order_count) || 0,
        symbol: row.currency_symbol || '$',
      });
    }
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

function itemsHeaderLines(
  title: string,
  period: string,
  part: number,
  totalParts: number
): string[] {
  const label =
    totalParts > 1 ? `ITEMS SOLD (${part}/${totalParts})` : 'ITEMS SOLD';
  return [title, label, period, divider()];
}

function fitProductLine(line: string, maxLen: number): string {
  if (line.length <= maxLen) return line;
  if (maxLen <= 3) return line.slice(0, maxLen);
  return `${line.slice(0, maxLen - 3)}...`;
}

function packProductLines(
  productLines: string[],
  headerBudget: number,
  footerBudget: number
): string[][] {
  const bodyBudget = Math.max(24, SMS_CHUNK_MAX - headerBudget - footerBudget - 2);
  const chunks: string[][] = [];
  let current: string[] = [];
  let currentLen = 0;

  for (const raw of productLines) {
    const line = fitProductLine(raw, bodyBudget);
    const addLen = line.length + (current.length > 0 ? 1 : 0);
    if (current.length > 0 && currentLen + addLen > bodyBudget) {
      chunks.push(current);
      current = [line];
      currentLen = line.length;
    } else {
      current.push(line);
      currentLen += addLen;
    }
  }

  if (current.length > 0 || chunks.length === 0) {
    chunks.push(current);
  }
  return chunks;
}

/**
 * Items sold as one or more SMS bodies (split on whole product lines).
 * Totals appear only on the last part.
 */
export function formatItemsSoldChunks(input: {
  restaurantName?: string;
  dateFrom: string;
  dateTo: string;
  products: ProductSalesRow[];
}): string[] {
  const title = input.restaurantName?.trim() || 'Culina POS';
  const period = formatPeriod(input.dateFrom, input.dateTo);

  if (input.products.length === 0) {
    return [
      clampSms(
        [...itemsHeaderLines(title, period, 1, 1), 'No items sold in this period.'].join(
          '\n'
        )
      ),
    ];
  }

  let totalQty = 0;
  let salesTotal = 0;
  const productLines: string[] = [];

  for (const row of input.products) {
    const qty = Number(row.quantity) || 0;
    const lineTotal = Number(row.total) || 0;
    totalQty += qty;
    salesTotal += lineTotal;
    productLines.push(
      `${qtyLabel(qty)} x ${row.product_name} - ${money(lineTotal)}`
    );
  }

  const totalsFooter = [
    divider(),
    `${qtyLabel(totalQty)} units / ${input.products.length} product${
      input.products.length === 1 ? '' : 's'
    }`,
    `Items total - ${money(salesTotal)}`,
  ];
  const continuedFooterSample = [divider(), 'Continued in 99/99'];

  const headerBudget = itemsHeaderLines(title, period, 99, 99).join('\n').length;
  const footerBudget = Math.max(
    totalsFooter.join('\n').length,
    continuedFooterSample.join('\n').length
  );

  const lineChunks = packProductLines(productLines, headerBudget, footerBudget);
  const totalParts = lineChunks.length;

  return lineChunks.map((lines, index) => {
    const part = index + 1;
    const isLast = part === totalParts;
    const footer = isLast
      ? totalsFooter
      : [divider(), `Continued in ${part + 1}/${totalParts}`];
    return clampSms(
      [...itemsHeaderLines(title, period, part, totalParts), ...lines, ...footer].join(
        '\n'
      )
    );
  });
}

/** Single-string helper (joins chunks with a blank line). Prefer formatItemsSoldChunks for sending. */
export function formatItemsSoldText(input: {
  restaurantName?: string;
  dateFrom: string;
  dateTo: string;
  products: ProductSalesRow[];
}): string {
  return formatItemsSoldChunks(input).join('\n\n');
}

/**
 * Sales summary with payment methods (single-currency, no currency labels).
 */
export function formatSalesSummaryText(
  summary: DailyCloseSummary,
  restaurantName?: string
): string {
  const title = restaurantName?.trim() || 'Culina POS';
  const period = formatPeriod(summary.date_from, summary.date_to);
  const symbol = summary.by_currency[0]?.currency_symbol || '$';
  const lines: string[] = [];

  lines.push(title);
  lines.push('SALES SUMMARY');
  lines.push(period);
  lines.push(
    `${summary.order_count} order${summary.order_count === 1 ? '' : 's'}`
  );
  lines.push(divider());

  const cashiers = [
    ...new Map(
      summary.by_cashier.map((row) => [
        row.cashier_id,
        { id: row.cashier_id, name: row.cashier_name },
      ])
    ).values(),
  ];

  if (cashiers.length === 0) {
    lines.push('No completed sales in this period.');
    return clampSms(lines.join('\n'));
  }

  for (const cashier of cashiers) {
    const currencyRows = summary.by_cashier.filter(
      (r) => r.cashier_id === cashier.id
    );
    const paymentRows = aggregatePayments(
      summary.by_cashier_payment.filter((r) => r.cashier_id === cashier.id)
    );
    const cashierTotal = currencyRows.reduce(
      (sum, row) => sum + (Number(row.total) || 0),
      0
    );

    lines.push(cashier.name.toUpperCase());

    if (paymentRows.length === 0) {
      lines.push('No payments recorded');
    } else {
      for (const pay of paymentRows) {
        lines.push(
          `${pay.name} - ${money(pay.total, pay.symbol || symbol)} (${pay.order_count})`
        );
      }
    }

    lines.push(`Cashier total - ${money(cashierTotal, symbol)}`);
    lines.push(divider());
  }

  const overallPayments = aggregatePayments(summary.by_payment);
  if (overallPayments.length > 0 && cashiers.length > 1) {
    lines.push('ALL PAYMENTS');
    for (const pay of overallPayments) {
      lines.push(
        `${pay.name} - ${money(pay.total, pay.symbol || symbol)} (${pay.order_count})`
      );
    }
    lines.push(divider());
  }

  const grandTotal = summary.by_currency.reduce(
    (sum, row) => sum + (Number(row.total) || 0),
    0
  );
  lines.push(`GRAND TOTAL - ${money(grandTotal, symbol)}`);
  lines.push('Culina POS');

  return clampSms(lines.join('\n'));
}

export function formatSalesCloseText(
  summary: DailyCloseSummary,
  restaurantName?: string
): string {
  return formatSalesSummaryText(summary, restaurantName);
}
