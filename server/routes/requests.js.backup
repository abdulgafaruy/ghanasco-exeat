const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

// Audit log helper function
async function logAudit(userId, action, details, ipAddress) {
  try {
    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES ($1, $2, $3, $4)',
      [userId, action, details, ipAddress]
    );
  } catch (error) {
    console.error('Failed to log audit:', error);
  }
}

// Get system settings
async function getSettings() {
  try {
    const result = await pool.query('SELECT setting_key, setting_value FROM system_settings');
    const settings = {};
    result.rows.forEach(row => {
      settings[row.setting_key] = row.setting_value;
    });
    return settings;
  } catch (error) {
    console.error('Failed to get settings:', error);
    return {};
  }
}

// Check if request is expired
async function expireOldRequests() {
  try {
    await pool.query('SELECT expire_old_requests()');
  } catch (error) {
    console.error('Failed to expire requests:', error);
  }
}

// GET all requests with filters
router.get('/', authenticate, async (req, res) => {
  try {
    await expireOldRequests();
    
    const { status, house_id, student_id, semester, academic_year, search } = req.query;
    
    let query = `
      SELECT 
        r.*,
        u.first_name || ' ' || u.last_name as student_name,
        u.student_id,
        u.class,
        h.name as house_name,
        approver.first_name || ' ' || approver.last_name as approved_by_name,
        (SELECT COUNT(*) FROM request_notes WHERE request_id = r.id) as notes_count
      FROM exeat_requests r
      JOIN users u ON r.student_id = u.id
      JOIN houses h ON r.house_id = h.id
      LEFT JOIN users approver ON r.approved_by = approver.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;

    // Role-based filtering
    if (req.user.role === 'student') {
      query += ` AND r.student_id = $${paramCount}`;
      params.push(req.user.id);
      paramCount++;
    } else if (req.user.role === 'housemaster') {
      query += ` AND r.house_id = $${paramCount}`;
      params.push(req.user.house_id);
      paramCount++;
    }

    // Additional filters
    if (status) {
      query += ` AND r.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }
    
    if (house_id && req.user.role === 'headmaster') {
      query += ` AND r.house_id = $${paramCount}`;
      params.push(house_id);
      paramCount++;
    }
    
    if (student_id && (req.user.role === 'housemaster' || req.user.role === 'headmaster')) {
      query += ` AND r.student_id = $${paramCount}`;
      params.push(student_id);
      paramCount++;
    }
    
    if (semester) {
      query += ` AND r.semester = $${paramCount}`;
      params.push(semester);
      paramCount++;
    }
    
    if (academic_year) {
      query += ` AND r.academic_year = $${paramCount}`;
      params.push(academic_year);
      paramCount++;
    }
    
    if (search) {
      query += ` AND (u.first_name ILIKE $${paramCount} OR u.last_name ILIKE $${paramCount} OR u.student_id ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    query += ' ORDER BY r.created_at DESC';

    const result = await pool.query(query, params);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Failed to fetch requests:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch requests' });
  }
});

// GET single request with notes
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    const requestQuery = `
      SELECT 
        r.*,
        u.first_name || ' ' || u.last_name as student_name,
        u.student_id,
        u.class,
        u.phone as student_phone,
        h.name as house_name,
        approver.first_name || ' ' || approver.last_name as approved_by_name,
        rejecter.first_name || ' ' || rejecter.last_name as rejected_by_name
      FROM exeat_requests r
      JOIN users u ON r.student_id = u.id
      JOIN houses h ON r.house_id = h.id
      LEFT JOIN users approver ON r.approved_by = approver.id
      LEFT JOIN users rejecter ON r.rejected_by = rejecter.id
      WHERE r.id = $1
    `;
    
    const notesQuery = `
      SELECT 
        n.*,
        u.first_name || ' ' || u.last_name as author_name,
        u.role as author_role
      FROM request_notes n
      JOIN users u ON n.user_id = u.id
      WHERE n.request_id = $1
      ORDER BY n.created_at DESC
    `;
    
    const requestResult = await pool.query(requestQuery, [id]);
    const notesResult = await pool.query(notesQuery, [id]);
    
    if (requestResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }
    
    const request = requestResult.rows[0];
    request.notes = notesResult.rows;
    
    // Check permissions
    if (req.user.role === 'student' && request.student_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    if (req.user.role === 'housemaster' && request.house_id !== req.user.house_id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    res.json({ success: true, data: request });
  } catch (error) {
    console.error('Failed to fetch request:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch request' });
  }
});

// POST create new request
router.post('/', authenticate, authorize(['student']), async (req, res) => {
  try {
    const { departure_date, departure_time, duration, destination, reason, guardian_name, guardian_phone } = req.body;
    
    const settings = await getSettings();
    const maxRequests = parseInt(settings.max_requests_per_semester || '3');
    const expiryHours = parseInt(settings.request_expiry_hours || '48');
    const currentSemester = settings.current_semester || '1';
    const currentAcademicYear = settings.current_academic_year || '2025-2026';
    
    // Check semester limit
    const countResult = await pool.query(
      'SELECT count_semester_requests($1, $2, $3) as count',
      [req.user.id, currentSemester, currentAcademicYear]
    );
    
    const currentCount = parseInt(countResult.rows[0].count);
    
    if (currentCount >= maxRequests) {
      await logAudit(req.user.id, 'REQUEST_DENIED_LIMIT', `Attempted to create request but limit reached (${currentCount}/${maxRequests})`, req.ip);
      return res.status(400).json({ 
        success: false, 
        message: `You have reached the maximum of ${maxRequests} exeat requests per semester. Current: ${currentCount}` 
      });
    }
    
    // Create request with expiry
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiryHours);
    
    const result = await pool.query(
      `INSERT INTO exeat_requests (
        student_id, house_id, departure_date, departure_time, duration,
        destination, reason, guardian_name, guardian_phone,
        semester, academic_year, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        req.user.id, req.user.house_id, departure_date, departure_time, duration,
        destination, reason, guardian_name, guardian_phone,
        currentSemester, currentAcademicYear, expiresAt
      ]
    );
    
    await logAudit(req.user.id, 'REQUEST_CREATED', `Created exeat request ID: ${result.rows[0].id}`, req.ip);
    
    res.json({ success: true, data: result.rows[0], message: 'Request created successfully' });
  } catch (error) {
    console.error('Failed to create request:', error);
    res.status(500).json({ success: false, message: 'Failed to create request' });
  }
});

// PUT update request (students can edit pending requests)
router.put('/:id', authenticate, authorize(['student']), async (req, res) => {
  try {
    const { id } = req.params;
    const { departure_date, departure_time, duration, destination, reason, guardian_name, guardian_phone } = req.body;
    
    const settings = await getSettings();
    const allowEdit = settings.allow_student_edit === 'true';
    
    if (!allowEdit) {
      return res.status(403).json({ success: false, message: 'Editing requests is currently disabled' });
    }
    
    // Check if request exists and belongs to user
    const checkResult = await pool.query(
      'SELECT * FROM exeat_requests WHERE id = $1 AND student_id = $2 AND status = $3',
      [id, req.user.id, 'pending']
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Request not found or cannot be edited' });
    }
    
    const result = await pool.query(
      `UPDATE exeat_requests SET
        departure_date = $1, departure_time = $2, duration = $3,
        destination = $4, reason = $5, guardian_name = $6,
        guardian_phone = $7, edited_at = NOW()
      WHERE id = $8 AND student_id = $9
      RETURNING *`,
      [departure_date, departure_time, duration, destination, reason, guardian_name, guardian_phone, id, req.user.id]
    );
    
    await logAudit(req.user.id, 'REQUEST_EDITED', `Edited request ID: ${id}`, req.ip);
    
    res.json({ success: true, data: result.rows[0], message: 'Request updated successfully' });
  } catch (error) {
    console.error('Failed to update request:', error);
    res.status(500).json({ success: false, message: 'Failed to update request' });
  }
});

// POST cancel request
router.post('/:id/cancel', authenticate, authorize(['student']), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const settings = await getSettings();
    const allowCancel = settings.allow_student_cancel === 'true';
    
    if (!allowCancel) {
      return res.status(403).json({ success: false, message: 'Cancelling requests is currently disabled' });
    }
    
    const result = await pool.query(
      `UPDATE exeat_requests SET
        status = 'rejected',
        cancelled_at = NOW(),
        cancelled_by = $1,
        cancellation_reason = $2
      WHERE id = $3 AND student_id = $1 AND status = 'pending'
      RETURNING *`,
      [req.user.id, reason || 'Cancelled by student', id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Request not found or cannot be cancelled' });
    }
    
    await logAudit(req.user.id, 'REQUEST_CANCELLED', `Cancelled request ID: ${id}`, req.ip);
    
    res.json({ success: true, data: result.rows[0], message: 'Request cancelled successfully' });
  } catch (error) {
    console.error('Failed to cancel request:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel request' });
  }
});

// POST approve request
router.post('/:id/approve', authenticate, authorize(['housemaster', 'headmaster']), async (req, res) => {
  try {
    const { id } = req.params;
    
    const checkResult = await pool.query(
      'SELECT * FROM exeat_requests WHERE id = $1 AND status = $2',
      [id, 'pending']
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Request not found or already processed' });
    }
    
    const request = checkResult.rows[0];
    
    // Check permissions
    if (req.user.role === 'housemaster' && request.house_id !== req.user.house_id) {
      return res.status(403).json({ success: false, message: 'You can only approve requests from your house' });
    }
    
    const result = await pool.query(
      `UPDATE exeat_requests SET
        status = 'approved',
        approved_by = $1,
        approved_at = NOW()
      WHERE id = $2
      RETURNING *`,
      [req.user.id, id]
    );
    
    await logAudit(req.user.id, 'REQUEST_APPROVED', `Approved request ID: ${id}`, req.ip);
    
    res.json({ success: true, data: result.rows[0], message: 'Request approved successfully' });
  } catch (error) {
    console.error('Failed to approve request:', error);
    res.status(500).json({ success: false, message: 'Failed to approve request' });
  }
});

// POST batch approve
router.post('/batch/approve', authenticate, authorize(['housemaster', 'headmaster']), async (req, res) => {
  try {
    const { request_ids } = req.body;
    
    if (!Array.isArray(request_ids) || request_ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid request IDs' });
    }
    
    let query = `
      UPDATE exeat_requests SET
        status = 'approved',
        approved_by = $1,
        approved_at = NOW()
      WHERE id = ANY($2) AND status = 'pending'
    `;
    
    const params = [req.user.id, request_ids];
    
    if (req.user.role === 'housemaster') {
      query += ' AND house_id = $3';
      params.push(req.user.house_id);
    }
    
    query += ' RETURNING *';
    
    const result = await pool.query(query, params);
    
    await logAudit(req.user.id, 'BATCH_APPROVED', `Batch approved ${result.rows.length} requests`, req.ip);
    
    res.json({ 
      success: true, 
      data: result.rows, 
      message: `${result.rows.length} request(s) approved successfully` 
    });
  } catch (error) {
    console.error('Failed to batch approve:', error);
    res.status(500).json({ success: false, message: 'Failed to batch approve requests' });
  }
});

// POST reject request
router.post('/:id/reject', authenticate, authorize(['housemaster', 'headmaster']), async (req, res) => {
  try {
    const { id } = req.params;
    const { rejection_reason } = req.body;
    
    if (!rejection_reason) {
      return res.status(400).json({ success: false, message: 'Rejection reason is required' });
    }
    
    const checkResult = await pool.query(
      'SELECT * FROM exeat_requests WHERE id = $1 AND status = $2',
      [id, 'pending']
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Request not found or already processed' });
    }
    
    const request = checkResult.rows[0];
    
    if (req.user.role === 'housemaster' && request.house_id !== req.user.house_id) {
      return res.status(403).json({ success: false, message: 'You can only reject requests from your house' });
    }
    
    const result = await pool.query(
      `UPDATE exeat_requests SET
        status = 'rejected',
        rejected_by = $1,
        rejected_at = NOW(),
        rejection_reason = $2
      WHERE id = $3
      RETURNING *`,
      [req.user.id, rejection_reason, id]
    );
    
    await logAudit(req.user.id, 'REQUEST_REJECTED', `Rejected request ID: ${id}`, req.ip);
    
    res.json({ success: true, data: result.rows[0], message: 'Request rejected successfully' });
  } catch (error) {
    console.error('Failed to reject request:', error);
    res.status(500).json({ success: false, message: 'Failed to reject request' });
  }
});

// POST add note to request
router.post('/:id/notes', authenticate, authorize(['housemaster', 'headmaster']), async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    
    if (!note) {
      return res.status(400).json({ success: false, message: 'Note is required' });
    }
    
    const result = await pool.query(
      'INSERT INTO request_notes (request_id, user_id, note) VALUES ($1, $2, $3) RETURNING *',
      [id, req.user.id, note]
    );
    
    await logAudit(req.user.id, 'NOTE_ADDED', `Added note to request ID: ${id}`, req.ip);
    
    res.json({ success: true, data: result.rows[0], message: 'Note added successfully' });
  } catch (error) {
    console.error('Failed to add note:', error);
    res.status(500).json({ success: false, message: 'Failed to add note' });
  }
});

// GET statistics overview
router.get('/stats/overview', authenticate, async (req, res) => {
  try {
    await expireOldRequests();
    
    let query = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
        COUNT(CASE WHEN is_expired = true THEN 1 END) as expired
      FROM exeat_requests
      WHERE 1=1
    `;
    
    const params = [];
    
    if (req.user.role === 'student') {
      query += ' AND student_id = $1';
      params.push(req.user.id);
    } else if (req.user.role === 'housemaster') {
      query += ' AND house_id = $1';
      params.push(req.user.house_id);
    }
    
    const result = await pool.query(query, params);
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Failed to fetch stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch statistics' });
  }
});

// GET house statistics (for housemasters and headmaster)
router.get('/stats/houses', authenticate, authorize(['housemaster', 'headmaster']), async (req, res) => {
  try {
    let query = 'SELECT * FROM request_statistics';
    const params = [];
    
    if (req.user.role === 'housemaster') {
      query += ' WHERE house_id = $1';
      params.push(req.user.house_id);
    }
    
    query += ' ORDER BY house_name';
    
    const result = await pool.query(query, params);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Failed to fetch house stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch house statistics' });
  }
});

module.exports = router;