const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const awsAccountRoutes = require('./routes/awsAccounts');
const projectRoutes = require('./routes/projects');
const billingRoutes = require('./routes/billing');
const ec2Routes = require('./routes/ec2');
const dashboardRoutes = require('./routes/dashboard');
const { startCostSyncSchedule } = require('./services/costSync');

const app = express();

/*
|--------------------------------------------------------------------------
| Allowed Frontend Origins
|--------------------------------------------------------------------------
*/

const allowedOrigins = (
    process.env.FRONTEND_ORIGINS ||
    "http://localhost:3000,http://127.0.0.1:3000,http://192.168.0.9:3000"
)
.split(",")
.map(origin => origin.trim())
.filter(Boolean);

app.use(cors({
    origin(origin, callback) {

        // Allow Postman, curl, backend-to-backend requests
        if (!origin) {
            return callback(null, true);
        }

        // Allow configured origins
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        // Allow all VS Code Dev Tunnel frontend URLs
        if (/^https:\/\/.*-3000\.inc1\.devtunnels\.ms$/.test(origin)) {
            return callback(null, true);
        }

        console.log("❌ Blocked Origin:", origin);

        callback(new Error("Not allowed by CORS"));
    },

    credentials: true,

    methods: [
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS"
    ],

    allowedHeaders: [
        "Content-Type",
        "Authorization"
    ]
}));

app.options("*", cors());

app.use(express.json());

/*
|--------------------------------------------------------------------------
| Routes
|--------------------------------------------------------------------------
*/

app.use('/api/auth', authRoutes);
app.use('/api/aws-accounts', awsAccountRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/ec2', ec2Routes);
app.use('/api/dashboard', dashboardRoutes);

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        time: new Date().toISOString()
    });
});

/*
|--------------------------------------------------------------------------
| Error Handler
|--------------------------------------------------------------------------
*/

app.use((err, req, res, next) => {
    console.error(err);

    res.status(500).json({
        success: false,
        message: err.message || "Internal Server Error"
    });
});

/*
|--------------------------------------------------------------------------
| Start Server
|--------------------------------------------------------------------------
*/

const PORT = process.env.PORT || 5050;

app.listen(PORT, () => {

    console.log(`\n🚀 Project Management Suite API`);
    console.log(`Server : http://localhost:${PORT}`);
    console.log(`Health : http://localhost:${PORT}/api/health`);

    console.log("\nAllowed Origins:");

    allowedOrigins.forEach(origin => {
        console.log(`✔ ${origin}`);
    });

    console.log("✔ *.devtunnels.ms (Port 3000)\n");

    startCostSyncSchedule();
});