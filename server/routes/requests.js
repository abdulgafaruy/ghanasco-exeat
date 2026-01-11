const express = require('express');
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Get all requests (filtered by role)
router.get('/', authenticate, async (req, res) => {
  try {
    let query = `
      SELECT 
        r.*,
        s.first_name || ' ' || s.last_name as student_name,
        s.class,
        s.student_id,
        h.name as house_name,
        a.first_name || ' ' || a.last_name as approved_by_name,
        rj.first_name || ' ' || rj.last_name as rejected_by_name
      FROM exeat_requests r
      JOIN users s ON r.student_id = s.id
      JOIN houses h ON r.house_id = h.id
      LEFT JOIN users a ON r.approved_by = a.id
      LEFT JOIN users rj ON r.rejected_by = rj.id
    `;

    const params = [];

    // Filter based on role
    if (req.user.role === 'student') {
      query += ' WHERE r.student_id = $1';
      params.push(req.user.id);
    } else if (req.user.role === 'housemaster') {
      query += ' WHERE r.house_id = $1';
      params.push(req.user.house_id);
    }
    // Headmaster sees all

    query += ' ORDER BY r.created_at DESC';

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch requests' });
  }
});

// Get single request
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        r.*,
        s.first_name || ' ' || s.last_name as student_name,
        s.class,
        s.phone as student_phone,
        h.name as house_name
      FROM exeat_requests r
      JOIN users s ON r.student_id = s.id
      JOIN houses h ON r.house_id = h.id
      WHERE r.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Get request error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch request' });
  }
});

// Create new request (students only)
router.post('/', authenticate, authorize('student'), async (req, res) => {
  try {
    const {
      departure_date,
      departure_time,
      duration,
      destination,
      reason,
      guardian_name,
      guardian_phone
    } = req.body;

    // Get student's house
    const userResult = await pool.query(
      'SELECT house_id FROM users WHERE id = $1',
      [req.user.id]
    );

    const house_id = userResult.rows[0].house_id;

    const result = await pool.query(
      `INSERT INTO exeat_requests (
        student_id, house_id, departure_date, departure_time,
        duration, destination, reason, guardian_name, guardian_phone
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        req.user.id,
        house_id,
        departure_date,
        departure_time,
        duration,
        destination,
        reason,
        guardian_name,
        guardian_phone
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Request submitted successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Create request error:', error);
    res.status(500).json({ success: false, message: 'Failed to create request' });
  }
});

// Approve request (housemaster/headmaster)
router.post('/:id/approve', authenticate, authorize('housemaster', 'headmaster'), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE exeat_requests 
       SET status = 'approved', 
           approved_by = $1, 
           approved_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [req.user.id, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    res.json({
      success: true,
      message: 'Request approved successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Approve error:', error);
    res.status(500).json({ success: false, message: 'Failed to approve request' });
  }
});

// Reject request (housemaster/headmaster)
router.post('/:id/reject', authenticate, authorize('housemaster', 'headmaster'), async (req, res) => {
  try {
    const { rejection_reason } = req.body;

    const result = await pool.query(
      `UPDATE exeat_requests 
       SET status = 'rejected', 
           rejected_by = $1, 
           rejected_at = NOW(),
           rejection_reason = $2
       WHERE id = $3
       RETURNING *`,
      [req.user.id, rejection_reason, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    res.json({
      success: true,
      message: 'Request rejected successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Reject error:', error);
    res.status(500).json({ success: false, message: 'Failed to reject request' });
  }
});

// Get statistics
router.get('/stats/overview', authenticate, async (req, res) => {
  try {
    let whereClause = '';
    const params = [];

    if (req.user.role === 'student') {
      whereClause = 'WHERE student_id = $1';
      params.push(req.user.id);
    } else if (req.user.role === 'housemaster') {
      whereClause = 'WHERE house_id = $1';
      params.push(req.user.house_id);
    }

    const result = await pool.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'approved') as approved,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected
      FROM exeat_requests ${whereClause}`,
      params
    );

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to get statistics' });
  }
});

module.exports = router;