const express = require('express');
const pool = require('../config/database');

const router = express.Router();

// Remove authentication requirement for houses
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name FROM houses ORDER BY id');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Houses error:', error);
    res.status(500).json({ success: false, message: 'Failed to get houses' });
  }
});

module.exports = router;