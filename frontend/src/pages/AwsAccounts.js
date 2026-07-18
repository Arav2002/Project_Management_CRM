import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAwsAccounts, deleteAwsAccount, testAwsAccountConnection } from '../api/endpoints';
import AwsAccountModal from '../components/AwsAccountModal';
import '../styles/awsAccounts.css';

const AwsAccounts = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [error, setError] = useState('');
  const [testingId, setTestingId] = useState(null);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const data = await getAwsAccounts();
      setAccounts(data);
      setError('');
    } catch (err) {
      console.error('Error loading AWS accounts:', err);
      setError('Failed to load AWS accounts.');
    }
    setLoading(false);
  };

  useEffect(() => { loadAccounts(); }, []);

  const handleDelete = async (account) => {
    if (account.project_count > 0) {
      alert(`Cannot delete "${account.name}" — it has ${account.project_count} project(s). Remove or reassign them first.`);
      return;
    }
    if (window.confirm(`Delete AWS account "${account.name}"? This cannot be undone.`)) {
      try {
        await deleteAwsAccount(account.id);
        loadAccounts();
      } catch (err) {
        alert(err.response?.data?.error || 'Failed to delete account.');
      }
    }
  };

  const handleQuickTest = async (account) => {
    setTestingId(account.id);
    try {
      await testAwsAccountConnection(account.id);
      loadAccounts();
    } catch (err) {
      alert(err.response?.data?.error || 'Connection test failed.');
    }
    setTestingId(null);
  };

  return (
    <div className="awsacc-page pms-page-container">
      <div className="awsacc-header">
        <div>
          <p className="awsacc-subtitle">Each account below has its own IAM credentials — projects only ever use the keys of the account they're linked to</p>
        </div>
        <button className="pms-btn pms-btn-primary" onClick={() => { setEditingAccount(null); setShowModal(true); }}>
          <i className="fa-solid fa-plus"></i> Add AWS Account
        </button>
      </div>

      {error && <div className="pms-error-text">{error}</div>}

      {loading ? (
        <div className="awsacc-loading"><span className="pms-spinner"></span> Loading accounts...</div>
      ) : accounts.length === 0 ? (
        <div className="pms-card awsacc-empty">
          <i className="fa-solid fa-cloud"></i>
          <p>No AWS accounts yet. Add your first account (with its Access Key + Secret) to get started.</p>
        </div>
      ) : (
        <div className="awsacc-grid">
          {accounts.map((account) => (
            <div key={account.id} className="pms-card awsacc-card">
              <div className="awsacc-card-top">
                <div className="awsacc-icon"><i className="fa-brands fa-aws"></i></div>
                <div className="awsacc-card-actions">
                  <button className="pms-icon-btn" title="Edit" onClick={() => { setEditingAccount(account); setShowModal(true); }}>
                    <i className="fa-solid fa-pen"></i>
                  </button>
                  <button className="pms-icon-btn pms-icon-danger" title="Delete" onClick={() => handleDelete(account)}>
                    <i className="fa-solid fa-trash"></i>
                  </button>
                </div>
              </div>

              <div className="awsacc-name">{account.name}</div>
              <div className="awsacc-label">{account.account_label} &middot; {account.region}</div>

              <div className="awsacc-badges">
                <span className={`pms-badge ${account.environment === 'Production' ? 'pms-badge-running' : 'pms-badge-warning'}`}>
                  {account.environment}
                </span>
                {account.has_credentials ? (
                  <span className="pms-badge pms-badge-running"><i className="fa-solid fa-key"></i> {account.access_key_preview}</span>
                ) : (
                  <span className="pms-badge pms-badge-stopped"><i className="fa-solid fa-triangle-exclamation"></i> No credentials</span>
                )}
              </div>

              {account.has_credentials && (
                <button
                  className="pms-btn pms-btn-ghost awsacc-test-btn"
                  onClick={() => handleQuickTest(account)}
                  disabled={testingId === account.id}
                >
                  {testingId === account.id ? <><span className="pms-spinner"></span> Testing...</> : <><i className="fa-solid fa-plug-circle-check"></i> Test Connection</>}
                </button>
              )}
              {account.credentials_verified_at && (
                <div className="awsacc-verified">Last verified: {new Date(account.credentials_verified_at).toLocaleString()}</div>
              )}

              <div className="awsacc-stats">
                <div>
                  <div className="awsacc-stat-value">{account.project_count}</div>
                  <div className="awsacc-stat-label">Projects</div>
                </div>
                <div>
                  <div className="awsacc-stat-value">₹{Number(account.total_monthly_cost || 0).toLocaleString('en-IN')}</div>
                  <div className="awsacc-stat-label">Monthly Cost</div>
                </div>
              </div>

              <Link to={`/projects?awsAccountId=${account.id}`} className="pms-btn pms-btn-outline awsacc-view-btn">
                View Projects <i className="fa-solid fa-arrow-right"></i>
              </Link>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <AwsAccountModal
          account={editingAccount}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); loadAccounts(); }}
        />
      )}
    </div>
  );
};

export default AwsAccounts;
