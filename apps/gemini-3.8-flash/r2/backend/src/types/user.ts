export type UserRole = 'customer' | 'employee';

export interface Address {
  recipient: string;
  zip_code: string;
  street: string;
  number: string;
  complement?: string | null;
  neighborhood: string;
  city: string;
  state: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  cpf?: string | null;
  phone?: string | null;
  address?: Address | null;
  created_at: string;
  updated_at: string;
}

export type SafeUser = Omit<User, 'password_hash'>;

export interface UpdateProfileInput {
  name: string;
  cpf?: string | null;
  phone?: string | null;
}

export interface UpdateAddressInput {
  recipient: string;
  zip_code: string;
  street: string;
  number: string;
  complement?: string | null;
  neighborhood: string;
  city: string;
  state: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface AuthTokenPayload {
  userId: number;
  email: string;
}
