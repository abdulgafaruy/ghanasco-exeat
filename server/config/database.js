const { Pool } = require('pg');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'ghanasco_exeat',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
};

// Add SSL for production
if (isProduction) {
  config.ssl = {
    rejectUnauthorized: false
  };
}

const pool = new Pool(config);

pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Database connection error:', err);
});

module.exports = pool;