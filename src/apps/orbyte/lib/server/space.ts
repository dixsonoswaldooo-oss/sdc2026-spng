// Demo spaces (database mode): every visitor gets their own copy of the demo data (one database row per space), so one
// judge can't change what the next one sees. Two devices share a space by opening /login?space=CODE or typing the code.
import { randomInt } from 'node:crypto';
import { cookies } from 'next/headers';

const COOKIE = 'esg-space';
const LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I/L: easy to read out and type

export const isSpaceCode = (v: unknown): v is string => typeof v === 'string' && /^[A-HJKMNP-Z2-9]{6}$/.test(v);
export const newSpaceCode = () => Array.from({ length: 6 }, () => LETTERS[randomInt(LETTERS.length)]).join('');

export async function enterSpace(code: string): Promise<string> {
  (await cookies()).set(COOKIE, code, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 30,
  });
  return code;
}

/** This visitor's space; a first visit gets a new one. */
export async function currentSpace(): Promise<string> {
  const code = (await cookies()).get(COOKIE)?.value;
  return isSpaceCode(code) ? code : enterSpace(newSpaceCode());
}
