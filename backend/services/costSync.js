// Runs on a schedule (default: daily at 2am) and pulls the current month's
// cost from Cost Explorer for EVERY AWS account that has credentials saved -
// each account is billed with its own keys, so a 3-account setup produces
// 3 independent, correctly-attributed cost entries instead of one shared number.
const cron = require('node-cron');
const pool = require('../db/pool');
const { decrypt } = require('./crypto');
const { getMonthlyCost } = require('./awsService');

const syncAllAccountsCost = async () => {
  const accounts = await pool.query(
    `SELECT id, name, region, access_key_id, secret_access_key_encrypted
     FROM aws_accounts WHERE access_key_id IS NOT NULL AND secret_access_key_encrypted IS NOT NULL`
  );

  const results = [];

  for (const account of accounts.rows) {
    try {
      const creds = {
        accessKeyId: account.access_key_id,
        secretAccessKey: decrypt(account.secret_access_key_encrypted)
      };
      const { total, period } = await getMonthlyCost(creds, 0);
      const month = period.start.slice(0, 7);

      const existing = await pool.query(
        `SELECT id FROM billing_history
         WHERE aws_account_id=$1 AND month=$2 AND source='aws-sync' AND project_id IS NULL`,
        [account.id, month]
      );

      if (existing.rows.length > 0) {
        await pool.query(
          `UPDATE billing_history SET amount=$1, notes=$2 WHERE id=$3`,
          [total, 'Auto-synced from AWS Cost Explorer', existing.rows[0].id]
        );
      } else {
        await pool.query(
          `INSERT INTO billing_history (aws_account_id, month, amount, source, notes)
           VALUES ($1, $2, $3, 'aws-sync', 'Auto-synced from AWS Cost Explorer')`,
          [account.id, month, total]
        );
      }

      results.push({ accountId: account.id, name: account.name, total, month });
      console.log(`[cost-sync] "${account.name}" -> ${total} for ${month}`);
    } catch (err) {
      results.push({ accountId: account.id, name: account.name, error: err.message });
      console.error(`[cost-sync] Failed for "${account.name}":`, err.message);
    }
  }

  return { synced: results.filter((r) => !r.error).length, total: accounts.rows.length, results };
};

const startCostSyncSchedule = () => {
  const schedule = process.env.COST_SYNC_CRON || '0 2 * * *';
  cron.schedule(schedule, syncAllAccountsCost);
  console.log(`[cost-sync] Scheduled with cron pattern "${schedule}" across all AWS accounts with saved credentials`);
};

module.exports = { startCostSyncSchedule, syncAllAccountsCost };
