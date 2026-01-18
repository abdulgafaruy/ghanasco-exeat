const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const bcrypt = require('bcrypt');
const { authenticate, authorize } = require('../middleware/auth');

// Audit log helper
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

// GET all students (filtered by house for housemasters)
router.get('/students', authenticate, authorize(['housemaster', 'headmaster']), async (req, res) => {
  try {
    let query = `
      SELECT 
        u.id, u.student_id, u.first_name, u.last_name, u.email, 
        u.phone, u.class, u.guardian_name, u.guardian_phone,
        u.is_active, u.created_at,
        h.name as house_name
      FROM users u
      LEFT JOIN houses h ON u.house_id = h.id
      WHERE u.role = 'student'
    `;
    
    const params = [];
    
    // Housemasters can only see their house students
    if (req.user.role === 'housemaster') {
      query += ' AND u.house_id = $1';
      params.push(req.user.house_id);
    }
    
    query += ' ORDER BY h.name, u.last_name, u.first_name';
    
    const result = await pool.query(query, params);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Failed to fetch students:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch students' });
  }
});

// POST add new student
router.post('/students', authenticate, authorize(['housemaster', 'headmaster']), async (req, res) => {
  try {
    const {
      student_id, first_name, last_name, email, password,
      phone, class: studentClass, house_id,
      guardian_name, guardian_phone
    } = req.body;
    
    // Validate required fields
    if (!student_id || !first_name || !last_name || !email || !password || !house_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide all required fields' 
      });
    }
    
    // Housemasters can only add students to their own house
    if (req.user.role === 'housemaster' && parseInt(house_id) !== req.user.house_id) {
      return res.status(403).json({ 
        success: false, 
        message: 'You can only add students to your own house' 
      });
    }
    
    // Check if student_id or email already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE student_id = $1 OR email = $2',
      [student_id, email]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Student ID or email already exists' 
      });
    }
    
    // Hash password
    const password_hash = await bcrypt.hash(password, 10);
    
    // Insert student
    const result = await pool.query(
      `INSERT INTO users (
        student_id, first_name, last_name, email, password_hash,
        phone, class, house_id, guardian_name, guardian_phone, role
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'student')
      RETURNING id, student_id, first_name, last_name, email, phone, class, house_id`,
      [
        student_id, first_name, last_name, email, password_hash,
        phone, studentClass, house_id, guardian_name, guardian_phone
      ]
    );
    
    await logAudit(
      req.user.id,
      'STUDENT_ADDED',
      `Added student: ${first_name} ${last_name} (${student_id})`,
      req.ip
    );
    
    res.json({ 
      success: true, 
      data: result.rows[0],
      message: 'Student added successfully' 
    });
  } catch (error) {
    console.error('Failed to add student:', error);
    res.status(500).json({ success: false, message: 'Failed to add student' });
  }
});

// PUT update student
router.put('/students/:id', authenticate, authorize(['housemaster', 'headmaster']), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      student_id, first_name, last_name, email,
      phone, class: studentClass, house_id,
      guardian_name, guardian_phone
    } = req.body;
    
    // Check if student exists
    const existingStudent = await pool.query(
      'SELECT * FROM users WHERE id = $1 AND role = $2',
      [id, 'student']
    );
    
    if (existingStudent.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    
    const student = existingStudent.rows[0];
    
    // Housemasters can only update students in their house
    if (req.user.role === 'housemaster' && student.house_id !== req.user.house_id) {
      return res.status(403).json({ 
        success: false, 
        message: 'You can only update students in your house' 
      });
    }
    
    // Housemasters cannot change house assignment
    if (req.user.role === 'housemaster' && house_id && parseInt(house_id) !== req.user.house_id) {
      return res.status(403).json({ 
        success: false, 
        message: 'You cannot transfer students to other houses' 
      });
    }
    
    // Update student
    const result = await pool.query(
      `UPDATE users SET
        student_id = $1, first_name = $2, last_name = $3, email = $4,
        phone = $5, class = $6, house_id = $7,
        guardian_name = $8, guardian_phone = $9
      WHERE id = $10 AND role = 'student'
      RETURNING id, student_id, first_name, last_name, email, phone, class, house_id`,
      [
        student_id, first_name, last_name, email,
        phone, studentClass, house_id,
        guardian_name, guardian_phone, id
      ]
    );
    
    await logAudit(
      req.user.id,
      'STUDENT_UPDATED',
      `Updated student: ${first_name} ${last_name} (${student_id})`,
      req.ip
    );
    
    res.json({ 
      success: true, 
      data: result.rows[0],
      message: 'Student updated successfully' 
    });
  } catch (error) {
    console.error('Failed to update student:', error);
    res.status(500).json({ success: false, message: 'Failed to update student' });
  }
});

// DELETE remove student (soft delete - deactivate)
router.delete('/students/:id', authenticate, authorize(['housemaster', 'headmaster']), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if student exists
    const existingStudent = await pool.query(
      'SELECT * FROM users WHERE id = $1 AND role = $2',
      [id, 'student']
    );
    
    if (existingStudent.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    
    const student = existingStudent.rows[0];
    
    // Housemasters can only remove students from their house
    if (req.user.role === 'housemaster' && student.house_id !== req.user.house_id) {
      return res.status(403).json({ 
        success: false, 
        message: 'You can only remove students from your house' 
      });
    }
    
    // Soft delete - deactivate the student
    await pool.query(
      'UPDATE users SET is_active = false WHERE id = $1',
      [id]
    );
    
    await logAudit(
      req.user.id,
      'STUDENT_REMOVED',
      `Removed student: ${student.first_name} ${student.last_name} (${student.student_id})`,
      req.ip
    );
    
    res.json({ 
      success: true, 
      message: 'Student removed successfully' 
    });
  } catch (error) {
    console.error('Failed to remove student:', error);
    res.status(500).json({ success: false, message: 'Failed to remove student' });
  }
});

// PUT reactivate student
router.put('/students/:id/reactivate', authenticate, authorize(['headmaster']), async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'UPDATE users SET is_active = true WHERE id = $1 AND role = $2 RETURNING *',
      [id, 'student']
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    
    const student = result.rows[0];
    
    await logAudit(
      req.user.id,
      'STUDENT_REACTIVATED',
      `Reactivated student: ${student.first_name} ${student.last_name}`,
      req.ip
    );
    
    res.json({ 
      success: true, 
      message: 'Student reactivated successfully' 
    });
  } catch (error) {
    console.error('Failed to reactivate student:', error);
    res.status(500).json({ success: false, message: 'Failed to reactivate student' });
  }
});

// POST reset student password
router.post('/students/:id/reset-password', authenticate, authorize(['housemaster', 'headmaster']), async (req, res) => {
  try {
    const { id } = req.params;
    const { new_password } = req.body;
    
    if (!new_password) {
      return res.status(400).json({ success: false, message: 'New password is required' });
    }
    
    // Check if student exists
    const existingStudent = await pool.query(
      'SELECT * FROM users WHERE id = $1 AND role = $2',
      [id, 'student']
    );
    
    if (existingStudent.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    
    const student = existingStudent.rows[0];
    
    // Housemasters can only reset passwords for their house students
    if (req.user.role === 'housemaster' && student.house_id !== req.user.house_id) {
      return res.status(403).json({ 
        success: false, 
        message: 'You can only reset passwords for students in your house' 
      });
    }
    
    // Hash new password
    const password_hash = await bcrypt.hash(new_password, 10);
    
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [password_hash, id]
    );
    
    await logAudit(
      req.user.id,
      'PASSWORD_RESET',
      `Reset password for student: ${student.first_name} ${student.last_name}`,
      req.ip
    );
    
    res.json({ 
      success: true, 
      message: 'Password reset successfully' 
    });
  } catch (error) {
    console.error('Failed to reset password:', error);
    res.status(500).json({ success: false, message: 'Failed to reset password' });
  }
});

module.exports = router;