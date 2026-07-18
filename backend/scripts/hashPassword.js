// Usage: node scripts/hashPassword.js "yourPassword"
// Copy the printed hash into ADMIN_PASSWORD_HASH in your .env
const crypto = require('crypto');

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/hashPassword.js "yourPassword"');
  process.exit(1);
}

const hash = crypto.createHash('sha256').update(password).digest('hex');
console.log('\nAdd this to your .env file:\n');
console.log(`ADMIN_PASSWORD_HASH=${hash}\n`);
