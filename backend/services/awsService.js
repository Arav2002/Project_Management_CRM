// Every function here takes an explicit { accessKeyId, secretAccessKey } pair.
// There is no fallback to a global .env credential anywhere in this file -
// that's intentional, so a call for Project A's account can never silently
// run against Project B's AWS account.
const {
  EC2Client,
  StartInstancesCommand,
  StopInstancesCommand,
  RebootInstancesCommand,
  DescribeInstancesCommand
} = require('@aws-sdk/client-ec2');
const { CostExplorerClient, GetCostAndUsageCommand } = require('@aws-sdk/client-cost-explorer');
const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');

const buildCreds = (creds) => ({
  accessKeyId: creds.accessKeyId,
  secretAccessKey: creds.secretAccessKey
});

// Confirms a specific account's IAM keys are valid, without touching any resources.
const verifyCredentials = async (creds, region) => {
  const client = new STSClient({ region: region || 'us-east-1', credentials: buildCreds(creds) });
  const result = await client.send(new GetCallerIdentityCommand({}));
  return { account: result.Account, arn: result.Arn, userId: result.UserId };
};

const startInstance = async (creds, instanceId, region) => {
  const client = new EC2Client({ region, credentials: buildCreds(creds) });
  return client.send(new StartInstancesCommand({ InstanceIds: [instanceId] }));
};

const stopInstance = async (creds, instanceId, region) => {
  const client = new EC2Client({ region, credentials: buildCreds(creds) });
  return client.send(new StopInstancesCommand({ InstanceIds: [instanceId] }));
};

const rebootInstance = async (creds, instanceId, region) => {
  const client = new EC2Client({ region, credentials: buildCreds(creds) });
  return client.send(new RebootInstancesCommand({ InstanceIds: [instanceId] }));
};

const describeInstance = async (creds, instanceId, region) => {
  const client = new EC2Client({ region, credentials: buildCreds(creds) });
  const result = await client.send(new DescribeInstancesCommand({ InstanceIds: [instanceId] }));
  const instance = result.Reservations?.[0]?.Instances?.[0];
  if (!instance) return null;
  return {
    state: instance.State?.Name || 'unknown',
    publicIp: instance.PublicIpAddress || null,
    privateIp: instance.PrivateIpAddress || null,
    instanceType: instance.InstanceType || null,
    launchTime: instance.LaunchTime || null
  };
};

// Live monthly cost for the specific AWS account these credentials belong to.
// Cost Explorer is a global service that only accepts requests in us-east-1,
// regardless of which region the account's resources actually run in.
const getMonthlyCost = async (creds, monthOffset = 0) => {
  const client = new CostExplorerClient({ region: 'us-east-1', credentials: buildCreds(creds) });
  const now = new Date();
  const targetMonth = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const start = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).toISOString().slice(0, 10);

  const result = await client.send(new GetCostAndUsageCommand({
    TimePeriod: { Start: start, End: end },
    Granularity: 'MONTHLY',
    Metrics: ['UnblendedCost'],
    GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }]
  }));

  const groups = result.ResultsByTime?.[0]?.Groups || [];
  const breakdown = groups
    .map((g) => ({ service: g.Keys[0], amount: parseFloat(g.Metrics.UnblendedCost.Amount) }))
    .filter((g) => g.amount > 0.001)
    .sort((a, b) => b.amount - a.amount);

  const total = breakdown.reduce((sum, g) => sum + g.amount, 0);
  return { total: Number(total.toFixed(2)), breakdown, period: { start, end } };
};

module.exports = {
  verifyCredentials,
  startInstance,
  stopInstance,
  rebootInstance,
  describeInstance,
  getMonthlyCost
};
