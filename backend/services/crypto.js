// Encrypts/decrypts AWS secret keys before they touch the database.
// The ENCRYPTION_KEY in .env is the only thing that can unlock them -
// without it, the encrypted column in Postgres is useless on its own.
// Generate a key with: openssl rand -hex 32
const crypto = require('crypto');
require('dotenv').config();

const ALGORITHM = 'aes-256-gcm';

const getKey = () => {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error('ENCRYPTION_KEY is missing or invalid in .env. It must be a 64-character hex string. Generate one with: openssl rand -hex 32');
  }
  return Buffer.from(key, 'hex');
};

const encrypt = (plainText) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
};

const decrypt = (payload) => {
  const [ivHex, authTagHex, dataHex] = payload.split(':');
  if (!ivHex || !authTagHex || !dataHex) {
    throw new Error('Stored credential is malformed or was encrypted with a different key.');
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
};

const maskAccessKey = (accessKeyId) => {
  if (!accessKeyId || accessKeyId.length < 8) return '****';
  return `${accessKeyId.slice(0, 4)}${'*'.repeat(accessKeyId.length - 8)}${accessKeyId.slice(-4)}`;
};

module.exports = { encrypt, decrypt, maskAccessKey };
