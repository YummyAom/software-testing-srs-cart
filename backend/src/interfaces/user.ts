/** Profile stored in app_users, before mapping database values to the API. */
export interface AppUser {
  id: string;
  username: string;
  role: 'Admin' | 'Customer';
  memberTier: 'normal' | 'prime' | null;
}

export interface AuthUser {
  userId: string;
  email: string;
}

/** User returned by the Login API. */
export interface LoginUser extends AuthUser {
  username: string;
  role: 'admin' | 'customer';
  memberTier: 'free' | 'prime';
}

/** Authoritative user state according to SRS and OpenAPI. */
export interface UserState {
  userId: string;
  username: string;
  role: 'Customer' | 'Admin';
  memberTier: 'normal' | 'prime' | null;
  stage: 'cart' | 'checkout' | 'success' | null;
  currentOrderId: string | null;
}

