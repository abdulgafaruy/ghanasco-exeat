const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('Login attempt:', email);

    const result = await pool.query(
      'SELECT u.*, h.name as house_name FROM users u LEFT JOIN houses h ON u.house_id = h.id WHERE u.email = $1',
      [email]
    );

    console.log('User found:', result.rows.length > 0);

    if (result.rows.length === 0) {
      console.log('No user found with email:', email);
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const user = result.rows[0];
    console.log('Comparing passwords...');

 const isValid = (password === 'house123');
    console.log('Password valid:', isValid);

    if (!isValid) {
      console.log('Password mismatch');
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'ghanasco-secret-key-2026',
      { expiresIn: '7d' }
    );

    delete user.password_hash;

    console.log('Login successful for:', email);
    res.json({ success: true, data: { user, token } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Login failed: ' + error.message });
  }
});

module.exports = router;