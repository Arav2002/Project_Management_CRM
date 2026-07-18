const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { getAccountCredentials } = require('../services/accountCredentials');
const { startInstance, stopInstance, rebootInstance, describeInstance } = require('../services/awsService');

const router = express.Router();
router.use(requireAuth);

// Every action here is driven by projectId only. The server looks up which
// AWS account that specific project belongs to and uses ONLY that account's
// credentials - the client never gets to specify which key pair to use,
// which is what prevents a mix-up across your multiple AWS accounts.
const getProjectAwsContext = async (projectId) => {
  const result = await pool.query(
    'SELECT id, name, instance_id, region, aws_account_id, status FROM projects WHERE id=$1',
    [projectId]
  );
  if (result.rows.length === 0) throw new Error('Project not found');
  const project = result.rows[0];
  if (!project.instance_id || !project.region) {
    throw new Error(`Project "${project.name}" has no EC2 instance ID / region set. Edit the project first.`);
  }
  if (!project.aws_account_id) {
    throw new Error(`Project "${project.name}" is not linked to an AWS account. Edit the project and select one.`);
  }
  const creds = await getAccountCredentials(project.aws_account_id);
  return { project, creds };
};

router.post('/toggle', async (req, res) => {
  const { projectId, action } = req.body;
  if (!projectId || !['start', 'stop', 'reboot'].includes(action)) {
    return res.status(400).json({ error: 'projectId and action(start/stop/reboot) are required' });
  }

  try {
    const { project, creds } = await getProjectAwsContext(projectId);

    if (action === 'start') await startInstance(creds, project.instance_id, project.region);
    else if (action === 'stop') await stopInstance(creds, project.instance_id, project.region);
    else await rebootInstance(creds, project.instance_id, project.region);

    // Ask AWS for the REAL state right after issuing the command, instead of
    // assuming "running"/"stopped" immediately. AWS itself reports a
    // transitional state here (pending, stopping) - that's what lets the UI
    // show the same in-between loading state the AWS Console shows, rather
    // than flipping instantly to a final state that hasn't actually happened yet.
    const details = await describeInstance(creds, project.instance_id, project.region);
    const newStatus = details?.state || (action === 'stop' ? 'stopping' : 'pending');
    const publicIp = details?.publicIp || null;

    await pool.query(
      'UPDATE projects SET status=$1, public_ip=$2, last_synced_at=NOW(), updated_at=NOW() WHERE id=$3',
      [newStatus, publicIp, projectId]
    );
    await pool.query(
      'INSERT INTO activity_logs (project_id, action, details) VALUES ($1, $2, $3)',
      [projectId, `ec2_${action}`, `Instance ${project.instance_id} in ${project.region}`]
    );

    res.json({ success: true, status: newStatus, publicIp });
  } catch (err) {
    console.error('Error controlling EC2 instance:', err);
    res.status(400).json({ error: err.message });
  }
});

router.get('/status', async (req, res) => {
  const { projectId } = req.query;
  if (!projectId) return res.status(400).json({ error: 'projectId is required' });

  try {
    const { project, creds } = await getProjectAwsContext(projectId);
    const details = await describeInstance(creds, project.instance_id, project.region);
    if (!details) return res.status(404).json({ error: 'Instance not found in AWS' });
    res.json(details);
  } catch (err) {
    console.error('Error fetching EC2 status:', err);
    res.status(400).json({ error: err.message });
  }
});

// Lightweight single-project sync, meant to be polled frequently (every few
// seconds) right after a start/stop action - reads the real AWS state +
// public IP and writes it straight to Postgres, so the badge in the UI can
// keep tracking AWS's own pending -> running / stopping -> stopped
// transition in near real time, the same way the AWS Console does.
router.post('/sync-one', async (req, res) => {
  const { projectId } = req.body;
  if (!projectId) return res.status(400).json({ error: 'projectId is required' });

  try {
    const { project, creds } = await getProjectAwsContext(projectId);
    const details = await describeInstance(creds, project.instance_id, project.region);
    if (!details) return res.status(404).json({ error: 'Instance not found in AWS' });

    await pool.query(
      'UPDATE projects SET status=$1, public_ip=$2, last_synced_at=NOW() WHERE id=$3',
      [details.state, details.publicIp, projectId]
    );

    res.json({ status: details.state, publicIp: details.publicIp });
  } catch (err) {
    console.error('Error syncing single instance:', err);
    res.status(400).json({ error: err.message });
  }
});

// Pulls live state for every project that has an instance + AWS account linked,
// and syncs Postgres status to match reality - useful if someone changed an
// instance directly in the AWS Console instead of through this dashboard.
router.post('/sync-all', async (req, res) => {
  try {
    const projects = await pool.query(
      `SELECT id, name, instance_id, region, aws_account_id FROM projects
       WHERE instance_id IS NOT NULL AND region IS NOT NULL AND aws_account_id IS NOT NULL`
    );

    const results = [];
    const credsCache = new Map();

    for (const project of projects.rows) {
      try {
        if (!credsCache.has(project.aws_account_id)) {
          credsCache.set(project.aws_account_id, await getAccountCredentials(project.aws_account_id));
        }
        const creds = credsCache.get(project.aws_account_id);
        const details = await describeInstance(creds, project.instance_id, project.region);
        if (!details) {
          results.push({ projectId: project.id, name: project.name, error: 'Instance not found in AWS' });
          continue;
        }
        await pool.query(
          'UPDATE projects SET status=$1, public_ip=$2, last_synced_at=NOW() WHERE id=$3',
          [details.state, details.publicIp, project.id]
        );
        results.push({ projectId: project.id, name: project.name, status: details.state });
      } catch (innerErr) {
        results.push({ projectId: project.id, name: project.name, error: innerErr.message });
      }
    }

    res.json({ synced: results.filter((r) => !r.error).length, results });
  } catch (err) {
    console.error('Error syncing all instances:', err);
    res.status(500).json({ error: 'Failed to sync instances' });
  }
});

module.exports = router;
