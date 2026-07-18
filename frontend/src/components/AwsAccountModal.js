import React, { useState } from 'react';
import { addAwsAccount, updateAwsAccount, testAwsAccountConnection } from '../api/endpoints';
import '../styles/modal.css';

const AwsAccountModal = ({ account, onClose, onSaved }) => {
  const isEditMode = Boolean(account);
  const [formData, setFormData] = useState({
    name: account?.name || '',
    accountLabel: account?.account_label || '',
    region: account?.region || '',
    environment: account?.environment || 'Production',
    monthlyBudget: account?.monthly_budget || '',
    accessKeyId: account?.access_key_preview && isEditMode ? '' : '',
    secretAccessKey: ''
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Account name is required';
    if (!formData.accountLabel.trim()) newErrors.accountLabel = 'Label is required (e.g. Account 1)';
    if (!formData.region.trim()) newErrors.region = 'Region is required (e.g. ap-south-1)';
    if (!isEditMode && !formData.accessKeyId.trim()) newErrors.accessKeyId = 'Access Key ID is required';
    if (!isEditMode && !formData.secretAccessKey.trim()) newErrors.secretAccessKey = 'Secret Access Key is required';
    if (isEditMode && formData.accessKeyId.trim() && !formData.secretAccessKey.trim()) {
      newErrors.secretAccessKey = 'Enter the Secret Access Key too when changing the Access Key ID';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    setApiError('');
    try {
      const payload = {
        name: formData.name.trim(),
        accountLabel: formData.accountLabel.trim(),
        region: formData.region.trim(),
        environment: formData.environment,
        monthlyBudget: formData.monthlyBudget ? Number(formData.monthlyBudget) : 0,
        accessKeyId: formData.accessKeyId.trim() || undefined,
        secretAccessKey: formData.secretAccessKey.trim() || undefined
      };
      if (isEditMode) await updateAwsAccount(account.id, payload);
      else await addAwsAccount(payload);
      onSaved();
    } catch (err) {
      console.error('Error saving AWS account:', err);
      setApiError(err.response?.data?.error || 'Failed to save account.');
    }
    setIsSubmitting(false);
  };

  const handleTestConnection = async () => {
    if (!isEditMode) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testAwsAccountConnection(account.id);
      setTestResult({ ok: true, ...result });
    } catch (err) {
      setTestResult({ ok: false, error: err.response?.data?.error || err.message });
    }
    setTesting(false);
  };

  return (
    <div className="pms-modal-overlay">
      <div className="pms-modal">
        <div className="pms-modal-header">
          <h5>{isEditMode ? 'Edit AWS Account' : 'Add AWS Account'}</h5>
          <button className="pms-modal-close" onClick={onClose} disabled={isSubmitting}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="pms-modal-body">
          <div className="pms-form-group">
            <label className="pms-label">Account Name <span className="pms-required">*</span></label>
            <input name="name" value={formData.name} onChange={handleChange} placeholder="e.g. AWS Production" disabled={isSubmitting} />
            {errors.name && <div className="pms-error-text">{errors.name}</div>}
          </div>

          <div className="pms-form-group">
            <label className="pms-label">Label <span className="pms-required">*</span></label>
            <input name="accountLabel" value={formData.accountLabel} onChange={handleChange} placeholder="e.g. Account 1" disabled={isSubmitting} />
            {errors.accountLabel && <div className="pms-error-text">{errors.accountLabel}</div>}
          </div>

          <div className="pms-modal-row">
            <div className="pms-form-group">
              <label className="pms-label">Region <span className="pms-required">*</span></label>
              <input name="region" value={formData.region} onChange={handleChange} placeholder="e.g. ap-south-1" disabled={isSubmitting} />
              {errors.region && <div className="pms-error-text">{errors.region}</div>}
            </div>
            <div className="pms-form-group">
              <label className="pms-label">Environment</label>
              <select name="environment" value={formData.environment} onChange={handleChange} disabled={isSubmitting}>
                <option value="Production">Production</option>
                <option value="Testing">Testing</option>
                <option value="Client">Client</option>
              </select>
            </div>
          </div>

          <div className="pms-form-group">
            <label className="pms-label">Monthly Budget (₹)</label>
            <input type="number" name="monthlyBudget" value={formData.monthlyBudget} onChange={handleChange} placeholder="Optional" min="0" disabled={isSubmitting} />
          </div>

          <div className="aws-cred-divider">
            <i className="fa-solid fa-key"></i> IAM Credentials for this account
            {isEditMode && account.has_credentials && (
              <span className="aws-cred-current"> — currently: {account.access_key_preview}</span>
            )}
          </div>

          <div className="pms-form-group">
            <label className="pms-label">
              Access Key ID {!isEditMode && <span className="pms-required">*</span>}
            </label>
            <input
              name="accessKeyId"
              value={formData.accessKeyId}
              onChange={handleChange}
              placeholder={isEditMode ? 'Leave blank to keep existing' : 'AKIA...'}
              disabled={isSubmitting}
              autoComplete="off"
            />
            {errors.accessKeyId && <div className="pms-error-text">{errors.accessKeyId}</div>}
          </div>

          <div className="pms-form-group">
            <label className="pms-label">
              Secret Access Key {!isEditMode && <span className="pms-required">*</span>}
            </label>
            <input
              type="password"
              name="secretAccessKey"
              value={formData.secretAccessKey}
              onChange={handleChange}
              placeholder={isEditMode ? 'Leave blank to keep existing' : 'Paste the secret key'}
              disabled={isSubmitting}
              autoComplete="new-password"
            />
            {errors.secretAccessKey && <div className="pms-error-text">{errors.secretAccessKey}</div>}
            <div className="aws-cred-hint">Encrypted before it's stored — never sent to the browser again after saving.</div>
          </div>

          {isEditMode && (
            <div className="aws-test-box">
              <button type="button" className="pms-btn pms-btn-outline" onClick={handleTestConnection} disabled={testing}>
                {testing ? <><span className="pms-spinner"></span> Testing...</> : <><i className="fa-solid fa-plug-circle-check"></i> Test Connection</>}
              </button>
              {testResult?.ok && (
                <div className="aws-test-result aws-test-ok">
                  <i className="fa-solid fa-circle-check"></i> Connected to AWS account <strong>{testResult.account}</strong>
                </div>
              )}
              {testResult && !testResult.ok && (
                <div className="aws-test-result aws-test-fail">
                  <i className="fa-solid fa-triangle-exclamation"></i> {testResult.error}
                </div>
              )}
            </div>
          )}

          {apiError && <div className="pms-error-text">{apiError}</div>}

          <div className="pms-modal-actions">
            <button type="button" className="pms-btn pms-btn-ghost" onClick={onClose} disabled={isSubmitting}>Cancel</button>
            <button type="submit" className="pms-btn pms-btn-primary" disabled={isSubmitting}>
              {isSubmitting ? <><span className="pms-spinner"></span> Saving...</> : (isEditMode ? 'Update Account' : 'Add Account')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AwsAccountModal;
