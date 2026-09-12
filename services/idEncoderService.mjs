import crypto from 'node:crypto';
import config from '../config.mjs';
import { InvalidError } from '../utils/errors.mjs';

const SECRET = config.obfuscation_key || config.token_secret;
if(!SECRET)
  throw new Error("Missing obfuscation key: set OBFUSCATION_KEY or TOKEN_SECRET"); 

const KEY = crypto.scryptSync(
  config.obfuscation_key || config.token_secret,
  config.obfuscation_salt || 'vakeo-salt',
  32
);

const algorithm = 'aes-256-gcm';

/**
 * Encodes an ID to hide it from URLs
 * @param {string} id
 * @returns {string} URL-safe encoded string (iv + authTag + ciphertext)
 */
export const encodeId = (id) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algorithm, KEY, iv);
  let encrypted = Buffer.concat([cipher.update(id, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString('base64url');
};

/**
 * Decodes an encoded ID back to original
 * @param {string} encoded
 * @returns {string} Original ID
 * @throws {Error} If authentication fails (tampered data)
 */
export const decodeId = (encoded) => {
  const combined = Buffer.from(encoded, 'base64url');
  const iv = combined.slice(0, 12);
  const authTag = combined.slice(12, 28);
  const ciphertext = combined.slice(28);
  const decipher = crypto.createDecipheriv(algorithm, KEY, iv);
  decipher.setAuthTag(authTag);
  let decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
};

/**
 * Resolve an encoded trip identifier (from a v3 URL) to the raw trip id.
 * Decodes via decodeId; on any failure (tampered, truncated, wrong key)
 * throws a clean InvalidError so the error middleware returns 422, not 500.
 * @param {string} encoded - base64url-encoded trip id from the URL
 * @returns {string} raw trip id (ObjectId string)
 */
export const resolveEncodedTripId = (encoded) => {
  try {
    return decodeId(encoded);
  } catch (err) {
    throw new InvalidError("Invalid or tampered trip identifier");
  }
};
