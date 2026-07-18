const pool = require('../db/pool');
const { decrypt } = require('./crypto');

// Every AWS call in this app goes through here first. It looks up the ONE
// account requested (by its Postgres id) and decrypts ONLY that account's
// secret key - so an EC2 action against Account 2 can never accidentally
// run using Account 1 or Account 3's credentials.
const getAccountCredentials = async (awsAccountId) => {
  if (!awsAccountId) {
    throw new Error('No AWS account is linked. Open the project and select an AWS account first.');
  }

  const result = await pool.query(
    'SELECT id, name, access_key_id, secret_access_key_encrypted, region FROM aws_accounts WHERE id=$1',
    [awsAccountId]
  );

  if (result.rows.length === 0) {
    throw new Error('AWS account not found.');
  }

  const account = result.rows[0];
  if (!account.access_key_id || !account.secret_access_key_encrypted) {
    throw new Error(`AWS account "${account.name}" has no credentials configured yet. Edit the account and add its Access Key ID / Secret Access Key.`);
  }

  return {
    accessKeyId: account.access_key_id,
    secretAccessKey: decrypt(account.secret_access_key_encrypted),
    defaultRegion: account.region
  };
};

module.exports = { getAccountCredentials };
