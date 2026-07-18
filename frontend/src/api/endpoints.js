import api from './client';

// Auth
export const login = async (email, password) => {
  const res = await api.post('/auth/login', { email, password });
  localStorage.setItem('pm_token', res.data.token);
  localStorage.setItem('pm_email', res.data.email);
  return res.data;
};

export const logout = () => {
  localStorage.removeItem('pm_token');
  localStorage.removeItem('pm_email');
};

// Dashboard
export const getDashboardSummary = async () => (await api.get('/dashboard/summary')).data;

// AWS Accounts
export const getAwsAccounts = async () => (await api.get('/aws-accounts')).data;
export const addAwsAccount = async (data) => (await api.post('/aws-accounts', data)).data;
export const updateAwsAccount = async (id, data) => (await api.put(`/aws-accounts/${id}`, data)).data;
export const deleteAwsAccount = async (id) => (await api.delete(`/aws-accounts/${id}`)).data;
export const testAwsAccountConnection = async (id) => (await api.post(`/aws-accounts/${id}/test-connection`)).data;

// Projects
export const getProjects = async (awsAccountId) =>
  (await api.get('/projects', { params: awsAccountId ? { awsAccountId } : {} })).data;
export const getProject = async (id) => (await api.get(`/projects/${id}`)).data;
export const addProject = async (data) => (await api.post('/projects', data)).data;
export const updateProject = async (id, data) => (await api.put(`/projects/${id}`, data)).data;
export const deleteProject = async (id) => (await api.delete(`/projects/${id}`)).data;
export const getProjectActivity = async (id) => (await api.get(`/projects/${id}/activity`)).data;

// EC2 (real AWS control) - driven by projectId only; the server resolves
// which AWS account's credentials to use based on how the project is linked.
export const toggleEc2 = async (projectId, action) => (await api.post('/ec2/toggle', { projectId, action })).data;
export const getEc2Status = async (projectId) => (await api.get('/ec2/status', { params: { projectId } })).data;
export const syncSingleInstance = async (projectId) => (await api.post('/ec2/sync-one', { projectId })).data;
export const syncAllInstances = async () => (await api.post('/ec2/sync-all')).data;

// Billing
export const getBillingHistory = async (projectId) => (await api.get(`/billing/project/${projectId}`)).data;
export const addBillingEntry = async (projectId, data) => (await api.post(`/billing/project/${projectId}`, data)).data;
export const deleteBillingEntry = async (billingId) => (await api.delete(`/billing/${billingId}`)).data;
export const getAwsLiveCost = async (accountId, monthOffset = 0) =>
  (await api.get(`/billing/aws-live/${accountId}`, { params: { monthOffset } })).data;
export const triggerAwsSyncNow = async () => (await api.post('/billing/aws-sync-now')).data;
