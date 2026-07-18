import React, { useState, useEffect } from 'react';
import { getBillingHistory, addBillingEntry, deleteBillingEntry, getAwsLiveCost } from '../api/endpoints';
import '../styles/modal.css';
import '../styles/billing.css';

const BillingModal = ({ project, onClose }) => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ month: '', amount: '', hosting: '', database: '', storage: '', other: '', notes: '' });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [liveCost, setLiveCost] = useState(null);
  const [liveCostLoading, setLiveCostLoading] = useState(false);
  const [liveCostError, setLiveCostError] = useState('');

  const loadEntries = async () => {
    setLoading(true);
    try {
      const data = await getBillingHistory(project.id);
      setEntries(data);
    } catch (err) {
      console.error('Error loading billing history:', err);
    }
    setLoading(false);
  };

  useEffect(() => { loadEntries(); }, [project.id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.month) newErrors.month = 'Month is required';
    if (!formData.amount) newErrors.amount = 'Total amount is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      await addBillingEntry(project.id, {
        month: formData.month,
        amount: Number(formData.amount),
        hosting: Number(formData.hosting || 0),
        database: Number(formData.database || 0),
        storage: Number(formData.storage || 0),
        other: Number(formData.other || 0),
        notes: formData.notes.trim()
      });
      setFormData({ month: '', amount: '', hosting: '', database: '', storage: '', other: '', notes: '' });
      loadEntries();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save billing entry.');
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (billingId) => {
    if (window.confirm('Delete this billing entry?')) {
      try {
        await deleteBillingEntry(billingId);
        loadEntries();
      } catch (err) {
        alert(err.response?.data?.error || 'Failed to delete entry.');
      }
    }
  };

  const fetchLiveCost = async () => {
    if (!project.aws_account_id) {
      setLiveCostError('This project has no AWS account linked — edit the project first.');
      return;
    }
    setLiveCostLoading(true);
    setLiveCostError('');
    try {
      const data = await getAwsLiveCost(project.aws_account_id, 0);
      setLiveCost(data);
    } catch (err) {
      setLiveCostError(err.response?.data?.error || 'Failed to fetch live AWS cost.');
    }
    setLiveCostLoading(false);
  };

  return (
    <div className="pms-modal-overlay">
      <div className="pms-modal pms-modal-lg">
        <div className="pms-modal-header">
          <h5>Billing History — {project.name}</h5>
          <button className="pms-modal-close" onClick={onClose}><i className="fa-solid fa-xmark"></i></button>
        </div>

        <div className="pms-modal-body">
          <div className="billing-live-box">
            <div className="billing-live-header">
              <span><i className="fa-brands fa-aws"></i> Live Cost for this Project's AWS Account (current month)</span>
              <button className="pms-btn pms-btn-outline billing-live-btn" onClick={fetchLiveCost} disabled={liveCostLoading}>
                {liveCostLoading ? <><span className="pms-spinner"></span> Fetching...</> : 'Fetch from AWS'}
              </button>
            </div>
            {liveCostError && <div className="pms-error-text">{liveCostError}</div>}
            {liveCost && (
              <div className="billing-live-result">
                <div className="billing-live-total">Total: ₹{liveCost.total.toLocaleString('en-IN')}</div>
                <div className="billing-live-breakdown">
                  {liveCost.breakdown.slice(0, 5).map((b) => (
                    <span key={b.service} className="billing-live-chip">{b.service}: ₹{b.amount.toFixed(2)}</span>
                  ))}
                </div>
                <p className="billing-live-note">This is the whole AWS account's cost, not just this project — use it as a reference when logging the entry below.</p>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="billing-form">
            <div className="billing-form-grid">
              <input type="month" name="month" value={formData.month} onChange={handleChange} disabled={isSubmitting} className={errors.month ? 'is-invalid' : ''} />
              <input type="number" name="amount" placeholder="Total ₹" value={formData.amount} onChange={handleChange} disabled={isSubmitting} min="0" className={errors.amount ? 'is-invalid' : ''} />
              <input type="number" name="hosting" placeholder="Hosting" value={formData.hosting} onChange={handleChange} disabled={isSubmitting} min="0" />
              <input type="number" name="database" placeholder="Database" value={formData.database} onChange={handleChange} disabled={isSubmitting} min="0" />
              <input type="number" name="storage" placeholder="Storage" value={formData.storage} onChange={handleChange} disabled={isSubmitting} min="0" />
              <button type="submit" className="pms-btn pms-btn-primary" disabled={isSubmitting}>
                {isSubmitting ? '...' : 'Add Entry'}
              </button>
            </div>
            {(errors.month || errors.amount) && <div className="pms-error-text">{errors.month || errors.amount}</div>}
          </form>

          {loading ? (
            <div className="billing-loading"><span className="pms-spinner"></span> Loading history...</div>
          ) : entries.length === 0 ? (
            <p className="dash-empty">No billing entries recorded yet.</p>
          ) : (
            <div className="billing-table-wrap pms-scroll">
              <table className="billing-table">
                <thead>
                  <tr><th>Month</th><th>Total</th><th>Hosting</th><th>Database</th><th>Storage</th><th>Source</th><th></th></tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id}>
                      <td>{entry.month}</td>
                      <td>₹{Number(entry.amount).toLocaleString('en-IN')}</td>
                      <td>₹{Number(entry.hosting || 0).toLocaleString('en-IN')}</td>
                      <td>₹{Number(entry.database || 0).toLocaleString('en-IN')}</td>
                      <td>₹{Number(entry.storage || 0).toLocaleString('en-IN')}</td>
                      <td><span className={`pms-badge ${entry.source === 'aws-sync' ? 'pms-badge-running' : 'pms-badge-warning'}`}>{entry.source}</span></td>
                      <td>
                        <button className="pms-icon-btn pms-icon-danger" onClick={() => handleDelete(entry.id)}>
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BillingModal;
