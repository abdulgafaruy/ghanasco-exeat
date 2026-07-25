const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { sendApprovalSMS, sendRejectionSMS } = require('../utils/sms_fixed');

// POST create exeat request
router.post('/', authenticate, authorize(['student']), async (req, res) => {
  const { destination, departure_date, return_date, reason, guardian_name, guardian_phone } = req.body;

  if (!destination || !departure_date || !return_date || !reason || !guardian_name || !guardian_phone) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  try {
    const departDate = new Date(departure_date);
    const returnDate = new Date(return_date);
    const duration = Math.ceil((returnDate - departDate) / (1000 * 60 * 60 * 24)) + 1;

    if (duration < 1) {
      return res.status(400).json({ success: false, message: 'Return date must be after departure date' });
    }

    const result = await pool.query(
      `INSERT INTO exeat_requests (
        student_id, house_id, destination, departure_date, return_date, 
        duration, reason, guardian_name, guardian_phone, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING *`,
      [req.user.id, req.user.house_id, destination, departure_date, return_date, duration, reason, guardian_name, guardian_phone, 'pending']
    );

    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'CREATE_REQUEST', `Student ${req.user.first_name} created exeat request to ${destination}`]
    );

    res.json({ success: true, message: 'Request submitted successfully', data: result.rows[0] });
  } catch (error) {
    console.error('Error creating request:', error);
    res.status(500).json({ success: false, message: 'Error creating request' });
  }
});

// GET all requests
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, house_id } = req.query;
    let query = `
      SELECT r.*, 
             u.first_name, u.last_name, u.email, u.phone,
             h.name as house_name
      FROM exeat_requests r
      LEFT JOIN users u ON r.student_id = u.id
      LEFT JOIN houses h ON r.house_id = h.id
      WHERE 1=1
    `;
    const params = [];

    if (req.user.role === 'student') {
      query += ` AND r.student_id = $${params.length + 1}`;
      params.push(req.user.id);
    } else if (req.user.role === 'housemaster') {
      query += ` AND r.house_id = $${params.length + 1}`;
      params.push(req.user.house_id);
    }

    if (status) {
      query += ` AND r.status = $${params.length + 1}`;
      params.push(status);
    }

    if (house_id && (req.user.role === 'senior_housemaster' || req.user.role === 'admin')) {
      query += ` AND r.house_id = $${params.length + 1}`;
      params.push(house_id);
    }

    query += ` ORDER BY r.created_at DESC`;

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ success: false, message: 'Error fetching requests' });
  }
});

// GET single request
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, 
              u.first_name, u.last_name, u.email,
              h.name as house_name
       FROM exeat_requests r
       LEFT JOIN users u ON r.student_id = u.id
       LEFT JOIN houses h ON r.house_id = h.id
       WHERE r.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching request:', error);
    res.status(500).json({ success: false, message: 'Error fetching request' });
  }
});

// POST approve request
router.post('/:id/approve', authenticate, authorize(['housemaster', 'senior_housemaster', 'admin']), async (req, res) => {
  try {
    const requestResult = await pool.query(
      `SELECT r.*, u.first_name, u.last_name 
       FROM exeat_requests r
       LEFT JOIN users u ON r.student_id = u.id
       WHERE r.id = $1`,
      [req.params.id]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    const request = requestResult.rows[0];

    const result = await pool.query(
      'UPDATE exeat_requests SET status = $1, approved_by = $2, approved_at = NOW() WHERE id = $3 RETURNING *',
      ['approved', req.user.id, req.params.id]
    );

    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'APPROVE_REQUEST', `Approved exeat for ${request.first_name} ${request.last_name}`]
    );

    console.log(`\n📱 SENDING SMS NOTIFICATION...`);
    const smsResult = await sendApprovalSMS(
      request.guardian_phone,
      `${request.first_name} ${request.last_name}`,
      request.destination,
      request.departure_date,
      request.return_date
    );
    console.log(`SMS Result:`, smsResult);

    res.json({ 
      success: true, 
      message: 'Request approved successfully',
      smsSent: smsResult.success,
      data: result.rows[0] 
    });
  } catch (error) {
    console.error('Error approving request:', error);
    res.status(500).json({ success: false, message: 'Error approving request: ' + error.message });
  }
});

// POST reject request
router.post('/:id/reject', authenticate, authorize(['housemaster', 'senior_housemaster', 'admin']), async (req, res) => {
  const { reason } = req.body;

  if (!reason) {
    return res.status(400).json({ success: false, message: 'Rejection reason is required' });
  }

  try {
    const requestResult = await pool.query(
      `SELECT r.*, u.first_name, u.last_name 
       FROM exeat_requests r
       LEFT JOIN users u ON r.student_id = u.id
       WHERE r.id = $1`,
      [req.params.id]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    const request = requestResult.rows[0];

    const result = await pool.query(
      'UPDATE exeat_requests SET status = $1, rejection_reason = $2, rejected_by = $3, rejected_at = NOW() WHERE id = $4 RETURNING *',
      ['rejected', reason, req.user.id, req.params.id]
    );

    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'REJECT_REQUEST', `Rejected exeat for ${request.first_name} ${request.last_name}: ${reason}`]
    );

    console.log(`\n📱 SENDING REJECTION SMS...`);
    const smsResult = await sendRejectionSMS(
      request.guardian_phone,
      `${request.first_name} ${request.last_name}`,
      reason
    );
    console.log(`SMS Result:`, smsResult);

    res.json({ 
      success: true, 
      message: 'Request rejected successfully',
      smsSent: smsResult.success,
      data: result.rows[0] 
    });
  } catch (error) {
    console.error('Error rejecting request:', error);
    res.status(500).json({ success: false, message: 'Error rejecting request: ' + error.message });
  }
});

// POST cancel request
router.post('/:id/cancel', authenticate, authorize(['student']), async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE exeat_requests SET status = $1, cancelled_at = NOW() WHERE id = $2 AND student_id = $3 AND status = $4 RETURNING *',
      ['cancelled', req.params.id, req.user.id, 'pending']
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Cannot cancel this request' });
    }

    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'CANCEL_REQUEST', `Student cancelled exeat request`]
    );

    res.json({ success: true, message: 'Request cancelled successfully', data: result.rows[0] });
  } catch (error) {
    console.error('Error cancelling request:', error);
    res.status(500).json({ success: false, message: 'Error cancelling request' });
  }
});

// POST add note to request
router.post('/:id/notes', authenticate, async (req, res) => {
  const { note } = req.body;

  if (!note) {
    return res.status(400).json({ success: false, message: 'Note is required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO request_notes (request_id, user_id, note, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
      [req.params.id, req.user.id, note]
    );

    res.json({ success: true, message: 'Note added successfully', data: result.rows[0] });
  } catch (error) {
    console.error('Error adding note:', error);
    res.status(500).json({ success: false, message: 'Error adding note' });
  }
});

module.exports = router;
