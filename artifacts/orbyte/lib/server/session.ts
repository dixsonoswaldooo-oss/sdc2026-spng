// Who is signed in, for the database mode: an httpOnly cookie with the demo account id, signed so it can't be edited.
// Key: SESSION_SECRET if set, else derived from DATABASE_URL (secret too, and the same on every Replit server).
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { ACCOUNTS } from '../seed';
import type { Account } from '../types';

const COOKIE = 'esg-session';
const key = () => process.env.SESSION_SECRET || createHash('sha256').update(`esalary-session|${process.env.DATABASE_URL ?? ''}`).digest('hex');
const sign = (id: string) => createHmac('sha256', key()).update(id).digest('base64url');

/** "ACC-E1.<signature>" → the account, or null if missing or tampered with. */
export function accountFromToken(token: string | undefined): Account | null {
  if (!token) return null;
  const dot = token.lastIndexOf('.');
  const id = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(id));
  if (dot < 1 || given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return ACCOUNTS.find((a) => a.id === id) ?? null;
}

export async function currentAccount(): Promise<Account | null> {
  return accountFromToken((await cookies()).get(COOKIE)?.value);
}

export async function startSession(account: Account): Promise<void> {
  (await cookies()).set(COOKIE, `${account.id}.${sign(account.id)}`, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 12,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
