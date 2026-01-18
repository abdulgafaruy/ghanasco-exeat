const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

// ==================== AUDIT LOGS ====================

// GET audit logs
router.get('/audit-logs', authenticate, authorize(['headmaster']), async (req, res) => {
  try {
    const { user_id, action, start_date, end_date, limit = 100 } = req.query;
    
    let query = `
      SELECT 
        a.*,
        u.first_name || ' ' || u.last_name as user_name,
        u.role as user_role
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (user_id) {
      query += ` AND a.user_id = $${paramCount}`;
      params.push(user_id);
      paramCount++;
    }
    
    if (action) {
      query += ` AND a.action = $${paramCount}`;
      params.push(action);
      paramCount++;
    }
    
    if (start_date) {
      query += ` AND a.created_at >= $${paramCount}`;
      params.push(start_date);
      paramCount++;
    }
    
    if (end_date) {
      query += ` AND a.created_at <= $${paramCount}`;
      params.push(end_date);
      paramCount++;
    }
    
    query += ` ORDER BY a.created_at DESC LIMIT $${paramCount}`;
    params.push(limit);
    
    const result = await pool.query(query, params);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Failed to fetch audit logs:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch audit logs' });
  }
});

// GET audit log statistics
router.get('/audit-logs/stats', authenticate, authorize(['headmaster']), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        action,
        COUNT(*) as count,
        MAX(created_at) as last_occurrence
      FROM audit_logs
      GROUP BY action
      ORDER BY count DESC
    `);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Failed to fetch audit stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch audit statistics' });
  }
});

// ==================== SYSTEM SETTINGS ====================

// GET all settings
router.get('/settings', authenticate, authorize(['headmaster']), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM system_settings ORDER BY setting_key');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Failed to fetch settings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch settings' });
  }
});

// PUT update setting
router.put('/settings/:key', authenticate, authorize(['headmaster']), async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    const result = await pool.query(
      `INSERT INTO system_settings (setting_key, setting_value, updated_by, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (setting_key)
       DO UPDATE SET setting_value = $2, updated_by = $3, updated_at = NOW()
       RETURNING *`,
      [key, value, req.user.id]
    );
    
    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES ($1, $2, $3, $4)',
      [req.user.id, 'SETTING_UPDATED', `Updated setting: ${key} = ${value}`, req.ip]
    );
    
    res.json({ success: true, data: result.rows[0], message: 'Setting updated successfully' });
  } catch (error) {
    console.error('Failed to update setting:', error);
    res.status(500).json({ success: false, message: 'Failed to update setting' });
  }
});

// ==================== TWO-FACTOR AUTHENTICATION ====================

// POST generate 2FA secret
router.post('/2fa/setup', authenticate, async (req, res) => {
  try {
    // Check if already enabled
    const checkResult = await pool.query(
      'SELECT * FROM two_factor_auth WHERE user_id = $1',
      [req.user.id]
    );
    
    if (checkResult.rows.length > 0 && checkResult.rows[0].enabled) {
      return res.status(400).json({ success: false, message: '2FA is already enabled' });
    }
    
    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `Ghanasco Exeat (${req.user.email})`,
      length: 32
    });
    
    // Generate QR code
    const qrCode = await QRCode.toDataURL(secret.otpauth_url);
    
    // Store secret (not enabled yet)
    await pool.query(
      `INSERT INTO two_factor_auth (user_id, secret, enabled)
       VALUES ($1, $2, false)
       ON CONFLICT (user_id)
       DO UPDATE SET secret = $2, enabled = false`,
      [req.user.id, secret.base32]
    );
    
    res.json({
      success: true,
      data: {
        secret: secret.base32,
        qrCode: qrCode
      },
      message: 'Scan the QR code with your authenticator app'
    });
  } catch (error) {
    console.error('Failed to setup 2FA:', error);
    res.status(500).json({ success: false, message: 'Failed to setup 2FA' });
  }
});

// POST verify and enable 2FA
router.post('/2fa/verify', authenticate, async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ success: false, message: 'Token is required' });
    }
    
    // Get secret
    const result = await pool.query(
      'SELECT secret FROM two_factor_auth WHERE user_id = $1',
      [req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Please setup 2FA first' });
    }
    
    const secret = result.rows[0].secret;
    
    // Verify token
    const verified = speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: 2
    });
    
    if (!verified) {
      return res.status(400).json({ success: false, message: 'Invalid token' });
    }
    
    // Enable 2FA
    await pool.query(
      'UPDATE two_factor_auth SET enabled = true WHERE user_id = $1',
      [req.user.id]
    );
    
    await pool.query(
      'UPDATE users SET two_factor_enabled = true WHERE id = $1',
      [req.user.id]
    );
    
    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES ($1, $2, $3, $4)',
      [req.user.id, '2FA_ENABLED', 'Two-factor authentication enabled', req.ip]
    );
    
    res.json({ success: true, message: '2FA enabled successfully' });
  } catch (error) {
    console.error('Failed to verify 2FA:', error);
    res.status(500).json({ success: false, message: 'Failed to verify 2FA' });
  }
});

// POST disable 2FA
router.post('/2fa/disable', authenticate, async (req, res) => {
  try {
    const { password } = req.body;
    
    // Verify password (you'll need to add this check)
    // For now, just disable it
    
    await pool.query(
      'UPDATE two_factor_auth SET enabled = false WHERE user_id = $1',
      [req.user.id]
    );
    
    await pool.query(
      'UPDATE users SET two_factor_enabled = false WHERE id = $1',
      [req.user.id]
    );
    
    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES ($1, $2, $3, $4)',
      [req.user.id, '2FA_DISABLED', 'Two-factor authentication disabled', req.ip]
    );
    
    res.json({ success: true, message: '2FA disabled successfully' });
  } catch (error) {
    console.error('Failed to disable 2FA:', error);
    res.status(500).json({ success: false, message: 'Failed to disable 2FA' });
  }
});

// ==================== USER MANAGEMENT ====================

// GET all users (headmaster only)
router.get('/users', authenticate, authorize(['headmaster']), async (req, res) => {
  try {
    const { role, house_id, search } = req.query;
    
    let query = `
      SELECT 
        u.id, u.student_id, u.staff_id, u.first_name, u.last_name,
        u.email, u.phone, u.role, u.class, u.is_active,
        u.last_login, u.two_factor_enabled,
        h.name as house_name
      FROM users u
      LEFT JOIN houses h ON u.house_id = h.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (role) {
      query += ` AND u.role = $${paramCount}`;
      params.push(role);
      paramCount++;
    }
    
    if (house_id) {
      query += ` AND u.house_id = $${paramCount}`;
      params.push(house_id);
      paramCount++;
    }
    
    if (search) {
      query += ` AND (u.first_name ILIKE $${paramCount} OR u.last_name ILIKE $${paramCount} OR u.email ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }
    
    query += ' ORDER BY u.role, u.last_name, u.first_name';
    
    const result = await pool.query(query, params);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Failed to fetch users:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
});

// PUT toggle user active status
router.put('/users/:id/toggle-active', authenticate, authorize(['headmaster']), async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'UPDATE users SET is_active = NOT is_active WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES ($1, $2, $3, $4)',
      [req.user.id, 'USER_STATUS_CHANGED', `Changed active status for user ID: ${id}`, req.ip]
    );
    
    res.json({ success: true, data: result.rows[0], message: 'User status updated' });
  } catch (error) {
    console.error('Failed to toggle user status:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle user status' });
  }
});

// ==================== ANALYTICS & REPORTS ====================

// GET comprehensive analytics
router.get('/analytics/comprehensive', authenticate, authorize(['headmaster']), async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    // Overall statistics
    const overallStats = await pool.query(`
      SELECT 
        COUNT(*) as total_requests,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
        COUNT(CASE WHEN is_expired = true THEN 1 END) as expired,
        AVG(EXTRACT(EPOCH FROM (approved_at - created_at))/3600)::numeric(10,2) as avg_approval_hours
      FROM exeat_requests
      WHERE created_at >= COALESCE($1::timestamp, '2000-01-01')
      AND created_at <= COALESCE($2::timestamp, NOW())
    `, [start_date, end_date]);
    
    // By house
    const byHouse = await pool.query(`
      SELECT * FROM request_statistics
      ORDER BY total_requests DESC
    `);
    
    // By semester
    const bySemester = await pool.query(`
      SELECT 
        semester,
        academic_year,
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved
      FROM exeat_requests
      GROUP BY semester, academic_year
      ORDER BY academic_year DESC, semester DESC
    `);
    
    // Top students (most requests)
    const topStudents = await pool.query(`
      SELECT 
        u.first_name || ' ' || u.last_name as student_name,
        u.student_id,
        h.name as house_name,
        COUNT(r.id) as request_count
      FROM users u
      JOIN exeat_requests r ON u.id = r.student_id
      JOIN houses h ON u.house_id = h.id
      WHERE u.role = 'student'
      GROUP BY u.id, u.first_name, u.last_name, u.student_id, h.name
      ORDER BY request_count DESC
      LIMIT 10
    `);
    
    res.json({
      success: true,
      data: {
        overall: overallStats.rows[0],
        byHouse: byHouse.rows,
        bySemester: bySemester.rows,
        topStudents: topStudents.rows
      }
    });
  } catch (error) {
    console.error('Failed to fetch analytics:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch analytics' });
  }
});

module.exports = router;