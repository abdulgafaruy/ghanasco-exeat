const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const pool = require('./config/database');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
const authRoutes = require('./routes/auth');
const housesRoutes = require('./routes/houses');
const requestsRoutes = require('./routes/requests');
const adminRoutes = require('./routes/admin');  // ADD THIS
const usersRoutes = require('./routes/users');

app.use('/api/users', usersRoutes);
app.use('/api/admin', adminRoutes);  // ADD THIS
app.use('/api/requests', requestsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/houses', housesRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Ghanasco Exeat System API is running',
    timestamp: new Date().toISOString()
  });
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
  } else {
    console.log('✅ Database connected at:', res.rows[0].now);
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Client URL: ${process.env.CLIENT_URL || 'http://localhost:3000'}`);
  console.log(`🗄️  Database: ${process.env.DB_NAME || 'ghanasco_exeat'}`);
});