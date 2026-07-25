import React, { useState, useEffect } from 'react';
import './App.css';
import { formatDateTime } from './utils/formatDate';

const API_URL = `http://${window.location.hostname}:5000/api`;

export default function App() {
  const [user, setUser] = useState(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0, expired: 0 });
  const [houseStats, setHouseStats] = useState([]);
  const [requests, setRequests] = useState([]);
  const [students, setStudents] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showStudentForm, setShowStudentForm] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  const [showNoteForm, setShowNoteForm] = useState(null);
  const [editingRequest, setEditingRequest] = useState(null);
  const [showRequestDetails, setShowRequestDetails] = useState(null);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
  const [noteText, setNoteText] = useState('');
  const [bulkFile, setBulkFile] = useState(null);
  const [theme, setTheme] = useState(localStorage.getItem('appTheme') || 'light');
  
  const [requestForm, setRequestForm] = useState({
    departure_date: '',
    return_date: '',
    destination: '',
    reason: '',
    guardian_name: '',
    guardian_phone: ''
  });

  const [houses, setHouses] = useState([]);
  const [studentForm, setStudentForm] = useState({
    student_id: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    house_id: '',
    password: 'house123'
  });

  // Login handler
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      const data = await response.json();
      if (data.success) {
        localStorage.setItem('token', data.data.token);
        localStorage.setItem('user', JSON.stringify(data.data.user));
        setUser(data.data.user);
        fetchDashboardData(data.data.token, data.data.user);
      } else {
        setLoginError(data.message || 'Login failed');
        setLoading(false);
      }
    } catch (error) {
      setLoginError('Connection error. Please check your network.');
      setLoading(false);
    }
  };

  // Fetch dashboard data
  const fetchDashboardData = async (token, userData) => {
    try {
      // Fetch requests first (most important)
      fetchRequests(token);
      
      // Try to fetch stats if endpoint exists
      try {
        const response = await fetch(`${API_URL}/requests`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success && data.data) {
          // Calculate stats from requests
          const requests = data.data;
          const stats = {
            total: requests.length,
            pending: requests.filter(r => r.status === 'pending').length,
            approved: requests.filter(r => r.status === 'approved').length,
            rejected: requests.filter(r => r.status === 'rejected').length
          };
          setStats(stats);
        }
      } catch (err) {
        console.warn('Could not fetch stats:', err);
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch requests list
  const fetchRequests = async (token) => {
    try {
      let url = `${API_URL}/requests`;
      if (selectedStatusFilter !== 'all') {
        url += `?status=${selectedStatusFilter}`;
      }
      console.log('📝 Fetching requests from:', url);
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token || localStorage.getItem('token')}` }
      });
      const data = await response.json();
      console.log('📊 Requests response:', data);
      if (data.success) {
        console.log(`✅ Setting ${data.data.length} requests`);
        setRequests(data.data);
      } else {
        console.error('❌ Failed to fetch requests:', data.message);
      }
    } catch (error) {
      console.error('❌ Error fetching requests:', error);
    }
  };

  // Fetch students
  const fetchStudents = async (token) => {
    try {
      const url = `${API_URL}/admin/students`;
      console.log('Fetching from:', url);
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token || localStorage.getItem('token')}` }
      });
      const data = await response.json();
      console.log('Students response:', data);
      if (data.success) {
        console.log('Setting students:', data.data.length, 'students');
        setStudents(data.data);
      } else {
        console.error('Failed to fetch students:', data.message);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  // Fetch houses for dropdown
  const fetchHouses = async (token) => {
    try {
      const response = await fetch(`${API_URL}/houses`, {
        headers: { 'Authorization': `Bearer ${token || localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (data.success) {
        setHouses(data.data);
      }
    } catch (error) {
      console.error('Error fetching houses:', error);
    }
  };

  // Fetch audit logs
  const fetchAuditLogs = async (token) => {
    try {
      const response = await fetch(`${API_URL}/audit-logs`, {
        headers: { 'Authorization': `Bearer ${token || localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (data.success) {
        setAuditLogs(data.data);
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    }
  };

  // Submit request handler
  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    try {
      const url = editingRequest ? `${API_URL}/requests/${editingRequest.id}` : `${API_URL}/requests`;
      const method = editingRequest ? 'PUT' : 'POST';
      console.log('Submitting request to:', url);
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({
          ...requestForm,
          student_id: user.id,
          house_id: user.house_id
        })
      });
      const data = await response.json();
      console.log('Response:', data);
      
      if (data.success) {
        setShowStudentForm(false);
        setEditingRequest(null);
        setRequestForm({ departure_date: '', return_date: '', destination: '', reason: '', guardian_name: '', guardian_phone: '' });
        
        // Refresh both dashboard and requests list
        fetchDashboardData(localStorage.getItem('token'), user);
        
        // Wait a bit then refresh requests
        setTimeout(() => {
          console.log('Refreshing requests list...');
          fetchRequests(localStorage.getItem('token'));
        }, 500);
        
        alert('✅ Request submitted successfully! Refreshing list...');
      } else {
        console.error('Request failed:', data);
        alert(data.message || 'Failed to submit request');
      }
    } catch (error) {
      console.error('Error submitting request:', error);
      alert('❌ Connection error: ' + error.message);
    }
  };

  // Add single student
  const handleAddStudent = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/admin/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(studentForm)
      });
      const data = await response.json();
      console.log('Student response:', data);
      
      if (data.success) {
        setShowStudentForm(false);
        setStudentForm({ student_id: '', first_name: '', last_name: '', email: '', phone: '', house_id: '', password: 'house123' });
        
        // Wait a bit then refresh
        setTimeout(() => {
          console.log('Refreshing students list...');
          fetchStudents(localStorage.getItem('token'));
        }, 500);
        
        alert('✅ Student added successfully! Refreshing list...');
      } else {
        console.error('Failed response:', data);
        alert(data.message || 'Failed to add student');
      }
    } catch (error) {
      console.error('Error adding student:', error);
      alert('❌ Error: ' + error.message);
    }
  };

  // Bulk upload students
  const handleBulkUpload = async (e) => {
    e.preventDefault();
    if (!bulkFile) {
      alert('Please select a file');
      return;
    }

    const formData = new FormData();
    formData.append('file', bulkFile);

    try {
      const response = await fetch(`${API_URL}/admin/bulk-upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: formData
      });
      const data = await response.json();
      if (data.success) {
        setShowBulkUpload(false);
        setBulkFile(null);
        fetchStudents(localStorage.getItem('token'));
        alert(`Successfully uploaded ${data.count} students`);
      } else {
        alert(data.message || 'Failed to upload');
      }
    } catch (error) {
      alert('Error uploading file');
    }
  };

  // Approve request handler
  const handleApproveRequest = async (id) => {
    try {
      const response = await fetch(`${API_URL}/requests/${id}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (data.success) {
        fetchRequests(localStorage.getItem('token'));
        alert('Request approved successfully');
      } else {
        alert(data.message || 'Failed to approve request');
      }
    } catch (error) {
      alert('Error approving request');
    }
  };

  // Reject request handler
  const handleRejectRequest = async (id) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;

    try {
      const response = await fetch(`${API_URL}/requests/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ rejection_reason: reason })
      });
      const data = await response.json();
      if (data.success) {
        fetchRequests(localStorage.getItem('token'));
        alert('Request rejected successfully');
      } else {
        alert(data.message || 'Failed to reject request');
      }
    } catch (error) {
      alert('Error rejecting request');
    }
  };

  // Add note
  const handleAddNote = async (requestId) => {
    if (!noteText.trim()) {
      alert('Please enter a note');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/requests/${requestId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ note: noteText })
      });
      const data = await response.json();
      if (data.success) {
        setNoteText('');
        setShowNoteForm(null);
        fetchRequests(localStorage.getItem('token'));
        alert('Note added successfully');
      } else {
        alert(data.message || 'Failed to add note');
      }
    } catch (error) {
      alert('Error adding note');
    }
  };

  // Print request
  const handlePrintRequest = (request) => {
    const printWindow = window.open('', '', 'height=600,width=800');
    printWindow.document.write(`
      <html>
        <head>
          <title>GHANASCO - Exeat Request</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .header h1 { margin: 0; color: #1a1a1a; }
            .header p { margin: 5px 0; color: #666; }
            .section { margin-bottom: 20px; }
            .label { font-weight: 600; color: #666; font-size: 12px; }
            .value { font-size: 14px; margin-bottom: 10px; }
            .row { display: flex; gap: 40px; }
            .col { flex: 1; }
            .signature-section { margin-top: 40px; display: flex; gap: 80px; }
            .signature-line { border-top: 1px solid #000; width: 150px; text-align: center; margin-top: 40px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>GHANASCO</h1>
            <p>Exeat Request Form</p>
          </div>
          
          <div class="section">
            <div class="row">
              <div class="col">
                <div class="label">DESTINATION</div>
                <div class="value">${request.destination}</div>
              </div>
              <div class="col">
                <div class="label">STATUS</div>
                <div class="value">${request.status.toUpperCase()}</div>
              </div>
            </div>
          </div>

          <div class="section">
            <div class="row">
              <div class="col">
                <div class="label">DATE LEAVING</div>
                <div class="value">${formatDateTime(request.departure_date)}</div>
              </div>
              <div class="col">
                <div class="label">DATE RETURNING</div>
                <div class="value">${formatDateTime(request.return_date)}</div>
              </div>
            </div>
          </div>

          <div class="section">
            <div class="label">REASON</div>
            <div class="value">${request.reason}</div>
          </div>

          <div class="section">
            <div class="row">
              <div class="col">
                <div class="label">GUARDIAN NAME</div>
                <div class="value">${request.guardian_name}</div>
              </div>
              <div class="col">
                <div class="label">GUARDIAN PHONE</div>
                <div class="value">${request.guardian_phone}</div>
              </div>
            </div>
          </div>

          <div class="section">
            <div class="label">REQUEST ID</div>
            <div class="value">#${request.id}</div>
          </div>

          <div class="signature-section">
            <div>
              <div>Student Signature</div>
              <div class="signature-line"></div>
            </div>
            <div>
              <div>Housemaster Signature</div>
              <div class="signature-line"></div>
            </div>
          </div>

          <p style="text-align: center; margin-top: 40px; color: #999; font-size: 12px;">
            Printed from GHANASCO Exeat Management System
          </p>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // Cancel request
  const handleCancelRequest = async (id) => {
    const reason = prompt('Enter cancellation reason:');
    if (!reason) return;

    try {
      const response = await fetch(`${API_URL}/requests/${id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ reason })
      });
      const data = await response.json();
      if (data.success) {
        fetchRequests(localStorage.getItem('token'));
        alert('Request cancelled successfully');
      } else {
        alert(data.message || 'Failed to cancel request');
      }
    } catch (error) {
      alert('Error cancelling request');
    }
  };

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setStats({ total: 0, pending: 0, approved: 0, rejected: 0 });
    setRequests([]);
    setActiveTab('dashboard');
  };

  // Load user on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      const user = JSON.parse(userData);
      setUser(user);
      fetchDashboardData(token, user);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchRequests(localStorage.getItem('token'));
    }
  }, [selectedStatusFilter]);

  // Theme toggle effect
  useEffect(() => {
    localStorage.setItem('appTheme', theme);
    document.documentElement.style.setProperty('--bg-primary', theme === 'light' ? '#ffffff' : '#1a1a1a');
    document.documentElement.style.setProperty('--bg-secondary', theme === 'light' ? '#f5f5f5' : '#2a2a2a');
    document.documentElement.style.setProperty('--text-primary', theme === 'light' ? '#1a1a1a' : '#ffffff');
    document.documentElement.style.setProperty('--text-secondary', theme === 'light' ? '#666666' : '#aaaaaa');
  }, [theme]);

  // Fetch students when activeTab changes to 'students'
  useEffect(() => {
    if (activeTab === 'students' && user) {
      console.log('Active tab changed to students, fetching...');
      fetchStudents(localStorage.getItem('token'));
    }
  }, [activeTab]);

  // Auto-fetch requests when requests tab is active
  useEffect(() => {
    if (activeTab === 'requests' && user) {
      console.log('Active tab changed to requests, fetching...');
      fetchRequests(localStorage.getItem('token'));
    }
  }, [activeTab]);

  if (!user) {
    return (
      <div style={{minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #00D9FF 0%, #7B2CBF 100%)'}}>
        <div style={{backgroundColor: 'white', padding: '40px', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', width: '100%', maxWidth: '420px', textAlign: 'center'}}>
          <img src="/GHANASCO_CREST.jpg" alt="GHANASCO Crest" style={{width: '80px', height: '80px', marginBottom: '20px', objectFit: 'contain'}}/>
          <h1 style={{textAlign: 'center', marginBottom: '5px', color: '#1a1a1a', fontSize: '28px', fontWeight: '700'}}>GHANASCO</h1>
          <p style={{textAlign: 'center', marginBottom: '30px', color: '#666', fontSize: '14px'}}>Exeat Management System</p>
          
          {loginError && <div style={{backgroundColor: '#fee', color: '#c33', padding: '12px', borderRadius: '4px', marginBottom: '20px', fontSize: '14px'}}>{loginError}</div>}
          
          <form onSubmit={handleLogin}>
            <div style={{marginBottom: '15px'}}>
              <input 
                type="email" 
                placeholder="Email" 
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                style={{width: '100%', padding: '12px', border: '2px solid #00D9FF', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box'}}
                required
              />
            </div>
            <div style={{marginBottom: '20px'}}>
              <input 
                type="password" 
                placeholder="Password (house123)" 
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                style={{width: '100%', padding: '12px', border: '2px solid #7B2CBF', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box'}}
                required
              />
            </div>
            <button 
              type="submit" 
              disabled={loading}
              style={{width: '100%', padding: '12px', background: 'linear-gradient(135deg, #00D9FF 0%, #7B2CBF 100%)', color: 'white', border: 'none', borderRadius: '4px', fontSize: '16px', fontWeight: '600', cursor: 'pointer'}}
            >
              {loading ? 'Logging in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{minHeight: '100vh', backgroundColor: theme === 'light' ? '#f5f7fa' : '#1a1a1a', color: theme === 'light' ? '#1a1a1a' : '#ffffff', transition: 'background-color 0.3s ease'}}>
      <header style={{background: theme === 'light' ? 'linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)' : 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)', color: theme === 'light' ? '#1a1a1a' : 'white', padding: '15px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: theme === 'light' ? '0 2px 8px rgba(0,0,0,0.08)' : '0 4px 12px rgba(0,0,0,0.3)', borderBottom: theme === 'light' ? '1px solid #e0e0e0' : '1px solid #444'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
          <img src="/GHANASCO_CREST.jpg" alt="GHANASCO" style={{width: '45px', height: '45px', objectFit: 'contain'}}/>
          <div>
            <h1 style={{margin: '0', fontSize: '22px', fontWeight: '700', color: theme === 'light' ? '#1a1a1a' : '#ffffff'}}>GHANASCO</h1>
            <p style={{margin: '0', fontSize: '12px', color: theme === 'light' ? '#666' : '#aaa'}}>Exeat Management System</p>
          </div>
        </div>
        <div style={{display: 'flex', gap: '15px', alignItems: 'center'}}>
          {/* Theme Toggle Button */}
          <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} style={{backgroundColor: theme === 'light' ? '#f0f0f0' : '#444', color: theme === 'light' ? '#1a1a1a' : '#fff', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '18px', fontWeight: '600', transition: 'all 0.3s ease'}}>
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          
          {/* User Profile */}
          <div style={{textAlign: 'right', paddingRight: '10px', borderRight: theme === 'light' ? '1px solid #e0e0e0' : '1px solid #444'}}>
            <div style={{fontSize: '13px', fontWeight: '600', color: theme === 'light' ? '#1a1a1a' : '#ffffff'}}>{user.first_name} {user.last_name}</div>
            <div style={{fontSize: '11px', color: theme === 'light' ? '#666' : '#aaa', textTransform: 'capitalize'}}>{user.role}</div>
          </div>
          
          {/* Logout Button */}
          <button onClick={handleLogout} style={{backgroundColor: '#f44336', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', transition: 'all 0.3s ease', hover: {opacity: 0.9}}}>Logout</button>
        </div>
      </header>

      <div style={{padding: '20px 30px', maxWidth: '1400px', margin: '0 auto'}}>
        <div style={{display: 'flex', gap: '5px', marginBottom: '20px', borderBottom: theme === 'light' ? '2px solid #e0e0e0' : '2px solid #444', overflowX: 'auto', paddingBottom: '0'}}>
          {(user.role === 'student' || user.role === 'admin') && (
            <button onClick={() => setActiveTab('dashboard')} style={{padding: '12px 20px', background: activeTab === 'dashboard' ? 'linear-gradient(135deg, #00D9FF 0%, #7B2CBF 100%)' : 'transparent', color: activeTab === 'dashboard' ? 'white' : theme === 'light' ? '#666' : '#aaa', border: 'none', borderRadius: '4px 4px 0 0', cursor: 'pointer', fontWeight: '600', whiteSpace: 'nowrap', transition: 'all 0.3s ease'}}>📊 Dashboard</button>
          )}
          {(user.role === 'student' || user.role === 'housemaster' || user.role === 'senior_housemaster' || user.role === 'admin') && (
            <button onClick={() => { setActiveTab('requests'); console.log('Fetching requests...'); fetchRequests(localStorage.getItem('token')); }} style={{padding: '12px 20px', background: activeTab === 'requests' ? 'linear-gradient(135deg, #00D9FF 0%, #7B2CBF 100%)' : 'transparent', color: activeTab === 'requests' ? 'white' : theme === 'light' ? '#666' : '#aaa', border: 'none', borderRadius: '4px 4px 0 0', cursor: 'pointer', fontWeight: '600', whiteSpace: 'nowrap', transition: 'all 0.3s ease'}}>📝 Requests</button>
          )}
          {(user.role === 'admin' || user.role === 'senior_housemaster') && (
            <button onClick={() => { 
              setActiveTab('students');
              console.log('Fetching students...');
              fetchStudents(localStorage.getItem('token'));
            }} style={{padding: '12px 20px', background: activeTab === 'students' ? 'linear-gradient(135deg, #00D9FF 0%, #7B2CBF 100%)' : 'transparent', color: activeTab === 'students' ? 'white' : '#666', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', whiteSpace: 'nowrap'}}>Students</button>
          )}
          {user.role === 'senior_housemaster' && (
            <button onClick={() => setActiveTab('analysis')} style={{padding: '12px 20px', background: activeTab === 'analysis' ? 'linear-gradient(135deg, #00D9FF 0%, #7B2CBF 100%)' : 'transparent', color: activeTab === 'analysis' ? 'white' : theme === 'light' ? '#666' : '#aaa', border: 'none', borderRadius: '4px 4px 0 0', cursor: 'pointer', fontWeight: '600', whiteSpace: 'nowrap', transition: 'all 0.3s ease'}}>📈 Analysis</button>
          )}
          {user.role === 'senior_housemaster' && (
            <button onClick={() => { setActiveTab('audit'); fetchAuditLogs(localStorage.getItem('token')); }} style={{padding: '12px 20px', background: activeTab === 'audit' ? 'linear-gradient(135deg, #00D9FF 0%, #7B2CBF 100%)' : 'transparent', color: activeTab === 'audit' ? 'white' : theme === 'light' ? '#666' : '#aaa', border: 'none', borderRadius: '4px 4px 0 0', cursor: 'pointer', fontWeight: '600', whiteSpace: 'nowrap', transition: 'all 0.3s ease'}}>📋 Audit Logs</button>
          )}
        </div>

        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div>
            <h2 style={{color: '#1a1a1a', marginBottom: '25px'}}>Dashboard</h2>
            
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '15px', marginBottom: '30px'}}>
              <div style={{background: 'linear-gradient(135deg, #00D9FF 0%, #00B8D4 100%)', color: 'white', padding: '20px', borderRadius: '8px', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,217,255,0.3)'}}>
                <p style={{margin: '0 0 8px 0', fontSize: '24px', fontWeight: '700'}}>{stats.total}</p>
                <p style={{margin: 0, fontSize: '12px'}}>Total</p>
              </div>
              <div style={{background: 'linear-gradient(135deg, #7B2CBF 0%, #5A1E99 100%)', color: 'white', padding: '20px', borderRadius: '8px', textAlign: 'center', boxShadow: '0 4px 12px rgba(123,44,191,0.3)'}}>
                <p style={{margin: '0 0 8px 0', fontSize: '24px', fontWeight: '700'}}>{stats.pending}</p>
                <p style={{margin: 0, fontSize: '12px'}}>Pending</p>
              </div>
              <div style={{background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', padding: '20px', borderRadius: '8px', textAlign: 'center', boxShadow: '0 4px 12px rgba(16,185,129,0.3)'}}>
                <p style={{margin: '0 0 8px 0', fontSize: '24px', fontWeight: '700'}}>{stats.approved}</p>
                <p style={{margin: 0, fontSize: '12px'}}>Approved</p>
              </div>
              <div style={{background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', color: 'white', padding: '20px', borderRadius: '8px', textAlign: 'center', boxShadow: '0 4px 12px rgba(239,68,68,0.3)'}}>
                <p style={{margin: '0 0 8px 0', fontSize: '24px', fontWeight: '700'}}>{stats.rejected}</p>
                <p style={{margin: 0, fontSize: '12px'}}>Rejected</p>
              </div>
            </div>

            {(user.role === 'housemaster' || user.role === 'senior_housemaster') && houseStats.length > 0 && (
              <div style={{marginTop: '30px'}}>
                <h3 style={{color: '#1a1a1a', marginBottom: '15px'}}>House Statistics</h3>
                <div style={{backgroundColor: 'white', borderRadius: '8px', overflowX: 'auto', boxShadow: '0 2px 8px rgba(0,0,0,0.08)'}}>
                  <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '13px'}}>
                    <thead>
                      <tr style={{backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb'}}>
                        <th style={{padding: '12px', textAlign: 'left', fontWeight: '600'}}>House</th>
                        <th style={{padding: '12px', textAlign: 'center', fontWeight: '600'}}>Total</th>
                        <th style={{padding: '12px', textAlign: 'center', fontWeight: '600'}}>Pending</th>
                        <th style={{padding: '12px', textAlign: 'center', fontWeight: '600'}}>Approved</th>
                        <th style={{padding: '12px', textAlign: 'center', fontWeight: '600'}}>Rejected</th>
                      </tr>
                    </thead>
                    <tbody>
                      {houseStats.map(house => (
                        <tr key={house.house_id} style={{borderBottom: '1px solid #e5e7eb'}}>
                          <td style={{padding: '12px'}}>{house.house_name}</td>
                          <td style={{padding: '12px', textAlign: 'center', fontWeight: '600'}}>{house.total}</td>
                          <td style={{padding: '12px', textAlign: 'center', color: '#7B2CBF', fontWeight: '600'}}>{house.pending}</td>
                          <td style={{padding: '12px', textAlign: 'center', color: '#10b981', fontWeight: '600'}}>{house.approved}</td>
                          <td style={{padding: '12px', textAlign: 'center', color: '#ef4444', fontWeight: '600'}}>{house.rejected}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {user.role === 'student' && (
              <button onClick={() => setShowRequestForm(true)} style={{background: 'linear-gradient(135deg, #00D9FF 0%, #7B2CBF 100%)', color: 'white', padding: '14px 28px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '15px', fontWeight: '600', boxShadow: '0 4px 12px rgba(0,217,255,0.3)'}}>✍️ Submit New Request</button>
            )}
          </div>
        )}

        {/* REQUESTS TAB */}
        {activeTab === 'requests' && (
          <div>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
              <h2 style={{color: '#1a1a1a', margin: 0}}>All Requests</h2>
              <select value={selectedStatusFilter} onChange={(e) => setSelectedStatusFilter(e.target.value)} style={{padding: '8px 12px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer'}}>
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            
            <div style={{display: 'grid', gap: '15px'}}>
              {requests.length > 0 ? requests.map(req => (
                <div key={req.id} style={{backgroundColor: 'white', padding: '18px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', cursor: 'pointer', borderLeft: '4px solid', borderLeftColor: req.status === 'pending' ? '#7B2CBF' : req.status === 'approved' ? '#10b981' : '#ef4444'}} onClick={() => setShowRequestDetails(req)}>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'start'}}>
                    <div style={{flex: 1}}>
                      <p style={{margin: '0 0 8px 0', fontWeight: '600', color: '#1a1a1a'}}>{req.destination}</p>
                      <p style={{margin: '0 0 6px 0', fontSize: '13px', color: '#666'}}>{formatDateTime(req.departure_date)} to {formatDateTime(req.return_date)}</p>
                      <p style={{margin: '0 0 4px 0', fontSize: '12px', color: '#999'}}>Guardian: {req.guardian_name}</p>
                      <p style={{margin: 0, fontSize: '12px', color: '#999'}}>Reason: {req.reason}</p>
                    </div>
                    <div style={{textAlign: 'right'}}>
                      <span style={{display: 'inline-block', padding: '6px 14px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', backgroundColor: req.status === 'pending' ? '#F3E8FF' : req.status === 'approved' ? '#D1FAE5' : '#FEE2E2', color: req.status === 'pending' ? '#7B2CBF' : req.status === 'approved' ? '#065F46' : '#991B1B', textTransform: 'uppercase', whiteSpace: 'nowrap'}}>
                        {req.status}
                      </span>
                    </div>
                  </div>
                </div>
              )) : (
                <div style={{textAlign: 'center', padding: '40px'}}>
                  <p style={{color: '#999', marginBottom: '10px'}}>No requests found</p>
                  <p style={{color: '#ccc', fontSize: '12px'}}>Total requests in state: {requests?.length || 0}</p>
                  <button onClick={() => fetchRequests(localStorage.getItem('token'))} style={{marginTop: '10px', padding: '8px 16px', background: '#00D9FF', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'}}>🔄 Refresh</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STUDENTS TAB */}
        {activeTab === 'students' && (
          <div>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
              <h2 style={{color: '#1a1a1a', margin: 0}}>Students Management</h2>
              <div style={{display: 'flex', gap: '10px'}}>
                <button onClick={() => setShowStudentForm(true)} style={{background: 'linear-gradient(135deg, #00D9FF 0%, #7B2CBF 100%)', color: 'white', padding: '10px 20px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px'}}>➕ Add Student</button>
                <button onClick={() => setShowBulkUpload(true)} style={{background: 'linear-gradient(135deg, #7B2CBF 0%, #00D9FF 100%)', color: 'white', padding: '10px 20px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px'}}>📤 Bulk Upload</button>
              </div>
            </div>
            
            <div style={{backgroundColor: 'white', borderRadius: '8px', overflowX: 'auto', boxShadow: '0 2px 8px rgba(0,0,0,0.08)'}}>
              <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '12px'}}>
                <thead>
                  <tr style={{backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb'}}>
                    <th style={{padding: '12px', textAlign: 'left', fontWeight: '600'}}>ID</th>
                    <th style={{padding: '12px', textAlign: 'left', fontWeight: '600'}}>Name</th>
                    <th style={{padding: '12px', textAlign: 'left', fontWeight: '600'}}>Email</th>
                    <th style={{padding: '12px', textAlign: 'left', fontWeight: '600'}}>Phone</th>
                    <th style={{padding: '12px', textAlign: 'left', fontWeight: '600'}}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(student => (
                    <tr key={student.id} style={{borderBottom: '1px solid #e5e7eb'}}>
                      <td style={{padding: '12px'}}>{student.student_id}</td>
                      <td style={{padding: '12px'}}>{student.first_name} {student.last_name}</td>
                      <td style={{padding: '12px'}}>{student.email}</td>
                      <td style={{padding: '12px'}}>{student.phone}</td>
                      <td style={{padding: '12px'}}><span style={{padding: '3px 8px', borderRadius: '3px', fontSize: '10px', backgroundColor: student.is_active ? '#D1FAE5' : '#FEE2E2', color: student.is_active ? '#065F46' : '#991B1B', fontWeight: '600'}}>{student.is_active ? 'Active' : 'Inactive'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ANALYSIS TAB */}
      {activeTab === 'analysis' && (
        <div style={{background: theme === 'light' ? '#f5f7fa' : '#1a1a1a'}}>
          <div style={{padding: '20px 30px', maxWidth: '1400px', margin: '0 auto'}}>
            <h2 style={{color: theme === 'light' ? '#1a1a1a' : '#ffffff', marginBottom: '20px'}}>📈 Request Analytics</h2>
            
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '30px'}}>
              {/* Stat Cards */}
              <div style={{background: theme === 'light' ? 'white' : '#2a2a2a', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: 'left 4px solid #00D9FF'}}>
                <div style={{fontSize: '12px', color: theme === 'light' ? '#666' : '#aaa', marginBottom: '8px'}}>Total Requests</div>
                <div style={{fontSize: '32px', fontWeight: '700', color: '#00D9FF'}}>{requests.length}</div>
              </div>
              
              <div style={{background: theme === 'light' ? 'white' : '#2a2a2a', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: 'left 4px solid #ff9800'}}>
                <div style={{fontSize: '12px', color: theme === 'light' ? '#666' : '#aaa', marginBottom: '8px'}}>Pending Requests</div>
                <div style={{fontSize: '32px', fontWeight: '700', color: '#ff9800'}}>{requests.filter(r => r.status === 'pending').length}</div>
              </div>
              
              <div style={{background: theme === 'light' ? 'white' : '#2a2a2a', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: 'left 4px solid #4caf50'}}>
                <div style={{fontSize: '12px', color: theme === 'light' ? '#666' : '#aaa', marginBottom: '8px'}}>Approved Requests</div>
                <div style={{fontSize: '32px', fontWeight: '700', color: '#4caf50'}}>{requests.filter(r => r.status === 'approved').length}</div>
              </div>
              
              <div style={{background: theme === 'light' ? 'white' : '#2a2a2a', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: 'left 4px solid #f44336'}}>
                <div style={{fontSize: '12px', color: theme === 'light' ? '#666' : '#aaa', marginBottom: '8px'}}>Rejected Requests</div>
                <div style={{fontSize: '32px', fontWeight: '700', color: '#f44336'}}>{requests.filter(r => r.status === 'rejected').length}</div>
              </div>
            </div>
            
            {/* Request Breakdown */}
            <div style={{background: theme === 'light' ? 'white' : '#2a2a2a', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)'}}>
              <h3 style={{color: theme === 'light' ? '#1a1a1a' : '#ffffff', marginTop: 0}}>Request Status Breakdown</h3>
              
              <div style={{marginBottom: '20px'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '5px'}}>
                  <span style={{color: theme === 'light' ? '#666' : '#aaa'}}>Pending</span>
                  <span style={{color: theme === 'light' ? '#1a1a1a' : '#ffffff', fontWeight: '600'}}>
                    {requests.length > 0 ? Math.round((requests.filter(r => r.status === 'pending').length / requests.length) * 100) : 0}%
                  </span>
                </div>
                <div style={{background: theme === 'light' ? '#f0f0f0' : '#444', height: '8px', borderRadius: '4px', overflow: 'hidden'}}>
                  <div style={{background: '#ff9800', height: '100%', width: requests.length > 0 ? (requests.filter(r => r.status === 'pending').length / requests.length) * 100 + '%' : '0%'}}></div>
                </div>
              </div>
              
              <div style={{marginBottom: '20px'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '5px'}}>
                  <span style={{color: theme === 'light' ? '#666' : '#aaa'}}>Approved</span>
                  <span style={{color: theme === 'light' ? '#1a1a1a' : '#ffffff', fontWeight: '600'}}>
                    {requests.length > 0 ? Math.round((requests.filter(r => r.status === 'approved').length / requests.length) * 100) : 0}%
                  </span>
                </div>
                <div style={{background: theme === 'light' ? '#f0f0f0' : '#444', height: '8px', borderRadius: '4px', overflow: 'hidden'}}>
                  <div style={{background: '#4caf50', height: '100%', width: requests.length > 0 ? (requests.filter(r => r.status === 'approved').length / requests.length) * 100 + '%' : '0%'}}></div>
                </div>
              </div>
              
              <div>
                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '5px'}}>
                  <span style={{color: theme === 'light' ? '#666' : '#aaa'}}>Rejected</span>
                  <span style={{color: theme === 'light' ? '#1a1a1a' : '#ffffff', fontWeight: '600'}}>
                    {requests.length > 0 ? Math.round((requests.filter(r => r.status === 'rejected').length / requests.length) * 100) : 0}%
                  </span>
                </div>
                <div style={{background: theme === 'light' ? '#f0f0f0' : '#444', height: '8px', borderRadius: '4px', overflow: 'hidden'}}>
                  <div style={{background: '#f44336', height: '100%', width: requests.length > 0 ? (requests.filter(r => r.status === 'rejected').length / requests.length) * 100 + '%' : '0%'}}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AUDIT TAB */}
      {activeTab === 'audit' && (
        <div style={{background: theme === 'light' ? '#f5f7fa' : '#1a1a1a'}}>
          <div style={{padding: '20px 30px', maxWidth: '1400px', margin: '0 auto'}}>
            <h2 style={{color: theme === 'light' ? '#1a1a1a' : '#ffffff', marginBottom: '20px'}}>📋 Audit Logs</h2>
            <div style={{backgroundColor: theme === 'light' ? 'white' : '#2a2a2a', borderRadius: '8px', overflowX: 'auto', boxShadow: '0 2px 8px rgba(0,0,0,0.1)'}}>
              <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '12px'}}>
                <thead>
                  <tr style={{backgroundColor: theme === 'light' ? '#f3f4f6' : '#3a3a3a', borderBottom: theme === 'light' ? '2px solid #e5e7eb' : '2px solid #555'}}>
                    <th style={{padding: '12px', textAlign: 'left', fontWeight: '600', color: theme === 'light' ? '#1a1a1a' : '#fff'}}>Action</th>
                    <th style={{padding: '12px', textAlign: 'left', fontWeight: '600', color: theme === 'light' ? '#1a1a1a' : '#fff'}}>User</th>
                    <th style={{padding: '12px', textAlign: 'left', fontWeight: '600', color: theme === 'light' ? '#1a1a1a' : '#fff'}}>Details</th>
                    <th style={{padding: '12px', textAlign: 'left', fontWeight: '600', color: theme === 'light' ? '#1a1a1a' : '#fff'}}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.length > 0 ? auditLogs.map(log => (
                    <tr key={log.id} style={{borderBottom: theme === 'light' ? '1px solid #e5e7eb' : '1px solid #444'}}>
                      <td style={{padding: '12px'}}><span style={{padding: '3px 8px', borderRadius: '3px', backgroundColor: '#F3E8FF', color: '#7B2CBF', fontWeight: '600', fontSize: '10px'}}>{log.action}</span></td>
                      <td style={{padding: '12px', color: theme === 'light' ? '#1a1a1a' : '#aaa'}}>{log.first_name} {log.last_name}</td>
                      <td style={{padding: '12px', color: theme === 'light' ? '#666' : '#aaa'}}>{log.details}</td>
                      <td style={{padding: '12px', color: theme === 'light' ? '#999' : '#888', fontSize: '11px'}}>{formatDateTime(log.created_at)}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="4" style={{padding: '20px', textAlign: 'center', color: theme === 'light' ? '#999' : '#666'}}>No audit logs found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showRequestForm && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000}}>
          <div style={{backgroundColor: 'white', padding: '30px', borderRadius: '12px', maxWidth: '500px', width: '90%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.3)'}}>
            <h2 style={{marginTop: 0, color: '#1a1a1a'}}>New Exeat Request</h2>
            <form onSubmit={handleSubmitRequest}>
              <div style={{marginBottom: '15px'}}>
                <label style={{display: 'block', marginBottom: '6px', fontWeight: '600', color: '#1a1a1a', fontSize: '13px'}}>Date Leaving *</label>
                <input type="date" value={requestForm.departure_date} onChange={(e) => setRequestForm({...requestForm, departure_date: e.target.value})} style={{width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', borderLeft: '3px solid #00D9FF'}} required/>
              </div>
              <div style={{marginBottom: '15px'}}>
                <label style={{display: 'block', marginBottom: '6px', fontWeight: '600', color: '#1a1a1a', fontSize: '13px'}}>Date Returning *</label>
                <input type="date" value={requestForm.return_date} onChange={(e) => setRequestForm({...requestForm, return_date: e.target.value})} style={{width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', borderLeft: '3px solid #7B2CBF'}} required/>
              </div>
              <div style={{marginBottom: '15px'}}>
                <label style={{display: 'block', marginBottom: '6px', fontWeight: '600', color: '#1a1a1a', fontSize: '13px'}}>Destination *</label>
                <input type="text" placeholder="Where are you going?" value={requestForm.destination} onChange={(e) => setRequestForm({...requestForm, destination: e.target.value})} style={{width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box'}} required/>
              </div>
              <div style={{marginBottom: '15px'}}>
                <label style={{display: 'block', marginBottom: '6px', fontWeight: '600', color: '#1a1a1a', fontSize: '13px'}}>Reason *</label>
                <textarea placeholder="Why do you need to leave?" value={requestForm.reason} onChange={(e) => setRequestForm({...requestForm, reason: e.target.value})} style={{width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', minHeight: '80px'}} required/>
              </div>
              <div style={{marginBottom: '15px'}}>
                <label style={{display: 'block', marginBottom: '6px', fontWeight: '600', color: '#1a1a1a', fontSize: '13px'}}>Guardian Name *</label>
                <input type="text" placeholder="Guardian's name" value={requestForm.guardian_name} onChange={(e) => setRequestForm({...requestForm, guardian_name: e.target.value})} style={{width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box'}} required/>
              </div>
              <div style={{marginBottom: '22px'}}>
                <label style={{display: 'block', marginBottom: '6px', fontWeight: '600', color: '#1a1a1a', fontSize: '13px'}}>Guardian Phone *</label>
                <input type="tel" placeholder="+233XXXXXXXXX" value={requestForm.guardian_phone} onChange={(e) => setRequestForm({...requestForm, guardian_phone: e.target.value})} style={{width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box'}} required/>
              </div>
              <div style={{display: 'flex', gap: '12px'}}>
                <button type="submit" style={{flex: 1, padding: '12px', background: 'linear-gradient(135deg, #00D9FF 0%, #7B2CBF 100%)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600'}}>Submit</button>
                <button type="button" onClick={() => setShowRequestForm(false)} style={{flex: 1, padding: '12px', backgroundColor: '#e5e7eb', color: '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600'}}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STUDENT FORM MODAL */}
      {showStudentForm && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000}}>
          <div style={{backgroundColor: 'white', padding: '30px', borderRadius: '12px', maxWidth: '500px', width: '90%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.3)'}}>
            <h2 style={{marginTop: 0, color: '#1a1a1a'}}>Add Student</h2>
            <form onSubmit={handleAddStudent}>
              <div style={{marginBottom: '15px'}}>
                <label style={{display: 'block', marginBottom: '6px', fontWeight: '600', color: '#1a1a1a', fontSize: '13px'}}>📌 Student ID (e.g., MS001, GHSHST26) *</label>
                <input type="text" placeholder="Example: MS001 or GHSHST26" value={studentForm.student_id} onChange={(e) => setStudentForm({...studentForm, student_id: e.target.value})} style={{width: '100%', padding: '10px', border: '2px solid #00D9FF', borderRadius: '4px', boxSizing: 'border-box', fontSize: '14px'}} required/>
              </div>
              <div style={{marginBottom: '15px'}}>
                <label style={{display: 'block', marginBottom: '6px', fontWeight: '600', color: '#1a1a1a', fontSize: '13px'}}>First Name *</label>
                <input type="text" value={studentForm.first_name} onChange={(e) => setStudentForm({...studentForm, first_name: e.target.value})} style={{width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box'}} required/>
              </div>
              <div style={{marginBottom: '15px'}}>
                <label style={{display: 'block', marginBottom: '6px', fontWeight: '600', color: '#1a1a1a', fontSize: '13px'}}>Last Name *</label>
                <input type="text" value={studentForm.last_name} onChange={(e) => setStudentForm({...studentForm, last_name: e.target.value})} style={{width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box'}} required/>
              </div>
              <div style={{marginBottom: '15px'}}>
                <label style={{display: 'block', marginBottom: '6px', fontWeight: '600', color: '#1a1a1a', fontSize: '13px'}}>Email *</label>
                <input type="email" value={studentForm.email} onChange={(e) => setStudentForm({...studentForm, email: e.target.value})} style={{width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box'}} required/>
              </div>
              <div style={{marginBottom: '15px'}}>
                <label style={{display: 'block', marginBottom: '6px', fontWeight: '600', color: '#1a1a1a', fontSize: '13px'}}>Phone *</label>
                <input type="tel" value={studentForm.phone} onChange={(e) => setStudentForm({...studentForm, phone: e.target.value})} style={{width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box'}} required/>
              </div>
              <div style={{marginBottom: '20px'}}>
                <label style={{display: 'block', marginBottom: '6px', fontWeight: '600', color: '#1a1a1a', fontSize: '13px'}}>House *</label>
                <select value={studentForm.house_id} onChange={(e) => setStudentForm({...studentForm, house_id: e.target.value})} style={{width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box'}} onClick={() => fetchHouses(localStorage.getItem('token'))} required>
                  <option value="">Select a house...</option>
                  {houses.map(house => (
                    <option key={house.id} value={house.id}>{house.name}</option>
                  ))}
                </select>
              </div>
              <div style={{display: 'flex', gap: '12px'}}>
                <button type="submit" style={{flex: 1, padding: '12px', background: 'linear-gradient(135deg, #00D9FF 0%, #7B2CBF 100%)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600'}}>Add Student</button>
                <button type="button" onClick={() => setShowStudentForm(false)} style={{flex: 1, padding: '12px', backgroundColor: '#e5e7eb', color: '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600'}}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BULK UPLOAD MODAL */}
      {showBulkUpload && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000}}>
          <div style={{backgroundColor: 'white', padding: '30px', borderRadius: '12px', maxWidth: '500px', width: '90%', boxShadow: '0 20px 50px rgba(0,0,0,0.3)'}}>
            <h2 style={{marginTop: 0, color: '#1a1a1a'}}>Bulk Upload Students</h2>
            <p style={{color: '#666', fontSize: '13px', marginBottom: '20px'}}>Upload CSV file with columns: student_id, first_name, last_name, email, phone, house_id</p>
            <p style={{color: '#999', fontSize: '11px', marginBottom: '20px'}}>Example: MS001,John,Doe,john@ghanasco.edu.gh,0501234567,1</p>
            <form onSubmit={handleBulkUpload}>
              <input type="file" accept=".csv" onChange={(e) => setBulkFile(e.target.files[0])} style={{width: '100%', padding: '10px', border: '2px dashed #ddd', borderRadius: '4px', marginBottom: '20px', boxSizing: 'border-box'}} required/>
              <div style={{display: 'flex', gap: '12px'}}>
                <button type="submit" style={{flex: 1, padding: '12px', background: 'linear-gradient(135deg, #00D9FF 0%, #7B2CBF 100%)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600'}}>Upload</button>
                <button type="button" onClick={() => setShowBulkUpload(false)} style={{flex: 1, padding: '12px', backgroundColor: '#e5e7eb', color: '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600'}}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* USER PROFILE MODAL */}
      {showProfile && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000}}>
          <div style={{backgroundColor: 'white', padding: '30px', borderRadius: '12px', maxWidth: '400px', width: '90%', boxShadow: '0 20px 50px rgba(0,0,0,0.3)'}}>
            <h2 style={{marginTop: 0, color: '#1a1a1a', textAlign: 'center'}}>👤 User Profile</h2>
            <div style={{marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid #e5e7eb'}}>
              <p style={{margin: '0 0 5px 0', color: '#666', fontSize: '12px', fontWeight: '600'}}>Name</p>
              <p style={{margin: 0, fontWeight: '600', fontSize: '16px', color: '#1a1a1a'}}>{user.name}</p>
            </div>
            <div style={{marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid #e5e7eb'}}>
              <p style={{margin: '0 0 5px 0', color: '#666', fontSize: '12px', fontWeight: '600'}}>Email</p>
              <p style={{margin: 0, fontWeight: '600', color: '#1a1a1a'}}>{user.email}</p>
            </div>
            <div style={{marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid #e5e7eb'}}>
              <p style={{margin: '0 0 5px 0', color: '#666', fontSize: '12px', fontWeight: '600'}}>Role</p>
              <p style={{margin: 0, fontWeight: '600', color: '#1a1a1a', textTransform: 'capitalize'}}>{user.role.replace('_', ' ')}</p>
            </div>
            {user.house_id && (
              <div style={{marginBottom: '20px'}}>
                <p style={{margin: '0 0 5px 0', color: '#666', fontSize: '12px', fontWeight: '600'}}>House</p>
                <p style={{margin: 0, fontWeight: '600', color: '#1a1a1a'}}>House ID: {user.house_id}</p>
              </div>
            )}
            <button onClick={() => setShowProfile(false)} style={{width: '100%', padding: '12px', backgroundColor: '#e5e7eb', color: '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600'}}>Close</button>
          </div>
        </div>
      )}

      {/* AUDIT LOGS MODAL */}
      {showAuditLogs && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000}}>
          <div style={{backgroundColor: 'white', padding: '30px', borderRadius: '12px', maxWidth: '700px', width: '90%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.3)'}}>
            <h2 style={{marginTop: 0, color: '#1a1a1a'}}>📋 Audit Logs</h2>
            <div style={{backgroundColor: 'white', borderRadius: '8px', overflowX: 'auto'}}>
              <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '12px'}}>
                <thead>
                  <tr style={{backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb'}}>
                    <th style={{padding: '12px', textAlign: 'left', fontWeight: '600'}}>Action</th>
                    <th style={{padding: '12px', textAlign: 'left', fontWeight: '600'}}>Details</th>
                    <th style={{padding: '12px', textAlign: 'left', fontWeight: '600'}}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map(log => (
                    <tr key={log.id} style={{borderBottom: '1px solid #e5e7eb'}}>
                      <td style={{padding: '12px'}}><span style={{padding: '3px 8px', borderRadius: '3px', backgroundColor: '#F3E8FF', color: '#7B2CBF', fontWeight: '600', fontSize: '10px'}}>{log.action}</span></td>
                      <td style={{padding: '12px'}}>{log.details}</td>
                      <td style={{padding: '12px', color: '#999', fontSize: '11px'}}>{formatDateTime(log.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={() => setShowAuditLogs(false)} style={{width: '100%', padding: '12px', backgroundColor: '#e5e7eb', color: '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', marginTop: '15px'}}>Close</button>
          </div>
        </div>
      )}

      {/* REQUEST DETAILS MODAL */}
      {showRequestDetails && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000}}>
          <div style={{backgroundColor: 'white', padding: '30px', borderRadius: '12px', maxWidth: '500px', width: '90%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.3)'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
              <h2 style={{margin: 0, color: '#1a1a1a'}}>Request Details</h2>
              <button onClick={() => handlePrintRequest(showRequestDetails)} style={{backgroundColor: '#6366f1', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '12px'}}>🖨️ Print</button>
            </div>
            <div style={{marginBottom: '15px', paddingBottom: '12px', borderBottom: '1px solid #e5e7eb'}}>
              <p style={{margin: '0 0 5px 0', color: '#666', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase'}}>Destination</p>
              <p style={{margin: 0, fontWeight: '600', color: '#1a1a1a'}}>{showRequestDetails.destination}</p>
            </div>
            <div style={{marginBottom: '15px', paddingBottom: '12px', borderBottom: '1px solid #e5e7eb'}}>
              <p style={{margin: '0 0 5px 0', color: '#666', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase'}}>Dates</p>
              <p style={{margin: 0, fontWeight: '600', color: '#1a1a1a'}}>{formatDateTime(showRequestDetails.departure_date)} to {formatDateTime(showRequestDetails.return_date)}</p>
            </div>
            <div style={{marginBottom: '15px', paddingBottom: '12px', borderBottom: '1px solid #e5e7eb'}}>
              <p style={{margin: '0 0 5px 0', color: '#666', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase'}}>Guardian</p>
              <p style={{margin: 0, fontWeight: '600', color: '#1a1a1a'}}>{showRequestDetails.guardian_name} ({showRequestDetails.guardian_phone})</p>
            </div>
            <div style={{marginBottom: '20px'}}>
              <p style={{margin: '0 0 5px 0', color: '#666', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase'}}>Status</p>
              <span style={{display: 'inline-block', padding: '6px 14px', borderRadius: '4px', fontWeight: '700', backgroundColor: showRequestDetails.status === 'approved' ? '#D1FAE5' : showRequestDetails.status === 'rejected' ? '#FEE2E2' : '#F3E8FF', color: showRequestDetails.status === 'approved' ? '#065F46' : showRequestDetails.status === 'rejected' ? '#991B1B' : '#7B2CBF', textTransform: 'uppercase', fontSize: '10px'}}>{showRequestDetails.status}</span>
            </div>
            
            {(user.role === 'housemaster' || user.role === 'senior_housemaster') && showRequestDetails.status === 'pending' && (
              <div style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
                <button onClick={() => { handleApproveRequest(showRequestDetails.id); setShowRequestDetails(null); }} style={{flex: 1, padding: '12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '13px'}}>✅ Approve</button>
                <button onClick={() => { handleRejectRequest(showRequestDetails.id); setShowRequestDetails(null); }} style={{flex: 1, padding: '12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '13px'}}>❌ Reject</button>
              </div>
            )}

            {user.role === 'student' && showRequestDetails.status === 'pending' && (
              <button onClick={() => { handleCancelRequest(showRequestDetails.id); setShowRequestDetails(null); }} style={{width: '100%', padding: '12px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', marginBottom: '10px'}}>⛔ Cancel Request</button>
            )}

            {(user.role === 'housemaster' || user.role === 'senior_housemaster') && (
              <button onClick={() => setShowNoteForm(showRequestDetails.id)} style={{width: '100%', padding: '12px', backgroundColor: '#6366f1', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', marginBottom: '10px'}}>📝 Add Note</button>
            )}

            {showNoteForm === showRequestDetails.id && (
              <div style={{marginBottom: '15px', padding: '12px', backgroundColor: '#f3f4f6', borderRadius: '4px'}}>
                <textarea placeholder="Add a note..." value={noteText} onChange={(e) => setNoteText(e.target.value)} style={{width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', marginBottom: '8px', boxSizing: 'border-box', minHeight: '60px'}} />
                <div style={{display: 'flex', gap: '8px'}}>
                  <button onClick={() => handleAddNote(showRequestDetails.id)} style={{flex: 1, padding: '8px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '12px'}}>Save</button>
                  <button onClick={() => { setShowNoteForm(null); setNoteText(''); }} style={{flex: 1, padding: '8px', backgroundColor: '#e5e7eb', color: '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '12px'}}>Cancel</button>
                </div>
              </div>
            )}
            
            <button onClick={() => setShowRequestDetails(null)} style={{width: '100%', padding: '12px', backgroundColor: '#e5e7eb', color: '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600'}}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
