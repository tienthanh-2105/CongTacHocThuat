import type { IncomingMessage, ServerResponse } from 'node:http';

export const SESSION_COOKIE = 'academic_session';
import type { SessionContext } from '../../business/auth/auth.types';
export type { CurrentUser, SessionContext } from '../../business/auth/auth.types';
export { tokenDigest } from '../../business/auth/token';
export interface AuthRequest extends IncomingMessage { ip?: string; auth?: SessionContext }

export function sessionToken(request: AuthRequest): string | undefined {
  const matches = (request.headers.cookie ?? '').split(';').map(part => part.trim()).filter(part => part.startsWith(`${SESSION_COOKIE}=`));
  if (matches.length !== 1) return undefined;
  const token = matches[0].slice(SESSION_COOKIE.length + 1);
  return /^[a-f0-9]{64}$/.test(token) ? token : undefined;
}
export function writeSessionCookie(response: ServerResponse, token: string, lifetimeSeconds: number, secure: boolean) {
  response.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${lifetimeSeconds}${secure ? '; Secure' : ''}`);
  response.setHeader('Cache-Control', 'no-store');
}
export function clearSessionCookie(response: ServerResponse, secure: boolean) { writeSessionCookie(response, '', 0, secure); }
