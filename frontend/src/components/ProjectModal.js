import React, { useState, useEffect } from 'react';
import { addProject, updateProject, getAwsAccounts } from '../api/endpoints';
import '../styles/modal.css';

const ProjectModal = ({ project, defaultAwsAccountId, onClose, onSaved }) => {
  const isEditMode = Boolean(project);
  const [awsAccounts, setAwsAccounts] = useState([]);
  const [formData, setFormData] = useState({
    name: project?.name || '',
    client: project?.client || '',
    type: project?.type || 'Web',
    awsAccountId: project?.aws_account_id || defaultAwsAccountId || '',
    hostingProvider: project?.hosting_provider || 'AWS',
    instanceId: project?.instance_id || '',
    region: project?.region || '',
    dbType: project?.db_type || 'PostgreSQL',
    dbHost: project?.db_host || '',
    url: project?.url || '',
    repoUrl: project?.repo_url || '',
    monthlyCost: project?.monthly_cost || '',
    isStatic: project?.is_static || false
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');

  useEffect(() => {
    getAwsAccounts().then(setAwsAccounts).catch(() => setAwsAccounts([]));
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Project name is required';
    if (formData.hostingProvider === 'AWS' && !formData.isStatic) {
      if (!formData.instanceId.trim()) newErrors.instanceId = 'Needed to control the instance from this dashboard';
      if (!formData.region.trim()) newErrors.region = 'Needed to control the instance from this dashboard';
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
        client: formData.client.trim(),
        type: formData.type,
        awsAccountId: formData.awsAccountId || null,
        hostingProvider: formData.hostingProvider,
        instanceId: formData.instanceId.trim(),
        region: formData.region.trim(),
        dbType: formData.dbType,
        dbHost: formData.dbHost.trim(),
        url: formData.url.trim(),
        repoUrl: formData.repoUrl.trim(),
        monthlyCost: formData.monthlyCost ? Number(formData.monthlyCost) : 0,
        isStatic: formData.isStatic
      };
      if (isEditMode) await updateProject(project.id, payload);
      else await addProject(payload);
      onSaved();
    } catch (err) {
      console.error('Error saving project:', err);
      setApiError(err.response?.data?.error || 'Failed to save project.');
    }
    setIsSubmitting(false);
  };

  return (
    <div className="pms-modal-overlay">
      <div className="pms-modal pms-modal-lg">
        <div className="pms-modal-header">
          <h5>{isEditMode ? 'Edit Project' : 'Add Project'}</h5>
          <button className="pms-modal-close" onClick={onClose} disabled={isSubmitting}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="pms-modal-body">
          <div className="pms-modal-row">
            <div className="pms-form-group">
              <label className="pms-label">Project Name <span className="pms-required">*</span></label>
              <input name="name" value={formData.name} onChange={handleChange} disabled={isSubmitting} />
              {errors.name && <div className="pms-error-text">{errors.name}</div>}
            </div>
            <div className="pms-form-group">
              <label className="pms-label">Client</label>
              <input name="client" value={formData.client} onChange={handleChange} placeholder="Internal / client name" disabled={isSubmitting} />
            </div>
          </div>

          <div className="pms-modal-row-3">
            <div className="pms-form-group">
              <label className="pms-label">Type</label>
              <select name="type" value={formData.type} onChange={handleChange} disabled={isSubmitting}>
                <option value="Web">Web</option>
                <option value="Mobile">Mobile</option>
                <option value="API">API</option>
                <option value="AI">AI</option>
              </select>
            </div>
            <div className="pms-form-group">
              <label className="pms-label">Hosting Provider</label>
              <select name="hostingProvider" value={formData.hostingProvider} onChange={handleChange} disabled={isSubmitting}>
                <option value="AWS">AWS</option>
                <option value="Firebase">Firebase</option>
                <option value="Vercel">Vercel</option>
                <option value="Netlify">Netlify</option>
                <option value="Hostinger">Hostinger</option>
              </select>
            </div>
            <div className="pms-form-group">
              <label className="pms-label">Monthly Cost (₹)</label>
              <input type="number" name="monthlyCost" value={formData.monthlyCost} onChange={handleChange} min="0" disabled={isSubmitting} />
            </div>
          </div>

          <div className="pms-form-group">
            <label className="pms-label">AWS Account</label>
            <select name="awsAccountId" value={formData.awsAccountId} onChange={handleChange} disabled={isSubmitting}>
              <option value="">— None —</option>
              {awsAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>{acc.name} ({acc.account_label})</option>
              ))}
            </select>
          </div>

          <label className="pms-checkbox-row">
            <input type="checkbox" name="isStatic" checked={formData.isStatic} onChange={handleChange} disabled={isSubmitting} />
            This is a static website (no EC2 instance, no database)
          </label>

          {!formData.isStatic && formData.hostingProvider === 'AWS' && (
            <div className="pms-modal-row">
              <div className="pms-form-group">
                <label className="pms-label">EC2 Instance ID <span className="pms-required">*</span></label>
                <input
                  name="instanceId"
                  value={formData.instanceId}
                  onChange={handleChange}
                  placeholder="i-0123456789abcdef0"
                  disabled={isSubmitting}
                />
                {errors.instanceId && <div className="pms-error-text">{errors.instanceId}</div>}
              </div>
              <div className="pms-form-group">
                <label className="pms-label">Region <span className="pms-required">*</span></label>
                <input
                  name="region"
                  value={formData.region}
                  onChange={handleChange}
                  placeholder="ap-south-1"
                  disabled={isSubmitting}
                />
                {errors.region && <div className="pms-error-text">{errors.region}</div>}
              </div>
            </div>
          )}

          {!formData.isStatic && (
            <div className="pms-modal-row">
              <div className="pms-form-group">
                <label className="pms-label">Database Type</label>
                <select name="dbType" value={formData.dbType} onChange={handleChange} disabled={isSubmitting}>
                  <option value="PostgreSQL">PostgreSQL</option>
                  <option value="MongoDB">MongoDB</option>
                  <option value="Firebase">Firebase</option>
                  <option value="MySQL">MySQL</option>
                </select>
              </div>
              <div className="pms-form-group">
                <label className="pms-label">Database Host</label>
                <input name="dbHost" value={formData.dbHost} onChange={handleChange} placeholder="e.g. RDS endpoint (no credentials)" disabled={isSubmitting} />
              </div>
            </div>
          )}

          <div className="pms-modal-row">
            <div className="pms-form-group">
              <label className="pms-label">Live URL</label>
              <input name="url" value={formData.url} onChange={handleChange} placeholder="https://..." disabled={isSubmitting} />
            </div>
            <div className="pms-form-group">
              <label className="pms-label">Repository URL</label>
              <input name="repoUrl" value={formData.repoUrl} onChange={handleChange} placeholder="GitHub link" disabled={isSubmitting} />
            </div>
          </div>

          {apiError && <div className="pms-error-text">{apiError}</div>}

          <div className="pms-modal-actions">
            <button type="button" className="pms-btn pms-btn-ghost" onClick={onClose} disabled={isSubmitting}>Cancel</button>
            <button type="submit" className="pms-btn pms-btn-primary" disabled={isSubmitting}>
              {isSubmitting ? <><span className="pms-spinner"></span> Saving...</> : (isEditMode ? 'Update Project' : 'Add Project')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProjectModal;
