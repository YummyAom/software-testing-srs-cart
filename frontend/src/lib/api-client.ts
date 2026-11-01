export interface UserProfile {
  userId?: string;
  id?: string;
  username: string;
  email: string;
  role: 'admin' | 'customer';
  memberTier: 'free' | 'prime';
}

export interface LoginSession {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: UserProfile;
}

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

const BASE_URL = 'http://localhost:3001';

export async function loginApi(username: string, password: string): Promise<LoginSession> {
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });

  const json = await response.json();

  if (!response.ok) {
    const errorData = json.error || { code: 'UNKNOWN_ERROR', message: 'An unknown error occurred' };
    throw new ApiError(errorData.message, errorData.code, response.status);
  }

  return json.data as LoginSession;
}

export async function paySuccessApi(orderId: string): Promise<any> {
  const response = await fetch(`${BASE_URL}/orders/${orderId}/pay-success`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ result: 'success' }),
  });
  const json = await response.json();
  if (!response.ok) {
    const errorData = json.error || { code: 'UNKNOWN_ERROR', message: 'Payment failed' };
    throw new ApiError(errorData.message, errorData.code, response.status);
  }
  return json;
}

export async function payFailApi(orderId: string): Promise<any> {
  const response = await fetch(`${BASE_URL}/orders/${orderId}/pay-fail`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ result: 'fail' }),
  });
  const json = await response.json();
  if (!response.ok) {
    const errorData = json.error || { code: 'UNKNOWN_ERROR', message: 'Payment failed' };
    throw new ApiError(errorData.message, errorData.code, response.status);
  }
  return json;
}

export async function cancelCheckoutApi(token: string): Promise<any> {
  const response = await fetch(`${BASE_URL}/cart/checkout`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  const json = await response.json();
  if (!response.ok) {
    const errorData = json.error || { code: 'UNKNOWN_ERROR', message: 'Cancel checkout failed' };
    throw new ApiError(errorData.message, errorData.code, response.status);
  }
  return json;
}

export async function continueShoppingApi(token: string): Promise<any> {
  const response = await fetch(`${BASE_URL}/cart/continue`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  const json = await response.json();
  if (!response.ok) {
    const errorData = json.error || { code: 'UNKNOWN_ERROR', message: 'Continue shopping failed' };
    throw new ApiError(errorData.message, errorData.code, response.status);
  }
  return json;
}

export async function getAuthMeApi(token: string): Promise<any> {
  const response = await fetch(`${BASE_URL}/auth/me`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  const json = await response.json();
  if (!response.ok) {
    const errorData = json.error || { code: 'UNKNOWN_ERROR', message: 'Fetch profile failed' };
    throw new ApiError(errorData.message, errorData.code, response.status);
  }
  return json.data;
}
