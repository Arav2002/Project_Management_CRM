const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { getAccountCredentials } = require('../services/accountCredentials');
const { getMonthlyCost } = require('../services/awsService');
const { syncAllAccountsCost } = require('../services/costSync');

const router = express.Router();
router.use(requireAuth);

router.get('/project/:projectId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM billing_history WHERE project_id=$1 ORDER BY month DESC',
      [req.params.projectId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching billing history:', err);
    res.status(500).json({ error: 'Failed to fetch billing history' });
  }
});

router.post('/project/:projectId', async (req, res) => {
  const { month, amount, hosting, database, storage, other, notes } = req.body;
  if (!month || amount === undefined) {
    return res.status(400).json({ error: 'month and amount are required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO billing_history (project_id, month, amount, hosting, database, storage, other, source, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'manual',$8) RETURNING *`,
      [req.params.projectId, month, amount, hosting || 0, database || 0, storage || 0, other || 0, notes || '']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error adding billing entry:', err);
    res.status(500).json({ error: 'Failed to add billing entry' });
  }
});

router.delete('/:billingId', async (req, res) => {
  try {
    await pool.query('DELETE FROM billing_history WHERE id=$1', [req.params.billingId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting billing entry:', err);
    res.status(500).json({ error: 'Failed to delete billing entry' });
  }
});

// Live pull straight from a SPECIFIC AWS account's Cost Explorer - each of
// your 3 accounts gets its own real numbers, using that account's own keys.
// monthOffset: 0 = current month, -1 = last month, etc.
router.get('/aws-live/:accountId', async (req, res) => {
  const monthOffset = parseInt(req.query.monthOffset, 10) || 0;
  try {
    const creds = await getAccountCredentials(req.params.accountId);
    const data = await getMonthlyCost(creds, monthOffset);
    res.json(data);
  } catch (err) {
    console.error('Error fetching live AWS cost:', err);
    res.status(400).json({ error: err.message });
  }
});

// Manually triggers the same sync the nightly cron job runs, across ALL
// AWS accounts that have credentials configured - useful for testing
// right after wiring up keys instead of waiting until 2am.
router.post('/aws-sync-now', async (req, res) => {
  try {
    const result = await syncAllAccountsCost();
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Error running manual AWS sync:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/account/:accountId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM billing_history WHERE aws_account_id=$1 ORDER BY month DESC',
      [req.params.accountId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching account billing:', err);
    res.status(500).json({ error: 'Failed to fetch account billing' });
  }
});

module.exports = router;
