import * as settingsService from '@/services/settingsService';
import * as reportService from '@/services/reportService';
import {
  formatItemsSoldText,
  formatSalesSummaryText,
} from '@/services/salesSummaryText';
import * as smsSettingsService from '@/services/smsSettingsService';
import { writeAuditLog } from '@/services/auditService';

export interface SmsSendResult {
  status: 'sent' | 'partial' | 'failed' | 'skipped';
  message: string;
  results: {
    to: string;
    ok: boolean;
    error?: string;
    messagesSent?: number;
    smsCredits?: number;
  }[];
}

interface SmsApiSuccess {
  message_id?: string;
  channel?: string;
  status?: string;
  to?: string;
  sender?: string;
  sms_credits?: number;
  detail?: string;
  message?: string;
  error?: string;
}

async function postSms(input: {
  apiUrl: string;
  apiKey: string;
  to: string;
  sender: string;
  message: string;
}): Promise<{ smsCredits?: number }> {
  const response = await fetch(input.apiUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-API-KEY': input.apiKey,
    },
    body: JSON.stringify({
      to: input.to,
      sender: input.sender,
      message: input.message,
    }),
  });

  const raw = await response.text();
  let parsed: SmsApiSuccess = {};
  try {
    parsed = raw ? (JSON.parse(raw) as SmsApiSuccess) : {};
  } catch {
    parsed = {};
  }

  if (!response.ok) {
    throw new Error(
      parsed.detail ||
        parsed.message ||
        parsed.error ||
        `SMS API error (${response.status})`
    );
  }

  const status = (parsed.status || '').toLowerCase();
  if (status && status !== 'sent' && status !== 'queued' && status !== 'ok') {
    throw new Error(parsed.message || parsed.detail || `SMS status: ${status}`);
  }

  return { smsCredits: parsed.sms_credits };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * One button click → two SMS per recipient:
 * 1) Items sold
 * 2) Sales summary
 */
export async function sendSalesSummarySms(options?: {
  dateFrom?: string | null;
  dateTo?: string | null;
  cashierId?: number | null;
  currencyId?: number | null;
  actorId?: number | null;
}): Promise<SmsSendResult> {
  const settings = await smsSettingsService.getSmsSettings();
  if (!smsSettingsService.isSmsConfigured(settings)) {
    return {
      status: 'skipped',
      message:
        'SMS is not configured. Add API key, sender, and at least one recipient in Settings.',
      results: [],
    };
  }

  const apiKey = await smsSettingsService.getSmsApiKey();
  if (!apiKey) {
    return {
      status: 'skipped',
      message: 'SMS API key missing',
      results: [],
    };
  }

  const recipients = [
    smsSettingsService.normalizeSmsPhone(settings.recipient1),
    smsSettingsService.normalizeSmsPhone(settings.recipient2),
  ].filter((n, i, arr) => n.length >= 10 && arr.indexOf(n) === i);

  if (recipients.length === 0) {
    return {
      status: 'skipped',
      message: 'Add at least one valid recipient phone number',
      results: [],
    };
  }

  const filter = {
    dateFrom: options?.dateFrom,
    dateTo: options?.dateTo,
    cashierId: options?.cashierId,
    currencyId: options?.currencyId,
  };

  const [summary, products, restaurant] = await Promise.all([
    reportService.getDailyCloseSummary(filter),
    reportService.getProductSalesForRange(filter),
    settingsService.getRestaurantSettings(),
  ]);

  const name = restaurant.restaurantName;
  const itemsBody = formatItemsSoldText({
    restaurantName: name,
    dateFrom: summary.date_from,
    dateTo: summary.date_to,
    products,
  });
  const summaryBody = formatSalesSummaryText(summary, name);

  const results: SmsSendResult['results'] = [];

  for (const to of recipients) {
    let messagesSent = 0;
    let lastCredits: number | undefined;
    try {
      const first = await postSms({
        apiUrl: settings.apiUrl,
        apiKey,
        to,
        sender: settings.sender,
        message: itemsBody,
      });
      messagesSent = 1;
      lastCredits = first.smsCredits;
      await delay(350);
      const second = await postSms({
        apiUrl: settings.apiUrl,
        apiKey,
        to,
        sender: settings.sender,
        message: summaryBody,
      });
      messagesSent = 2;
      lastCredits = second.smsCredits ?? lastCredits;
      results.push({
        to,
        ok: true,
        messagesSent,
        smsCredits: lastCredits,
      });
    } catch (err) {
      results.push({
        to,
        ok: false,
        messagesSent,
        smsCredits: lastCredits,
        error: err instanceof Error ? err.message : 'Send failed',
      });
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  const msgCount = results.reduce((n, r) => n + (r.messagesSent ?? 0), 0);
  const credits = results.map((r) => r.smsCredits).find((c) => c != null);

  let status: SmsSendResult['status'] = 'failed';
  let message = 'SMS send failed';
  if (okCount === results.length) {
    status = 'sent';
    message = `Sent ${msgCount} SMS (items + summary) to ${okCount} recipient${okCount === 1 ? '' : 's'}${
      credits != null ? ` · ${credits} credits left` : ''
    }`;
  } else if (okCount > 0 || msgCount > 0) {
    status = 'partial';
    const failed = results.find((r) => !r.ok);
    message = `Partial SMS send (${msgCount} delivered). ${failed?.error ?? ''}`.trim();
  } else {
    message = results[0]?.error ?? 'SMS send failed';
  }

  if (options?.actorId != null) {
    await writeAuditLog({
      userId: options.actorId,
      action: 'SMS_SALES_SUMMARY_SEND',
      entityType: 'report',
      details: {
        status,
        recipients: results.map((r) => ({
          to: r.to,
          ok: r.ok,
          messagesSent: r.messagesSent,
        })),
        date_from: summary.date_from,
        date_to: summary.date_to,
      },
    });
  }

  return { status, message, results };
}
