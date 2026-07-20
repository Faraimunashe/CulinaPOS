export type UserRole = 'ADMIN' | 'CASHIER';

export type UserStatus = 'ACTIVE' | 'DISABLED';

export interface User {
  id: number;
  full_name: string;
  username: string;
  password_hash: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export type SafeUser = Omit<User, 'password_hash'>;

export interface AuthSession {
  userId: number;
}
