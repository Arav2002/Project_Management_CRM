import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  getAwsAccounts, getProjects, deleteProject, toggleEc2, syncAllInstances, syncSingleInstance
} from '../api/endpoints';
import ProjectModal from '../components/ProjectModal';
import BillingModal from '../components/BillingModal';
import '../styles/projects.css';

// How often to silently re-check real AWS state while this page is open.
const AUTO_SYNC_INTERVAL_MS = 25000;

// How often to poll a SINGLE project right after you click ON/OFF, so the
// badge tracks AWS's own pending -> running / stopping -> stopped
// transition instead of jumping straight to the end state.
const TRANSITION_POLL_MS = 3500;
// Give up polling after this long (AWS transitions are usually well under this).
const TRANSITION_POLL_TIMEOUT_MS = 120000;

// AWS's own instance-state vocabulary, mapped to a badge style + human label.
const STATE_META = {
  running: { label: 'running', badge: 'pms-badge-running', spinning: false },
  stopped: { label: 'stopped', badge: 'pms-badge-stopped', spinning: false },
  pending: { label: 'starting…', badge: 'pms-badge-warning', spinning: true },
  stopping: { label: 'stopping…', badge: 'pms-badge-warning', spinning: true },
  'shutting-down': { label: 'shutting down…', badge: 'pms-badge-warning', spinning: true },
  terminated: { label: 'terminated', badge: 'pms-badge-stopped', spinning: false }
};
const getStateMeta = (status) => STATE_META[status] || { label: status || 'unknown', badge: 'pms-badge-warning', spinning: false };
const isTransitional = (status) => Boolean(STATE_META[status]?.spinning);

const Projects = () => {
  const [searchParams] = useSearchParams();
  const filterAccountId = searchParams.get('awsAccountId');

  const [awsAccounts, setAwsAccounts] = useState([]);
  const [projectsByAccount, setProjectsByAccount] = useState({});
  const [unlinkedProjects, setUnlinkedProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [togglingId, setTogglingId] = useState(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [autoSyncing, setAutoSyncing] = useState(false);

  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [defaultAccountForNew, setDefaultAccountForNew] = useState(null);

  const [showBillingModal, setShowBillingModal] = useState(false);
  const [billingProject, setBillingProject] = useState(null);

  const syncInFlightRef = useRef(false);
  // Tracks active per-project transition-poll timers so we can clear them
  // on unmount or if a project is toggled again before the last poll settled.
  const pollTimersRef = useRef({});

  const groupProjects = (allProjects) => {
    const grouped = {};
    const unlinked = [];
    allProjects.forEach((p) => {
      if (p.aws_account_id) {
        if (!grouped[p.aws_account_id]) grouped[p.aws_account_id] = [];
        grouped[p.aws_account_id].push(p);
      } else {
        unlinked.push(p);
      }
    });
    return { grouped, unlinked };
  };

  const loadAll = useCallback(async () => {
    try {
      const [accounts, allProjects] = await Promise.all([getAwsAccounts(), getProjects()]);
      setAwsAccounts(accounts);
      const { grouped, unlinked } = groupProjects(allProjects);
      setProjectsByAccount(grouped);
      setUnlinkedProjects(unlinked);
      setError('');
    } catch (err) {
      console.error('Error loading projects:', err);
      setError('Failed to load projects.');
    }
  }, []);

  // Updates a single project's fields in local state without a full reload,
  // so transition polling feels instant instead of re-fetching everything.
  const patchProjectInState = useCallback((projectId, updates) => {
    const patchList = (list) => list.map((p) => (p.id === projectId ? { ...p, ...updates } : p));
    setProjectsByAccount((prev) => {
      const next = {};
      Object.keys(prev).forEach((key) => { next[key] = patchList(prev[key]); });
      return next;
    });
    setUnlinkedProjects((prev) => patchList(prev));
  }, []);

  const runAutoSync = useCallback(async () => {
    if (syncInFlightRef.current) return;
    syncInFlightRef.current = true;
    setAutoSyncing(true);
    try {
      await syncAllInstances();
      await loadAll();
      setLastSyncedAt(new Date());
    } catch (err) {
      console.error('Background AWS sync failed:', err);
    }
    setAutoSyncing(false);
    syncInFlightRef.current = false;
  }, [loadAll]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadAll();
      setLoading(false);
      runAutoSync();
    };
    init();

    const intervalId = setInterval(runAutoSync, AUTO_SYNC_INTERVAL_MS);
    const timers = pollTimersRef.current;
    return () => {
      clearInterval(intervalId);
      Object.values(timers).forEach((t) => clearTimeout(t));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Polls ONE project's real AWS state every few seconds until it settles
  // into a terminal state (running/stopped/terminated), mirroring how the
  // AWS Console itself shows "pending"/"stopping" before landing on a final
  // state - instead of this dashboard just flipping instantly.
  const pollProjectUntilSettled = useCallback((projectId, startedAt = Date.now()) => {
    const poll = async () => {
      try {
        const result = await syncSingleInstance(projectId);
        patchProjectInState(projectId, { status: result.status, public_ip: result.publicIp });

        if (!isTransitional(result.status)) {
          delete pollTimersRef.current[projectId];
          return;
        }
      } catch (err) {
        console.error(`Transition poll failed for project ${projectId}:`, err);
        // keep trying until timeout - a single transient failure shouldn't
        // abandon tracking the transition
      }

      if (Date.now() - startedAt > TRANSITION_POLL_TIMEOUT_MS) {
        delete pollTimersRef.current[projectId];
        return;
      }

      pollTimersRef.current[projectId] = setTimeout(poll, TRANSITION_POLL_MS);
    };

    if (pollTimersRef.current[projectId]) clearTimeout(pollTimersRef.current[projectId]);
    pollTimersRef.current[projectId] = setTimeout(poll, TRANSITION_POLL_MS);
  }, [patchProjectInState]);

  const handleToggleStatus = async (project) => {
    if (project.is_static || isTransitional(project.status)) return;
    if (!project.instance_id || !project.region) {
      alert('This project has no EC2 instance ID / region set — edit the project first.');
      return;
    }
    if (!project.aws_account_id) {
      alert('This project has no AWS account linked — edit the project and select one.');
      return;
    }
    setTogglingId(project.id);
    try {
      const action = project.status === 'running' ? 'stop' : 'start';
      const result = await toggleEc2(project.id, action);
      // Reflect AWS's immediate transitional state right away (e.g. "pending"),
      // then keep polling every few seconds until it reaches running/stopped -
      // same two-phase loading feel as the AWS Console itself.
      patchProjectInState(project.id, { status: result.status, public_ip: result.publicIp });
      if (isTransitional(result.status)) {
        pollProjectUntilSettled(project.id);
      }
    } catch (err) {
      console.error('Error toggling EC2 instance:', err);
      alert(err.response?.data?.error || 'Failed to toggle instance.');
    }
    setTogglingId(null);
  };

  const handleDeleteProject = async (project) => {
    if (window.confirm(`Delete project "${project.name}"? This cannot be undone.`)) {
      try {
        await deleteProject(project.id);
        loadAll();
      } catch (err) {
        alert(err.response?.data?.error || 'Failed to delete project.');
      }
    }
  };

  const handleSyncAll = async () => {
    setSyncingAll(true);
    try {
      const result = await syncAllInstances();
      await loadAll();
      setLastSyncedAt(new Date());
      alert(`Synced ${result.synced} of ${result.results.length} project(s) with live AWS state.`);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to sync instances.');
    }
    setSyncingAll(false);
  };

  const accountMonthlyCost = (accountId) =>
    (projectsByAccount[accountId] || []).reduce((sum, p) => sum + (Number(p.monthly_cost) || 0), 0);

  const visibleAccounts = filterAccountId
    ? awsAccounts.filter((a) => String(a.id) === String(filterAccountId))
    : awsAccounts;

  const renderProjectCard = (project) => {
    const meta = getStateMeta(project.status);
    const transitional = isTransitional(project.status);
    return (
      <div key={project.id} className="pms-card proj-card">
        <div className="proj-card-top">
          <div>
            <div className="proj-name">{project.name}</div>
            <div className="proj-client">{project.client || 'Internal'}</div>
          </div>
          <span className={`pms-badge ${meta.badge}`}>
            {transitional && <span className="pms-spinner proj-badge-spinner"></span>}
            {meta.label}
          </span>
        </div>

        <div className="proj-details">
          <div className="proj-detail-row"><i className="fa-solid fa-layer-group"></i><span>{project.type}{project.is_static ? ' (Static)' : ''}</span></div>
          {project.instance_id && (
            <div className="proj-detail-row"><i className="fa-solid fa-server"></i><span>{project.instance_id} · {project.region}</span></div>
          )}
          {project.public_ip && (
            <div className="proj-detail-row">
              <i className="fa-solid fa-network-wired"></i>
              <span>{project.public_ip}</span>
            </div>
          )}
          {project.db_type && (
            <div className="proj-detail-row"><i className="fa-solid fa-database"></i><span>{project.db_type}{project.db_host ? ` — ${project.db_host}` : ''}</span></div>
          )}
          {project.url && (
            <div className="proj-detail-row"><i className="fa-solid fa-globe"></i><a href={project.url} target="_blank" rel="noreferrer">{project.url}</a></div>
          )}
          <div className="proj-detail-row"><i className="fa-solid fa-indian-rupee-sign"></i><span>{Number(project.monthly_cost || 0).toLocaleString('en-IN')} / month</span></div>
          {project.last_synced_at && (
            <div className="proj-detail-row proj-synced-row">
              <i className="fa-solid fa-rotate"></i>
              <span>Synced {new Date(project.last_synced_at).toLocaleTimeString()}</span>
            </div>
          )}
        </div>

        <div className="proj-actions">
          {!project.is_static && (
            <button
              className={`proj-toggle-btn ${project.status === 'running' ? 'proj-toggle-on' : transitional ? 'proj-toggle-pending' : 'proj-toggle-off'}`}
              onClick={() => handleToggleStatus(project)}
              disabled={togglingId === project.id || transitional}
            >
              {transitional ? (
                <><span className="pms-spinner"></span> {meta.label}</>
              ) : (
                <><i className="fa-solid fa-power-off"></i> {togglingId === project.id ? 'Working...' : (project.status === 'running' ? 'ON' : 'OFF')}</>
              )}
            </button>
          )}
          <button className="pms-icon-btn" title="Billing history" onClick={() => { setBillingProject(project); setShowBillingModal(true); }}>
            <i className="fa-solid fa-file-invoice-dollar"></i>
          </button>
          <button className="pms-icon-btn" title="Edit project" onClick={() => { setEditingProject(project); setShowProjectModal(true); }}>
            <i className="fa-solid fa-pen"></i>
          </button>
          <button className="pms-icon-btn pms-icon-danger" title="Delete project" onClick={() => handleDeleteProject(project)}>
            <i className="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="proj-page pms-page-container">
      <div className="proj-header">
        <div>
          <p className="proj-subtitle">
            Grouped by AWS account — each project only ever uses its own account's credentials
          </p>
        </div>
        <div className="proj-header-actions">
          <div className="proj-autosync-status" title="Automatically re-checks real AWS state every 25 seconds">
            {autoSyncing ? (
              <><span className="pms-spinner proj-autosync-spinner"></span> Checking AWS...</>
            ) : lastSyncedAt ? (
              <><i className="fa-solid fa-circle-check proj-autosync-ok"></i> Live as of {lastSyncedAt.toLocaleTimeString()}</>
            ) : null}
          </div>
          <button className="pms-btn pms-btn-ghost" onClick={handleSyncAll} disabled={syncingAll}>
            {syncingAll ? <><span className="pms-spinner"></span> Syncing...</> : <><i className="fa-solid fa-rotate"></i> Sync with AWS</>}
          </button>
          <button
            className="pms-btn pms-btn-primary"
            onClick={() => { setEditingProject(null); setDefaultAccountForNew(filterAccountId); setShowProjectModal(true); }}
          >
            <i className="fa-solid fa-plus"></i> Add Project
          </button>
        </div>
      </div>

      {error && <div className="pms-error-text">{error}</div>}

      {loading ? (
        <div className="awsacc-loading"><span className="pms-spinner"></span> Loading projects...</div>
      ) : (
        <>
          {visibleAccounts.length === 0 && !filterAccountId && (
            <div className="pms-card awsacc-empty">
              <i className="fa-solid fa-diagram-project"></i>
              <p>No AWS accounts yet. Add one under AWS Accounts before creating projects.</p>
            </div>
          )}

          {visibleAccounts.map((account) => (
            <div key={account.id} className="proj-account-section">
              <div className="proj-account-header">
                <div className="proj-account-title">
                  <i className="fa-brands fa-aws"></i> {account.name}
                  <span className="proj-account-label">{account.account_label}</span>
                  {!account.has_credentials && (
                    <span className="pms-badge pms-badge-stopped proj-no-creds">No AWS credentials</span>
                  )}
                </div>
                <div className="proj-account-cost">₹{accountMonthlyCost(account.id).toLocaleString('en-IN')} / mo</div>
              </div>

              {(projectsByAccount[account.id] || []).length === 0 ? (
                <p className="dash-empty proj-no-projects">No projects under this account yet.</p>
              ) : (
                <div className="proj-grid">
                  {(projectsByAccount[account.id] || []).map(renderProjectCard)}
                </div>
              )}
            </div>
          ))}

          {!filterAccountId && unlinkedProjects.length > 0 && (
            <div className="proj-account-section">
              <div className="proj-account-header">
                <div className="proj-account-title"><i className="fa-solid fa-triangle-exclamation"></i> Not linked to an AWS account</div>
              </div>
              <div className="proj-grid">{unlinkedProjects.map(renderProjectCard)}</div>
            </div>
          )}
        </>
      )}

      {showProjectModal && (
        <ProjectModal
          project={editingProject}
          defaultAwsAccountId={defaultAccountForNew}
          onClose={() => setShowProjectModal(false)}
          onSaved={() => { setShowProjectModal(false); loadAll(); }}
        />
      )}

      {showBillingModal && billingProject && (
        <BillingModal project={billingProject} onClose={() => { setShowBillingModal(false); setBillingProject(null); }} />
      )}
    </div>
  );
};

export default Projects;
