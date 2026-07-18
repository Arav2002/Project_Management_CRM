const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { encrypt, maskAccessKey } = require('../services/crypto');
const { getAccountCredentials } = require('../services/accountCredentials');
const { verifyCredentials } = require('../services/awsService');

const router = express.Router();
router.use(requireAuth);

// Shapes a DB row for the frontend - never sends the encrypted secret back,
// only a masked preview of the access key and whether credentials exist at all.
const toSafeAccount = (row) => ({
  id: row.id,
  name: row.name,
  account_label: row.account_label,
  region: row.region,
  environment: row.environment,
  monthly_budget: row.monthly_budget,
  has_credentials: Boolean(row.access_key_id && row.secret_access_key_encrypted),
  access_key_preview: row.access_key_id ? maskAccessKey(row.access_key_id) : null,
  credentials_verified_at: row.credentials_verified_at,
  project_count: row.project_count !== undefined ? Number(row.project_count) : undefined,
  total_monthly_cost: row.total_monthly_cost !== undefined ? Number(row.total_monthly_cost) : undefined,
  created_at: row.created_at,
  updated_at: row.updated_at
});

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*,
        COALESCE(p.project_count, 0) AS project_count,
        COALESCE(p.total_monthly_cost, 0) AS total_monthly_cost
      FROM aws_accounts a
      LEFT JOIN (
        SELECT aws_account_id, COUNT(*) AS project_count, SUM(monthly_cost) AS total_monthly_cost
        FROM projects GROUP BY aws_account_id
      ) p ON p.aws_account_id = a.id
      ORDER BY a.created_at ASC
    `);
    res.json(result.rows.map(toSafeAccount));
  } catch (err) {
    console.error('Error fetching AWS accounts:', err);
    res.status(500).json({ error: 'Failed to fetch AWS accounts' });
  }
});

router.post('/', async (req, res) => {
  const { name, accountLabel, region, environment, monthlyBudget, accessKeyId, secretAccessKey } = req.body;
  if (!name || !accountLabel || !region) {
    return res.status(400).json({ error: 'name, accountLabel and region are required' });
  }

  try {
    const encryptedSecret = secretAccessKey ? encrypt(secretAccessKey) : null;

    const result = await pool.query(
      `INSERT INTO aws_accounts
        (name, account_label, region, environment, monthly_budget, access_key_id, secret_access_key_encrypted)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, accountLabel, region, environment || 'Production', monthlyBudget || 0,
       accessKeyId || null, encryptedSecret]
    );
    res.status(201).json(toSafeAccount(result.rows[0]));
  } catch (err) {
    console.error('Error creating AWS account:', err);
    res.status(500).json({ error: err.message.includes('ENCRYPTION_KEY') ? err.message : 'Failed to create AWS account' });
  }
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, accountLabel, region, environment, monthlyBudget, accessKeyId, secretAccessKey } = req.body;

  try {
    // Only overwrite credentials if the person actually typed a new secret key.
    // Leaving the secret field blank in the edit form keeps the existing one.
    let query, params;
    if (secretAccessKey) {
      const encryptedSecret = encrypt(secretAccessKey);
      query = `UPDATE aws_accounts SET
        name=$1, account_label=$2, region=$3, environment=$4, monthly_budget=$5,
        access_key_id=$6, secret_access_key_encrypted=$7, credentials_verified_at=NULL, updated_at=NOW()
       WHERE id=$8 RETURNING *`;
      params = [name, accountLabel, region, environment, monthlyBudget, accessKeyId || null, encryptedSecret, id];
    } else {
      query = `UPDATE aws_accounts SET
        name=$1, account_label=$2, region=$3, environment=$4, monthly_budget=$5,
        access_key_id=COALESCE($6, access_key_id), updated_at=NOW()
       WHERE id=$7 RETURNING *`;
      params = [name, accountLabel, region, environment, monthlyBudget, accessKeyId || null, id];
    }

    const result = await pool.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Account not found' });
    res.json(toSafeAccount(result.rows[0]));
  } catch (err) {
    console.error('Error updating AWS account:', err);
    res.status(500).json({ error: err.message.includes('ENCRYPTION_KEY') ? err.message : 'Failed to update AWS account' });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const projectCheck = await pool.query('SELECT COUNT(*) FROM projects WHERE aws_account_id=$1', [id]);
    if (parseInt(projectCheck.rows[0].count, 10) > 0) {
      return res.status(400).json({ error: 'Cannot delete an account with existing projects. Remove or reassign them first.' });
    }
    await pool.query('DELETE FROM aws_accounts WHERE id=$1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting AWS account:', err);
    res.status(500).json({ error: 'Failed to delete AWS account' });
  }
});

// Tests THIS SPECIFIC account's stored credentials against AWS STS.
// Use this right after pasting in keys to confirm they work before
// wiring any projects to real EC2 instances.
router.post('/:id/test-connection', async (req, res) => {
  try {
    const creds = await getAccountCredentials(req.params.id);
    const identity = await verifyCredentials(creds, creds.defaultRegion);
    await pool.query('UPDATE aws_accounts SET credentials_verified_at=NOW() WHERE id=$1', [req.params.id]);
    res.json({ connected: true, ...identity });
  } catch (err) {
    console.error('Error testing AWS account connection:', err);
    res.status(400).json({ connected: false, error: err.message });
  }
});

module.exports = router;
