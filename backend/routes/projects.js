const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const { awsAccountId } = req.query;
  try {
    const result = awsAccountId
      ? await pool.query('SELECT * FROM projects WHERE aws_account_id=$1 ORDER BY created_at ASC', [awsAccountId])
      : await pool.query('SELECT * FROM projects ORDER BY created_at ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching projects:', err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM projects WHERE id=$1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching project:', err);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

router.post('/', async (req, res) => {
  const {
    name, client, type, awsAccountId, hostingProvider,
    instanceId, region, dbType, dbHost, url, repoUrl, monthlyCost, isStatic
  } = req.body;

  if (!name || !type) {
    return res.status(400).json({ error: 'name and type are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO projects
        (name, client, type, aws_account_id, hosting_provider, instance_id, region,
         db_type, db_host, url, repo_url, monthly_cost, is_static, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'stopped')
       RETURNING *`,
      [name, client || null, type, awsAccountId || null, hostingProvider || 'AWS',
       instanceId || null, region || null,
       isStatic ? null : (dbType || null), isStatic ? null : (dbHost || null),
       url || null, repoUrl || null, monthlyCost || 0, isStatic || false]
    );

    await pool.query(
      'INSERT INTO activity_logs (project_id, action, details) VALUES ($1, $2, $3)',
      [result.rows[0].id, 'project_created', `Project "${name}" created`]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating project:', err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    name, client, type, awsAccountId, hostingProvider, instanceId, region,
    dbType, dbHost, url, repoUrl, monthlyCost, isStatic
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE projects SET
        name=$1, client=$2, type=$3, aws_account_id=$4, hosting_provider=$5, instance_id=$6, region=$7,
        db_type=$8, db_host=$9, url=$10, repo_url=$11, monthly_cost=$12, is_static=$13, updated_at=NOW()
       WHERE id=$14 RETURNING *`,
      [name, client, type, awsAccountId, hostingProvider, instanceId, region,
       isStatic ? null : dbType, isStatic ? null : dbHost, url, repoUrl, monthlyCost, isStatic, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating project:', err);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM projects WHERE id=$1 RETURNING name', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting project:', err);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

router.get('/:id/activity', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM activity_logs WHERE project_id=$1 ORDER BY created_at DESC LIMIT 50',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching activity logs:', err);
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
});

module.exports = router;
