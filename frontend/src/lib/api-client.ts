export interface UserProfile {
  userId?: string;
  id?: string;
  username: string;
  email: string;
  role: 'admin' | 'customer';
  memberTier: 'free' | 'prime';
}

export interface LoginSession {
  access_token: string;
  refresh_token: string;
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

export async function loginApi(email: string, password: string): Promise<LoginSession> {
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  const json = await response.json();

  if (!response.ok) {
    const errorData = json.error || { code: 'UNKNOWN_ERROR', message: 'An unknown error occurred' };
    throw new ApiError(errorData.message, errorData.code, response.status);
  }

  return json.data as LoginSession;
}
