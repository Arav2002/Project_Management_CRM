# Project Management CRM

A fully independent React + Node + Postgres app for managing multiple AWS
accounts and the projects deployed under them — real EC2 start/stop, real
AWS Cost Explorer billing, per-account encrypted credentials. Nothing here
depends on your existing company website; this is its own app you can run
locally, test, and later host or fold into something else.

## Why per-account credentials (not one shared key in `.env`)

Earlier drafts of this used a single AWS key pair from `.env` for
everything. That breaks the moment you have more than one AWS account.
This version stores **each AWS account's own Access Key ID + Secret Access
Key, encrypted, in Postgres** — every EC2 action or billing pull is scoped
to exactly the account the project is linked to. Account 1's project can
never accidentally run against Account 2 or 3's credentials.

The AWS keys never touch the browser. They're entered once through the
Add/Edit AWS Account form, sent straight to your local Node server, encrypted
with AES-256-GCM, and stored. The plain secret key is only ever decrypted
in-memory on the server, right before an AWS SDK call, and is never sent
back to the frontend again.

---

## 1. Prerequisites

- Node.js 18+
- PostgreSQL installed locally (or reachable from your machine)
- Your DevOps engineer's IAM Access Key ID + Secret Access Key **for each
  AWS account** you want to connect (see IAM policy below)

## 2. Backend setup

```bash
cd backend
npm install
cp .env.example .env
```

Fill in `.env`:

```bash
# Postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=pm_suite
DB_USER=postgres
DB_PASSWORD=your_local_postgres_password

# Generate this once:
openssl rand -hex 32
# paste the output as ENCRYPTION_KEY

JWT_SECRET=some_other_long_random_string
ADMIN_EMAIL=you@company.com
```

Generate your admin login password hash:
```bash
npm run hash-password -- "yourChosenPassword"
# copy the printed line into ADMIN_PASSWORD_HASH in .env
```

Create the database and apply the schema:
```bash
createdb pm_suite
npm run migrate
```

Start the server:
```bash
npm run dev
```
You should see `Project Management Suite API running on http://localhost:5050`.

## 3. Frontend setup

```bash
cd frontend
npm install
cp .env.example .env
npm start
```
Opens at `http://localhost:3000`, logging in with the email/password you hashed above.

## 4. Connect your first AWS account

Go to **AWS Accounts → Add AWS Account** and fill in:
- Name / Label / Region / Environment
- **Access Key ID** and **Secret Access Key** for that specific account

Then click **Test Connection** on the account card — it calls AWS STS
`GetCallerIdentity` (read-only, touches no resources) and confirms the keys
work, showing you the AWS Account ID they belong to.

Repeat for Account 2, Account 3, etc. — each gets its own independent keys.

## 5. IAM policy for your DevOps engineer

Minimal permissions needed per AWS account (attach to the IAM user, not root):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeInstances",
        "ec2:StartInstances",
        "ec2:StopInstances",
        "ec2:RebootInstances"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": ["ce:GetCostAndUsage"],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": ["sts:GetCallerIdentity"],
      "Resource": "*"
    }
  ]
}
```

## 6. Add projects

Go to **Projects → Add Project**, pick which AWS account it belongs to, and
(if it runs on EC2) fill in the **Instance ID** and **Region**. The ON/OFF
toggle then calls real `StartInstances`/`StopInstances` against that
project's linked account — status updates in Postgres and an activity log
entry is recorded.

Static sites (no EC2, no DB) can be marked as such — they skip the
instance fields entirely and just track cost/URL/hosting provider.

## 7. Billing

- **Manual entries**: log a month's cost per project any time.
- **Live pull**: inside a project's Billing modal, click "Fetch from AWS" to
  pull the real current-month cost from that project's AWS account via Cost
  Explorer (this is account-wide, not filtered to one instance — AWS Cost
  Explorer doesn't split by individual EC2 instance without tagging + cost
  allocation tags set up separately).
- **Auto-sync**: a cron job (`COST_SYNC_CRON` in `.env`, default 2am daily)
  pulls each connected account's monthly cost automatically into
  `billing_history` with `source = 'aws-sync'`. Trigger it manually anytime
  by calling `POST /api/billing/aws-sync-now` (e.g. via the "Sync with AWS"
  button on the Projects page, which also refreshes EC2 status for every
  linked instance).

## Project structure

```
project-management-suite/
  backend/
    db/            schema.sql, migrate.js, pool.js
    middleware/     JWT auth guard
    routes/         auth, aws-accounts, projects, ec2, billing, dashboard
    services/       crypto.js (AES-256-GCM), accountCredentials.js,
                    awsService.js (EC2 + Cost Explorer calls), costSync.js (cron)
    scripts/        hashPassword.js
    server.js
  frontend/
    src/
      api/          axios client + endpoint functions
      context/       AuthContext
      components/    Layout, PrivateRoute, AwsAccountModal, ProjectModal, BillingModal
      pages/         Login, Dashboard, AwsAccounts, Projects
      styles/
```

## Security notes

- AWS secret keys are AES-256-GCM encrypted at rest; `ENCRYPTION_KEY` in
  `.env` is the only thing that can decrypt them — keep it out of Git and
  back it up somewhere safe (losing it means re-entering all AWS keys).
- The dashboard's own login (`ADMIN_EMAIL`/`ADMIN_PASSWORD_HASH`) is
  separate from AWS IAM — it just gates access to this app.
- Every API route except `/auth/login` requires a valid JWT.
- Nothing in `frontend/` ever holds an AWS secret key — check the Network
  tab any time to confirm; the backend responses only ever include a masked
  preview like `AKIA****XYZ1`.

## Navigation & keyboard shortcuts

The sidebar only expands/collapses via a keyboard shortcut — there's no
button for it, by design, to keep the rail compact:

| Shortcut | Action |
|---|---|
| `Alt+1` / `Alt+2` / `Alt+3` | Jump to Dashboard / AWS Accounts / Projects |
| `Alt+S` | Expand / collapse the sidebar |
| `Alt+T` | Toggle dark / light theme |
| `Alt+L` | Log out (asks for confirmation first) |
| `Shift+?` | Show the shortcuts list |
| `Esc` | Close any open dialog |

On screens narrower than 900px, the sidebar is replaced by a floating
glassmorphism bottom nav bar instead. The header (page title, theme toggle,
profile, logout) stays sticky at the top on every screen size; only the
content below it scrolls.

## Matching AWS Console's own start/stop timing

Earlier versions flipped the ON/OFF badge instantly on click. This version
asks AWS for the real instance state immediately after issuing a
start/stop command — so you'll see `pending`/`stopping` (with a spinner),
then it keeps quietly re-checking every ~3.5 seconds until AWS reports a
final `running`/`stopped` state, the same two-phase timing you'd see in the
AWS Console itself. If a project has just run `npm run migrate` for the
first time after upgrading, this needs the new `public_ip` column - re-run
`npm run migrate` in `backend/` once (it's safe to run repeatedly).

## Public IP / Elastic IP

The project card now shows the instance's current public IP, refreshed
every time the app syncs with AWS. Two things worth knowing:

- **Default (non-Elastic) public IP**: released when the instance stops,
  and a *new* one is assigned on the next start — this is why the IP
  "changes" each time you turn it back on.
- **Elastic IP (EIP)**: stays fixed across stop/start cycles, since it's an
  IP you own rather than one borrowed from AWS's ephemeral pool.

On cost: as of AWS's Feb 2024 pricing change, **every public IPv4 address
costs the same** — about $0.005/hour (~$3.65/month) — whether it's the
default ephemeral IP or an Elastic IP, and whether it's attached to a
running instance or just sitting idle in your account. The one practical
difference for your wallet: a default public IP costs nothing while the
instance is *stopped* (because AWS releases it and stops billing until you
start again), whereas an Elastic IP keeps costing that same $3.65/month
even while the instance is off, because AWS is holding that specific
address for you whether you're using it or not. If you don't need a fixed
IP, leaving the instance on the default (non-Elastic) IP and just letting
it change on each restart is the cheaper option while the instance spends
meaningful time stopped.
