import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const App = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [activeView, setActiveView] = useState('dashboard');
  const [houses, setHouses] = useState([]);
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterHouse, setFilterHouse] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [formData, setFormData] = useState({
    departure_date: '',
    departure_time: '',
    duration: '',
    destination: '',
    reason: '',
    guardian_name: '',
    guardian_phone: '',
  });

  useEffect(() => {
    loadHouses();
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadRequests();
      loadStats();
    }
  }, [currentUser]);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadHouses = async () => {
    try {
      const response = await fetch(`${API_URL}/houses`);
      const data = await response.json();
      if (data.success) setHouses(data.data);
    } catch (err) {
      console.error('Failed to load houses:', err);
    }
  };

  const loadRequests = async () => {
    try {
      const response = await fetch(`${API_URL}/requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) setRequests(data.data);
    } catch (err) {
      console.error('Failed to load requests:', err);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch(`${API_URL}/requests/stats/overview`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) setStats(data.data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      const data = await response.json();

      if (data.success) {
        setCurrentUser(data.data.user);
        setToken(data.data.token);
        localStorage.setItem('token', data.data.token);
        showNotification('Login successful!');
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (err) {
      setError('Connection error. Make sure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setToken(null);
    localStorage.removeItem('token');
    setActiveView('dashboard');
  };

  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        showNotification('Exeat request submitted successfully!');
        setFormData({
          departure_date: '',
          departure_time: '',
          duration: '',
          destination: '',
          reason: '',
          guardian_name: '',
          guardian_phone: '',
        });
        setActiveView('dashboard');
        loadRequests();
        loadStats();
      } else {
        showNotification(data.message || 'Failed to submit request', 'error');
      }
    } catch (err) {
      showNotification('Failed to submit request', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId) => {
    try {
      const response = await fetch(`${API_URL}/requests/${requestId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (data.success) {
        showNotification('Request approved successfully!');
        loadRequests();
        loadStats();
        setSelectedRequest(null);
      }
    } catch (err) {
      showNotification('Failed to approve request', 'error');
    }
  };

  const handleReject = async (requestId) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;

    try {
      const response = await fetch(`${API_URL}/requests/${requestId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rejection_reason: reason }),
      });

      const data = await response.json();

      if (data.success) {
        showNotification('Request rejected');
        loadRequests();
        loadStats();
        setSelectedRequest(null);
      }
    } catch (err) {
      showNotification('Failed to reject request', 'error');
    }
  };

  // Filter requests
  const getFilteredRequests = () => {
    return requests.filter(req => {
      const matchSearch = req.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         req.house_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchHouse = filterHouse === 'all' || req.house_id === parseInt(filterHouse);
      const matchStatus = filterStatus === 'all' || req.status === filterStatus;
      const matchDate = !filterDate || req.departure_date === filterDate;
      return matchSearch && matchHouse && matchStatus && matchDate;
    });
  };

  // Export to Excel (CSV format)
  const exportToExcel = () => {
    const filtered = getFilteredRequests();
    const csv = [
      ['Student Name', 'House', 'Class', 'Date', 'Time', 'Duration', 'Destination', 'Reason', 'Status', 'Submitted'].join(','),
      ...filtered.map(r => [
        r.student_name,
        r.house_name,
        r.class,
        r.departure_date,
        r.departure_time,
        r.duration,
        r.destination,
        `"${r.reason.replace(/"/g, '""')}"`,
        r.status,
        r.created_at
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ghanasco-exeat-requests-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    showNotification('Report exported successfully!');
  };

  // Print Exeat Pass
  const printExeatPass = (req) => {
    const printWindow = window.open('', '', 'height=600,width=800');
    printWindow.document.write(`
      <html>
        <head>
          <title>Exeat Pass - ${req.student_name}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; }
            .header { text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
            .header h1 { color: #2563eb; margin: 0; }
            .header p { margin: 5px 0; color: #666; }
            .pass-number { background: #2563eb; color: white; padding: 10px; text-align: center; font-size: 20px; font-weight: bold; margin: 20px 0; }
            .details { margin: 20px 0; }
            .detail-row { display: flex; padding: 10px; border-bottom: 1px solid #eee; }
            .detail-label { font-weight: bold; width: 200px; }
            .detail-value { flex: 1; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #eee; }
            .signature-line { width: 200px; border-top: 2px solid #000; margin-top: 60px; text-align: center; padding-top: 5px; }
            .approved-stamp { position: absolute; top: 100px; right: 50px; border: 5px solid #10b981; color: #10b981; padding: 20px; transform: rotate(-15deg); font-size: 30px; font-weight: bold; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="approved-stamp">APPROVED</div>
          <div class="header">
            <h1>GHANA NATIONAL SECONDARY SCHOOL</h1>
            <p>Ghanasco, Tamale</p>
            <p style="font-size: 18px; font-weight: bold; margin-top: 10px;">EXEAT PASS</p>
          </div>
          
          <div class="pass-number">PASS #${String(req.id).padStart(5, '0')}</div>
          
          <div class="details">
            <div class="detail-row">
              <div class="detail-label">Student Name:</div>
              <div class="detail-value">${req.student_name}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Student ID:</div>
              <div class="detail-value">${req.student_id}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">House:</div>
              <div class="detail-value">${req.house_name}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Class:</div>
              <div class="detail-value">${req.class}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Departure Date:</div>
              <div class="detail-value">${new Date(req.departure_date).toLocaleDateString()}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Departure Time:</div>
              <div class="detail-value">${req.departure_time}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Duration:</div>
              <div class="detail-value">${req.duration}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Destination:</div>
              <div class="detail-value">${req.destination}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Reason:</div>
              <div class="detail-value">${req.reason}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Guardian:</div>
              <div class="detail-value">${req.guardian_name} (${req.guardian_phone})</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Approved By:</div>
              <div class="detail-value">${req.approved_by_name || 'Pending'}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Approved Date:</div>
              <div class="detail-value">${req.approved_at ? new Date(req.approved_at).toLocaleString() : 'Pending'}</div>
            </div>
          </div>
          
          <div class="footer">
            <p><strong>Instructions:</strong></p>
            <ul>
              <li>This pass must be presented to security upon departure and return</li>
              <li>Student must return by the specified time</li>
              <li>Any extension must be approved by the Housemaster</li>
              <li>This pass is non-transferable</li>
            </ul>
            
            <div style="display: flex; justify-content: space-between; margin-top: 60px;">
              <div>
                <div class="signature-line">Housemaster</div>
              </div>
              <div>
                <div class="signature-line">Security</div>
              </div>
            </div>
          </div>
          
          <button class="no-print" onclick="window.print()" style="position: fixed; bottom: 20px; right: 20px; padding: 15px 30px; background: #2563eb; color: white; border: none; border-radius: 10px; font-size: 16px; cursor: pointer;">
            Print Pass
          </button>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const demoAccounts = [
    { email: 'abena.mensah@ghanasco.edu.gh', password: 'house123', role: 'Student' },
    { email: 'matilda.adombiri@ghanasco.edu.gh', password: 'house123', role: 'Housemaster' },
    { email: 'headmaster@ghanasco.edu.gh', password: 'house123', role: 'Headmaster' },
  ];

  const filteredRequests = getFilteredRequests();

  if (!currentUser) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(to bottom right, #dbeafe, #e0f2fe, #cffafe)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ maxWidth: '600px', width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <img src="/logo.png" alt="Ghanasco Logo" style={{ width: '100px', height: '100px', objectFit: 'contain', margin: '0 auto 20px', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))' }} />
            <h1 style={{ fontSize: '36px', fontWeight: 'bold', color: '#1f2937', marginBottom: '10px' }}>Ghanasco</h1>
            <p style={{ color: '#4b5563', fontSize: '18px' }}>Ghana National Secondary School</p>
            <p style={{ color: '#2563eb', fontWeight: '600', marginTop: '10px' }}>Exeat Management System</p>
          </div>

          <div style={{ background: 'white', borderRadius: '20px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', padding: '40px', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937', marginBottom: '10px' }}>Login</h2>
            <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '20px' }}>
              🔗 Connected • {houses.length} Houses
            </p>

            {error && (
              <div style={{ background: '#fee2e2', border: '2px solid #ef4444', color: '#991b1b', padding: '12px', borderRadius: '10px', marginBottom: '20px', fontSize: '14px' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} style={{ marginBottom: '30px' }}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Email</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  placeholder="your.email@ghanasco.edu.gh"
                  style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: '10px', fontSize: '14px' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Password</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: '10px', fontSize: '14px' }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{ width: '100%', padding: '15px', background: loading ? '#9ca3af' : 'linear-gradient(to right, #2563eb, #0ea5e9)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer' }}
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </form>

            <div style={{ borderTop: '2px solid #e5e7eb', paddingTop: '20px' }}>
              <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px', fontWeight: '600' }}>Quick Login:</p>
              {demoAccounts.map((acc, idx) => (
                <button
                  key={idx}
                  onClick={() => { setLoginEmail(acc.email); setLoginPassword(acc.password); }}
                  style={{ width: '100%', textAlign: 'left', padding: '10px 15px', background: '#f3f4f6', border: '2px solid #e5e7eb', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', marginBottom: '8px' }}
                >
                  <div style={{ fontWeight: '600' }}>{acc.role}</div>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>{acc.email}</div>
                </button>
              ))}
              <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '10px', textAlign: 'center' }}>
                Password: <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: '4px' }}>house123</code>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(to bottom right, #dbeafe, #e0f2fe, #cffafe)' }}>
      {notification && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 50, padding: '15px 25px', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', background: notification.type === 'success' ? '#10b981' : '#ef4444', color: 'white', fontWeight: '600' }}>
          {notification.message}
        </div>
      )}

      {/* Request Details Modal */}
      {selectedRequest && (
        <div onClick={() => setSelectedRequest(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '20px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: '20px', maxWidth: '600px', width: '100%', maxHeight: '90vh', overflow: 'auto', padding: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold' }}>Exeat Request Details</h2>
              <button onClick={() => setSelectedRequest(null)} style={{ fontSize: '24px', color: '#9ca3af', border: 'none', background: 'none', cursor: 'pointer' }}>×</button>
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'inline-block', padding: '8px 16px', borderRadius: '20px', fontSize: '14px', fontWeight: 'bold', background: selectedRequest.status === 'pending' ? '#fef3c7' : selectedRequest.status === 'approved' ? '#d1fae5' : '#fee2e2', color: selectedRequest.status === 'pending' ? '#92400e' : selectedRequest.status === 'approved' ? '#065f46' : '#991b1b' }}>
                {selectedRequest.status.toUpperCase()}
              </div>
            </div>

            <div style={{ background: '#f9fafb', padding: '20px', borderRadius: '12px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '10px' }}>{selectedRequest.student_name}</h3>
              <p style={{ color: '#6b7280' }}>{selectedRequest.house_name} • {selectedRequest.class} • {selectedRequest.student_id}</p>
            </div>

            <div style={{ display: 'grid', gap: '15px', marginBottom: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '10px', padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                <strong>Date:</strong>
                <span>{new Date(selectedRequest.departure_date).toLocaleDateString()}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '10px', padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                <strong>Time:</strong>
                <span>{selectedRequest.departure_time}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '10px', padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                <strong>Duration:</strong>
                <span>{selectedRequest.duration}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '10px', padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                <strong>Destination:</strong>
                <span>{selectedRequest.destination}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '10px', padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                <strong>Reason:</strong>
                <span>{selectedRequest.reason}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '10px', padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                <strong>Guardian:</strong>
                <span>{selectedRequest.guardian_name} ({selectedRequest.guardian_phone})</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              {selectedRequest.status === 'approved' && (
                <button onClick={() => printExeatPass(selectedRequest)} style={{ flex: 1, padding: '12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '600', cursor: 'pointer' }}>
                  🖨️ Print Pass
                </button>
              )}
              {(currentUser.role === 'housemaster' || currentUser.role === 'headmaster') && selectedRequest.status === 'pending' && (
                <>
                  <button onClick={() => handleApprove(selectedRequest.id)} style={{ flex: 1, padding: '12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '600', cursor: 'pointer' }}>
                    ✓ Approve
                  </button>
                  <button onClick={() => handleReject(selectedRequest.id)} style={{ flex: 1, padding: '12px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '600', cursor: 'pointer' }}>
                    ✗ Reject
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{ background: 'linear-gradient(to right, #1e40af, #0369a1, #1e3a8a)', color: 'white', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '15px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <img src="/logo.png" alt="Ghanasco" style={{ width: '48px', height: '48px', objectFit: 'contain', background: 'rgba(255,255,255,0.9)', borderRadius: '12px', padding: '8px' }} />
              <div>
                <h1 style={{ fontSize: '20px', fontWeight: 'bold' }}>Ghanasco</h1>
                <p style={{ fontSize: '11px', opacity: 0.9 }}>Exeat Management System</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '14px', fontWeight: '600' }}>{currentUser.first_name} {currentUser.last_name}</p>
                <p style={{ fontSize: '11px', opacity: 0.9 }}>
                  {currentUser.role.toUpperCase()} • {currentUser.house_name || 'All Houses'}
                </p>
              </div>
              <button onClick={handleLogout} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '10px', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '30px 20px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '30px' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', borderLeft: '4px solid #2563eb' }}>
            <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '5px' }}>Total</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1f2937' }}>{stats.total || 0}</div>
          </div>
          <div style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', borderLeft: '4px solid #f59e0b' }}>
            <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '5px' }}>Pending</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1f2937' }}>{stats.pending || 0}</div>
          </div>
          <div style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', borderLeft: '4px solid #10b981' }}>
            <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '5px' }}>Approved</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1f2937' }}>{stats.approved || 0}</div>
          </div>
          <div style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', borderLeft: '4px solid #ef4444' }}>
            <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '5px' }}>Rejected</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1f2937' }}>{stats.rejected || 0}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button onClick={() => setActiveView('dashboard')} style={{ padding: '12px 24px', borderRadius: '12px', border: 'none', fontWeight: '600', cursor: 'pointer', background: activeView === 'dashboard' ? 'white' : 'transparent', color: activeView === 'dashboard' ? '#2563eb' : '#6b7280', boxShadow: activeView === 'dashboard' ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none' }}>
            Dashboard
          </button>
          {currentUser.role === 'student' && (
            <button onClick={() => setActiveView('newRequest')} style={{ padding: '12px 24px', borderRadius: '12px', border: 'none', fontWeight: '600', cursor: 'pointer', background: activeView === 'newRequest' ? 'white' : 'transparent', color: activeView === 'newRequest' ? '#2563eb' : '#6b7280', boxShadow: activeView === 'newRequest' ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none' }}>
              New Request
            </button>
          )}
        </div>

        {activeView === 'dashboard' && (
          <div>
            {/* Filters */}
            <div style={{ background: 'white', borderRadius: '16px', padding: '20px', marginBottom: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '8px', color: '#6b7280' }}>Search</label>
                  <input
                    type="text"
                    placeholder="Search by name or house..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ width: '100%', padding: '10px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }}
                  />
                </div>
                {(currentUser.role === 'headmaster') && (
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '8px', color: '#6b7280' }}>House</label>
                    <select value={filterHouse} onChange={(e) => setFilterHouse(e.target.value)} style={{ width: '100%', padding: '10px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }}>
                      <option value="all">All Houses</option>
                      {houses.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '8px', color: '#6b7280' }}>Status</label>
                  <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ width: '100%', padding: '10px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }}>
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '8px', color: '#6b7280' }}>Date</label>
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    style={{ width: '100%', padding: '10px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                <button onClick={() => { setSearchTerm(''); setFilterHouse('all'); setFilterStatus('all'); setFilterDate(''); }} style={{ padding: '10px 20px', background: '#f3f4f6', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                  Clear Filters
                </button>
                <button onClick={exportToExcel} style={{ padding: '10px 20px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                  📊 Export to Excel
                </button>
              </div>
            </div>

            {/* Requests */}
            <div style={{ background: 'white', borderRadius: '20px', padding: '30px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }}>
                Exeat Requests ({filteredRequests.length})
              </h2>
              {filteredRequests.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
                  <div style={{ fontSize: '48px', marginBottom: '15px' }}>📋</div>
                  <p>No requests found</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '15px' }}>
                  {filteredRequests.map((req) => (
                    <div key={req.id} onClick={() => setSelectedRequest(req)} style={{ border: '2px solid #e5e7eb', borderRadius: '12px', padding: '20px', position: 'relative', cursor: 'pointer', transition: 'all 0.2s' }} onMouseOver={(e) => e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.1)'} onMouseOut={(e) => e.currentTarget.style.boxShadow = 'none'}>
                      <div style={{ position: 'absolute', top: '15px', right: '15px', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', background: req.status === 'pending' ? '#fef3c7' : req.status === 'approved' ? '#d1fae5' : '#fee2e2', color: req.status === 'pending' ? '#92400e' : req.status === 'approved' ? '#065f46' : '#991b1b' }}>
                        {req.status.toUpperCase()}
                      </div>
                      <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '5px' }}>{req.student_name}</h3>
                      <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '10px' }}>{req.house_name} • {req.class}</p>
                      <div style={{ fontSize: '14px', color: '#374151' }}>
                        <strong>Date:</strong> {new Date(req.departure_date).toLocaleDateString()} at {req.departure_time}
                      </div>
                      <div style={{ fontSize: '14px', color: '#374151' }}>
                        <strong>Destination:</strong> {req.destination}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeView === 'newRequest' && (
          <div style={{ background: 'white', borderRadius: '20px', padding: '30px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }}>Submit New Request</h2>
            <form onSubmit={handleSubmitRequest}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Date *</label>
                  <input type="date" value={formData.departure_date} onChange={(e) => setFormData({ ...formData, departure_date: e.target.value })} required min={new Date().toISOString().split('T')[0]} style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: '10px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Time *</label>
                  <input type="time" value={formData.departure_time} onChange={(e) => setFormData({ ...formData, departure_time: e.target.value })} required style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: '10px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Duration *</label>
                  <select value={formData.duration} onChange={(e) => setFormData({ ...formData, duration: e.target.value })} required style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: '10px' }}>
                    <option value="">Select</option>
                    <option value="3 hours">3 hours</option>
                    <option value="1 day">1 day</option>
                    <option value="2 days">2 days</option>
                    <option value="3 days">3 days</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Destination *</label>
                  <input type="text" value={formData.destination} onChange={(e) => setFormData({ ...formData, destination: e.target.value })} required placeholder="e.g., Home" style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: '10px' }} />
                </div>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Reason *</label>
                <textarea value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} required rows="4" placeholder="Reason for exeat..." style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: '10px', resize: 'vertical' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Guardian Name *</label>
                  <input type="text" value={formData.guardian_name} onChange={(e) => setFormData({ ...formData, guardian_name: e.target.value })} required style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: '10px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Guardian Phone *</label>
                  <input type="tel" value={formData.guardian_phone} onChange={(e) => setFormData({ ...formData, guardian_phone: e.target.value })} required placeholder="0XX XXX XXXX" style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: '10px' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '15px' }}>
                <button type="submit" disabled={loading} style={{ flex: 1, padding: '15px', background: loading ? '#9ca3af' : '#2563eb', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer' }}>
                  {loading ? 'Submitting...' : 'Submit'}
                </button>
                <button type="button" onClick={() => setActiveView('dashboard')} style={{ padding: '15px 30px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;