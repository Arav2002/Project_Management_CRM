// Applies schema.sql against the configured Postgres database.
// Run with: npm run migrate
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

async function migrate() {
  const sqlPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  try {
    console.log(`Connecting to database "${process.env.DB_NAME}" on ${process.env.DB_HOST}:${process.env.DB_PORT}...`);
    await pool.query(sql);
    console.log('Schema applied successfully. Tables ready: aws_accounts, projects, billing_history, activity_logs.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    console.error('Make sure the database exists first: createdb ' + process.env.DB_NAME);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrate();
