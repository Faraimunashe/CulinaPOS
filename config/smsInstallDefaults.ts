/**
 * Non-secret SMS defaults for this install.
 * API key lives in config/sms.secrets.ts (gitignored).
 */
export const SMS_INSTALL_DEFAULTS = {
  apiUrl: 'https://sms.localhost.co.zw/api/v1/sms/send/',
  sender: 'culinaPOS',
  recipient1: '+263783540959',
  recipient2: '',
} as const;

export const SMS_API_KEY_SECURE_KEY = 'culinapos_sms_api_key';
