import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const derive = promisify(scrypt);
export async function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
  return `${salt}:${(await derive(password, salt, 64) as Buffer).toString('hex')}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [salt, expected] = stored.split(':');
  if (!salt || !expected || !/^[a-f0-9]{128}$/.test(expected)) return false;
  const actual = (await hashPassword(password, salt)).split(':')[1];
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex'));
}
