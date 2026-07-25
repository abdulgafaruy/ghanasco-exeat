const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const bcrypt = require('bcrypt');

// GET all students
router.get('/students', authenticate, authorize(['admin', 'senior_housemaster']), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, first_name, last_name, student_id, phone, house_id, is_active FROM users WHERE role = $1 ORDER BY first_name ASC',
      ['student']
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ success: false, message: 'Error fetching students' });
  }
});

// POST add single student
router.post('/students', authenticate, authorize(['admin', 'senior_housemaster']), async (req, res) => {
  const { student_id, first_name, last_name, email, phone, house_id, password } = req.body;

  try {
    // Validate required fields
    if (!student_id || !first_name || !last_name || !email || !phone || !house_id) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Hash password (default to 'house123' if not provided)
    const hashedPassword = await bcrypt.hash(password || 'house123', 10);

    // Insert student
    const result = await pool.query(
      `INSERT INTO users (
        email, password_hash, first_name, last_name, student_id,
        phone, role, house_id, is_active, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING id, email, first_name, last_name, student_id, phone, house_id`,
      [email, hashedPassword, first_name, last_name, student_id, phone, 'student', house_id, true]
    );

    // Log action
    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'ADD_STUDENT', `Added student: ${first_name} ${last_name} (${email})`]
    );

    res.json({ success: true, message: 'Student added successfully', data: result.rows[0] });
  } catch (error) {
    console.error('Error adding student:', error);
    if (error.message.includes('duplicate key')) {
      return res.status(400).json({ success: false, message: 'Email or Student ID already exists' });
    }
    res.status(500).json({ success: false, message: 'Error adding student: ' + error.message });
  }
});

// POST bulk upload students (CSV)
router.post('/bulk-upload', authenticate, authorize(['admin', 'senior_housemaster']), async (req, res) => {
  try {
    const { csvContent } = req.body;
    
    if (!csvContent) {
      return res.status(400).json({ success: false, message: 'No CSV content provided' });
    }

    // Split by newlines (handle both \r\n and \n)
    let lines = csvContent.split(/\r?\n/).map(line => line.trim()).filter(line => line);
    
    console.log(`📊 CSV has ${lines.length} total lines`);

    if (lines.length < 2) {
      return res.status(400).json({ success: false, message: 'CSV file is empty' });
    }

    // Skip header row
    const headerLine = lines[0];
    console.log(`📋 Header: ${headerLine}`);
    
    const dataLines = lines.slice(1);
    let successCount = 0;
    let failureCount = 0;
    const errors = [];

    // Process each line
    for (let i = 0; i < dataLines.length; i++) {
      try {
        const line = dataLines[i];
        if (!line || line.length === 0) continue;

        // Parse CSV - handle quoted fields
        const parts = line.split(',').map(p => p.trim());
        
        console.log(`Row ${i + 2}: ${parts.length} fields - ${line.substring(0, 50)}`);

        if (parts.length < 6) {
          errors.push(`Row ${i + 2}: Invalid format (${parts.length}/6 columns)`);
          failureCount++;
          continue;
        }

        let [student_id, first_name, last_name, email, phone, house_id] = parts;

        // Clean up fields
        student_id = student_id.trim();
        first_name = first_name.trim();
        last_name = last_name.trim();
        email = email.trim();
        phone = phone.trim();
        house_id = house_id.trim();

        // Validate required fields
        if (!student_id || !first_name || !last_name || !email || !phone || !house_id) {
          errors.push(`Row ${i + 2}: Missing required field`);
          failureCount++;
          continue;
        }

        // Validate email format
        if (!email.includes('@')) {
          errors.push(`Row ${i + 2}: Invalid email`);
          failureCount++;
          continue;
        }

        // Validate house_id is a number
        const houseIdNum = parseInt(house_id);
        if (isNaN(houseIdNum) || houseIdNum < 1 || houseIdNum > 10) {
          errors.push(`Row ${i + 2}: House ID must be 1-10`);
          failureCount++;
          continue;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash('house123', 10);

        // Try to insert
        try {
          await pool.query(
            `INSERT INTO users (
              email, password_hash, first_name, last_name, student_id,
              phone, role, house_id, is_active, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
            [email, hashedPassword, first_name, last_name, student_id, phone, 'student', houseIdNum, true]
          );
          successCount++;
          if (successCount % 100 === 0) {
            console.log(`✅ Uploaded ${successCount} students...`);
          }
        } catch (dbError) {
          if (dbError.message.includes('duplicate key')) {
            errors.push(`Row ${i + 2}: Email or Student ID already exists`);
          } else {
            errors.push(`Row ${i + 2}: Database error`);
          }
          failureCount++;
        }

      } catch (error) {
        failureCount++;
        if (errors.length < 20) {
          errors.push(`Row ${i + 2}: ${error.message.substring(0, 50)}`);
        }
      }
    }

    // Log action
    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'BULK_UPLOAD', `Bulk uploaded ${successCount} students (${failureCount} failed)`]
    );

    console.log(`✅ Bulk upload complete: ${successCount} success, ${failureCount} failed`);

    res.json({ 
      success: true,
      message: `Successfully uploaded ${successCount} students`,
      successCount,
      failureCount,
      errors: errors.slice(0, 20) // Return first 20 errors
    });

  } catch (error) {
    console.error('❌ Bulk upload error:', error);
    res.status(500).json({ success: false, message: 'Error processing bulk upload: ' + error.message });
  }
});

// GET all houses
router.get('/houses', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, description FROM houses ORDER BY name ASC'
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching houses:', error);
    res.status(500).json({ success: false, message: 'Error fetching houses' });
  }
});

// GET audit logs (senior housemaster only)
router.get('/audit-logs', authenticate, authorize(['senior_housemaster', 'admin']), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        al.id, al.user_id, al.action, al.details, al.created_at,
        u.first_name, u.last_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.created_at DESC
      LIMIT 100`
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ success: false, message: 'Error fetching audit logs' });
  }
});

module.exports = router;
