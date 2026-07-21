export const APP_NAME = 'Culina POS';
export const DATABASE_NAME = 'culinapos.db';
export const SESSION_KEY = 'culinapos_session_user_id';
export const LICENSE_STORAGE_KEY = 'culinapos_license_activated';
export const LICENSE_PREFIX = '1999-03-16-FARIWE-';

export const DEFAULT_ADMIN = {
  fullName: 'System Administrator',
  username: 'admin',
  password: 'admin123',
} as const;

export const SETTINGS_KEYS = {
  restaurantName: 'restaurant_name',
  restaurantAddress: 'restaurant_address',
  restaurantPhone: 'restaurant_phone',
  primaryCurrencyId: 'primary_currency_id',
  licenseActivatedAt: 'license_activated_at',
  licenseKeyUsed: 'license_key_used',
} as const;
