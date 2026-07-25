const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

// GET all audit logs (senior housemaster & admin only)
router.get('/', authenticate, authorize(['senior_housemaster', 'admin']), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        al.id, 
        al.user_id, 
        al.action, 
        al.details, 
        al.ip_address,
        al.created_at,
        u.first_name, 
        u.last_name,
        u.email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.created_at DESC
      LIMIT 200`
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ success: false, message: 'Error fetching audit logs' });
  }
});

// GET audit logs for specific user
router.get('/user/:userId', authenticate, authorize(['senior_housemaster', 'admin']), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        al.id, al.user_id, al.action, al.details, al.created_at
      FROM audit_logs al
      WHERE al.user_id = $1
      ORDER BY al.created_at DESC
      LIMIT 100`,
      [req.params.userId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ success: false, message: 'Error fetching audit logs' });
  }
});

// POST create audit log (internal use)
router.post('/', authenticate, async (req, res) => {
  const { action, details } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.user.id, action, details, req.ip]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error creating audit log:', error);
    res.status(500).json({ success: false, message: 'Error creating audit log' });
  }
});

module.exports = router;
