import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

function scryptAsync(password: string, salt: Buffer, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, keylen, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, saltB64, keyB64] = stored.split("$");
  if (alg !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const key = await scryptAsync(password, Buffer.from(saltB64, "base64"), expected.length);
  return timingSafeEqual(key, expected);
}

/** Hash usado para equalizar o tempo de resposta quando o e-mail não existe. */
export const DUMMY_HASH = hashPassword(randomBytes(16).toString("hex"));

export const newSessionToken = (): string => randomBytes(32).toString("base64url");
export const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");
