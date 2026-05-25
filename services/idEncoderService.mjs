import crypto from 'node:crypto';
import config from '../config.mjs';

const KEY = crypto.scryptSync(
  config.obfuscation_key || config.token_secret,
  config.obfuscation_salt || 'vakeo-salt',
  32
);
const IV = Buffer.alloc(16, 0);

const algorithm = 'aes-256-cbc';

/**
 * Encodes an ID to hide it from URLs
 * @param {string} id 
 * @returns {string} URL-safe encoded string
 */
export const encodeId = (id) => {
  const cipher = crypto.createCipheriv(algorithm, KEY, IV);
  let encrypted = cipher.update(id, 'utf8', 'base64url');
  encrypted += cipher.final('base64url');
  return encrypted;
};

/**
 * Decodes an encoded ID back to original
 * @param {string} encoded 
 * @returns {string} Original ID
 */
export const decodeId = (encoded) => {
  const decipher = crypto.createDecipheriv(algorithm, KEY, IV);
  let decrypted = decipher.update(encoded, 'base64url', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};
