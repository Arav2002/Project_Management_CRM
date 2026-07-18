import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDashboardSummary, getAwsAccounts } from '../api/endpoints';
import '../styles/dashboard.css';

const Dashboard = () => {
  const [summary, setSummary] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [summaryData, accountsData] = await Promise.all([getDashboardSummary(), getAwsAccounts()]);
      setSummary(summaryData);
      setAccounts(accountsData);
      setError('');
    } catch (err) {
      console.error('Error loading dashboard:', err);
      setError('Failed to load dashboard data.');
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const connectedCount = accounts.filter((a) => a.has_credentials).length;

  const stats = [
    { label: 'AWS Accounts', value: summary?.awsAccounts ?? '-', icon: 'fa-brands fa-aws', color: 'blue' },
    { label: 'Total Projects', value: summary?.totalProjects ?? '-', icon: 'fa-diagram-project', color: 'purple' },
    { label: 'Running', value: summary?.runningProjects ?? '-', icon: 'fa-solid fa-circle-play', color: 'green' },
    { label: 'Stopped', value: summary?.stoppedProjects ?? '-', icon: 'fa-solid fa-circle-stop', color: 'red' }
  ];

  return (
    <div className="dash-page pms-page-container">
      <div className="dash-header">
        <div>
          <p className="dash-subtitle">Overview across all your AWS accounts, projects and billing</p>
        </div>
      </div>

      {!loading && (
        <div className={`aws-status-banner ${connectedCount === accounts.length && accounts.length > 0 ? 'connected' : connectedCount > 0 ? 'checking' : 'failed'}`}>
          {accounts.length === 0 ? (
            <><i className="fa-solid fa-circle-info"></i> No AWS accounts added yet. <Link to="/aws-accounts">Add one</Link> to start connecting real infrastructure.</>
          ) : (
            <><i className="fa-solid fa-plug-circle-check"></i> {connectedCount} of {accounts.length} AWS account(s) have credentials configured. <Link to="/aws-accounts">Manage accounts</Link></>
          )}
        </div>
      )}

      {error && <div className="pms-error-text">{error}</div>}

      <div className="dash-stats-grid">
        {stats.map((stat) => (
          <div key={stat.label} className="pms-card dash-stat-card">
            <div className={`dash-stat-icon dash-icon-${stat.color}`}>
              <i className={stat.icon.startsWith('fa-brands') ? stat.icon : `fa-solid ${stat.icon}`}></i>
            </div>
            <div>
              <div className="dash-stat-value">{loading ? '...' : stat.value}</div>
              <div className="dash-stat-label">{stat.label}</div>
            </div>
          </div>
        ))}
        <div className="pms-card dash-stat-card dash-cost-card">
          <div className="dash-stat-icon dash-icon-gold"><i className="fa-solid fa-indian-rupee-sign"></i></div>
          <div>
            <div className="dash-stat-value">
              {loading ? '...' : `₹${Number(summary?.totalMonthlyCost || 0).toLocaleString('en-IN')}`}
            </div>
            <div className="dash-stat-label">Monthly Cost (recorded)</div>
          </div>
        </div>
      </div>

      {accounts.length > 0 && (
        <div className="pms-card dash-accounts-card">
          <h4>AWS Accounts Snapshot</h4>
          <div className="dash-accounts-list">
            {accounts.map((acc) => (
              <div key={acc.id} className="dash-account-row">
                <div className="dash-account-name">
                  <i className="fa-brands fa-aws"></i> {acc.name} <span className="dash-account-label">({acc.account_label})</span>
                </div>
                <div className="dash-account-right">
                  <span>{acc.project_count} project(s)</span>
                  <span>₹{Number(acc.total_monthly_cost || 0).toLocaleString('en-IN')}</span>
                  {acc.has_credentials ? (
                    <span className="pms-badge pms-badge-running">Connected</span>
                  ) : (
                    <span className="pms-badge pms-badge-stopped">No keys</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="pms-card dash-activity-card">
        <h4>Recent Activity</h4>
        {(!summary?.recentActivity || summary.recentActivity.length === 0) ? (
          <p className="dash-empty">No activity yet. Actions like starting/stopping instances will show up here.</p>
        ) : (
          <ul className="dash-activity-list">
            {summary.recentActivity.map((item, idx) => (
              <li key={idx}>
                <i className="fa-solid fa-circle-dot dash-activity-dot"></i>
                <div>
                  <div className="dash-activity-action">
                    {item.project_name ? <strong>{item.project_name}</strong> : null} — {item.action.replace(/_/g, ' ')}
                  </div>
                  <div className="dash-activity-meta">
                    {item.details} &middot; {new Date(item.created_at).toLocaleString()}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
