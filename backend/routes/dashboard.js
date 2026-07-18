const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/summary', async (req, res) => {
  try {
    const [accounts, projects, running, stopped, totalCost, recentActivity] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM aws_accounts'),
      pool.query('SELECT COUNT(*) FROM projects'),
      pool.query("SELECT COUNT(*) FROM projects WHERE status='running'"),
      pool.query("SELECT COUNT(*) FROM projects WHERE status='stopped'"),
      pool.query('SELECT COALESCE(SUM(monthly_cost), 0) AS total FROM projects'),
      pool.query(`
        SELECT a.action, a.details, a.created_at, p.name AS project_name
        FROM activity_logs a LEFT JOIN projects p ON p.id = a.project_id
        ORDER BY a.created_at DESC LIMIT 10
      `)
    ]);

    res.json({
      awsAccounts: parseInt(accounts.rows[0].count, 10),
      totalProjects: parseInt(projects.rows[0].count, 10),
      runningProjects: parseInt(running.rows[0].count, 10),
      stoppedProjects: parseInt(stopped.rows[0].count, 10),
      totalMonthlyCost: parseFloat(totalCost.rows[0].total),
      recentActivity: recentActivity.rows
    });
  } catch (err) {
    console.error('Error building dashboard summary:', err);
    res.status(500).json({ error: 'Failed to load dashboard summary' });
  }
});

module.exports = router;
