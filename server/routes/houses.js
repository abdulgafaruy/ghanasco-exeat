const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');

// GET all houses
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name FROM houses ORDER BY name ASC'
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching houses:', error);
    res.status(500).json({ success: false, message: 'Error fetching houses' });
  }
});

// GET students in a specific house (with count)
router.get('/:id/students', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.* FROM users u 
       WHERE u.house_id = $1 AND u.role = 'student'
       ORDER BY u.first_name ASC`,
      [req.params.id]
    );
    
    res.json({ 
      success: true, 
      count: result.rows.length,
      students: result.rows 
    });
  } catch (error) {
    console.error('Error fetching house students:', error);
    res.status(500).json({ success: false, message: 'Error fetching students' });
  }
});

// GET single house
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name FROM houses WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'House not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching house:', error);
    res.status(500).json({ success: false, message: 'Error fetching house' });
  }
});

module.exports = router;
