import React, { useState, useEffect } from 'react';
import './App.css';

const API_URL = 'http://localhost:5000/api';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [stats, setStats] = useState(null);
  const [requests, setRequests] = useState([]);
  const [houses, setHouses] = useState([]);
  const [filters, setFilters] = useState({ status: '', house_id: '', search: '' });
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [editingRequest, setEditingRequest] = useState(null);
  const [requestForm, setRequestForm] = useState({
    departure_date: '', departure_time: '', duration: '1 day',
    destination: '', reason: '', guardian_name: '', guardian_phone: ''
  });
  const [selectedRequests, setSelectedRequests] = useState([]);
  const [students, setStudents] = useState([]);
  const [showStudentForm, setShowStudentForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [studentForm, setStudentForm] = useState({
    student_id: '', first_name: '', last_name: '', email: '',
    password: '', phone: '', class: '', house_id: '',
    guardian_name: '', guardian_phone: ''
  });
  const [showRequestDetails, setShowRequestDetails] = useState(null);
  const [showNoteModal, setShowNoteModal] = useState(null);
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetchUserProfile(token);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUserProfile = async (token) => {
    try {
      const response = await fetch(`${API_URL}/auth/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setUser(data.data);
        fetchDashboardData(token, data.data);
      } else {
        localStorage.removeItem('token');
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      localStorage.removeItem('token');
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardData = async (token, currentUser) => {
    const userRole = currentUser || user;
    try {
      const statsRes = await fetch(`${API_URL}/requests/stats/overview`, {
        headers: { 'Authorization': `Bearer ${token || localStorage.getItem('token')}` }
      });
      const statsData = await statsRes.json();
      if (statsData.success) setStats(statsData.data);

      const requestsRes = await fetch(`${API_URL}/requests`, {
        headers: { 'Authorization': `Bearer ${token || localStorage.getItem('token')}` }
      });
      const requestsData = await requestsRes.json();
      if (requestsData.success) setRequests(requestsData.data);

      const housesRes = await fetch(`${API_URL}/houses`, {
        headers: { 'Authorization': `Bearer ${token || localStorage.getItem('token')}` }
      });
      const housesData = await housesRes.json();
      if (housesData.success) setHouses(housesData.data);
      
      if (userRole?.role === 'housemaster' || userRole?.role === 'headmaster') {
        fetchStudents(token);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    }
  };

  const fetchStudents = async (token) => {
    try {
      const response = await fetch(`${API_URL}/users/students`, {
        headers: { 'Authorization': `Bearer ${token || localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (data.success) setStudents(data.data);
    } catch (error) {
      console.error('Failed to fetch students:', error);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      const data = await response.json();
      if (data.success) {
        localStorage.setItem('token', data.data.token);
        setUser(data.data.user);
        fetchDashboardData(data.data.token, data.data.user);
      } else {
        setLoginError(data.message);
      }
    } catch (error) {
      setLoginError('Login failed. Please try again.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setStats(null);
    setRequests([]);
    setStudents([]);
  };

  const quickLogin = async (email, password) => {
    setLoginEmail(email);
    setLoginPassword(password);
    setTimeout(() => {
      document.getElementById('loginForm')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }, 100);
  };

  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    try {
      const url = editingRequest ? `${API_URL}/requests/${editingRequest.id}` : `${API_URL}/requests`;
      const method = editingRequest ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(requestForm)
      });
      const data = await response.json();
      if (data.success) {
        setShowRequestForm(false);
        setEditingRequest(null);
        setRequestForm({ departure_date: '', departure_time: '', duration: '1 day', destination: '', reason: '', guardian_name: '', guardian_phone: '' });
        fetchDashboardData();
        alert(data.message);
      } else {
        alert(data.message);
      }
    } catch (error) {
      alert('Failed to submit request');
    }
  };

  const handleCancelRequest = async (id) => {
    const reason = prompt('Please provide a reason for cancellation:');
    if (!reason) return;
    try {
      const response = await fetch(`${API_URL}/requests/${id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ reason })
      });
      const data = await response.json();
      if (data.success) {
        fetchDashboardData();
        alert('Request cancelled successfully');
      } else {
        alert(data.message);
      }
    } catch (error) {
      alert('Failed to cancel request');
    }
  };

  const handleApproveRequest = async (id) => {
    try {
      const response = await fetch(`${API_URL}/requests/${id}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (data.success) {
        fetchDashboardData();
        alert('Request approved successfully');
      } else {
        alert(data.message);
      }
    } catch (error) {
      alert('Failed to approve request');
    }
  };

  const handleBatchApprove = async () => {
    if (selectedRequests.length === 0) {
      alert('Please select requests to approve');
      return;
    }
    try {
      const response = await fetch(`${API_URL}/requests/batch/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ request_ids: selectedRequests })
      });
      const data = await response.json();
      if (data.success) {
        setSelectedRequests([]);
        fetchDashboardData();
        alert(data.message);
      } else {
        alert(data.message);
      }
    } catch (error) {
      alert('Failed to batch approve');
    }
  };

  const handleRejectRequest = async (id) => {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) return;
    try {
      const response = await fetch(`${API_URL}/requests/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ rejection_reason: reason })
      });
      const data = await response.json();
      if (data.success) {
        fetchDashboardData();
        alert('Request rejected successfully');
      } else {
        alert(data.message);
      }
    } catch (error) {
      alert('Failed to reject request');
    }
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    try {
      const response = await fetch(`${API_URL}/requests/${showNoteModal}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ note: noteText })
      });
      const data = await response.json();
      if (data.success) {
        setShowNoteModal(null);
        setNoteText('');
        alert('Note added successfully');
      }
    } catch (error) {
      alert('Failed to add note');
    }
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.body.classList.toggle('dark-mode');
  };

  const handlePrintPass = (request) => {
    const printWindow = window.open('', '_blank');
    const passNumber = `EX${String(request.id).padStart(4, '0')}`;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Exeat Pass</title><style>@page{margin:20mm}body{font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:40px}.header{text-align:center;border-bottom:3px solid #667eea;padding-bottom:20px;margin-bottom:30px}h1{color:#667eea;font-size:28px}h2{color:#333;font-size:20px}.pass-number{background:#667eea;color:white;padding:8px 20px;border-radius:20px;display:inline-block;font-weight:bold;margin:15px 0}.section{margin:20px 0;padding:15px;background:#f8f9fa;border-radius:8px}.field{margin:12px 0;display:flex}.label{font-weight:bold;color:#555;width:180px}.value{flex:1}.approval-stamp{text-align:center;margin:30px 0;padding:20px;background:#d1fae5;border:2px dashed #059669;border-radius:10px}@media print{.no-print{display:none}}</style></head><body><div class="header"><h1>GHANA SENIOR HIGH SCHOOL</h1><h2>OFFICIAL EXEAT PASS</h2><div class="pass-number">${passNumber}</div></div><div class="section"><h3>Student Information</h3><div class="field"><span class="label">Name:</span><span class="value">${request.student_name}</span></div><div class="field"><span class="label">House:</span><span class="value">${request.house_name}</span></div></div><div class="section"><h3>Exeat Details</h3><div class="field"><span class="label">Destination:</span><span class="value">${request.destination}</span></div><div class="field"><span class="label">Date:</span><span class="value">${request.departure_date} ${request.departure_time}</span></div><div class="field"><span class="label">Duration:</span><span class="value">${request.duration}</span></div></div><div class="section"><h3>Guardian</h3><div class="field"><span class="label">Name:</span><span class="value">${request.guardian_name}</span></div><div class="field"><span class="label">Phone:</span><span class="value">${request.guardian_phone}</span></div></div><div class="approval-stamp"><h3 style="color:#059669">✓ APPROVED</h3><p>By: ${request.approved_by_name||'Administration'}</p></div><div class="no-print" style="text-align:center;margin-top:30px"><button onclick="window.print()" style="padding:12px 30px;background:#667eea;color:white;border:none;border-radius:8px;cursor:pointer">Print</button></div></body></html>`);
    printWindow.document.close();
  };

  const handleSubmitStudent = async (e) => {
    e.preventDefault();
    try {
      const url = editingStudent ? `${API_URL}/users/students/${editingStudent.id}` : `${API_URL}/users/students`;
      const method = editingStudent ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(studentForm)
      });
      const data = await response.json();
      if (data.success) {
        setShowStudentForm(false);
        setEditingStudent(null);
        setStudentForm({ student_id: '', first_name: '', last_name: '', email: '', password: '', phone: '', class: '', house_id: '', guardian_name: '', guardian_phone: '' });
        fetchStudents();
        alert(data.message);
      } else {
        alert(data.message);
      }
    } catch (error) {
      alert('Failed to save student');
    }
  };

  const handleRemoveStudent = async (id, name) => {
    if (!window.confirm(`Remove ${name}?`)) return;
    try {
      const response = await fetch(`${API_URL}/users/students/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (data.success) {
        fetchStudents();
        alert('Student removed');
      }
    } catch (error) {
      alert('Failed to remove student');
    }
  };

  const handleResetPassword = async (id, name) => {
    const newPassword = window.prompt(`New password for ${name}:`);
    if (!newPassword) return;
    try {
      const response = await fetch(`${API_URL}/users/students/${id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ new_password: newPassword })
      });
      const data = await response.json();
      if (data.success) alert('Password reset');
    } catch (error) {
      alert('Failed');
    }
  };

  const filteredRequests = requests.filter(req => {
    if (filters.status && req.status !== filters.status) return false;
    if (filters.house_id && req.house_id !== parseInt(filters.house_id)) return false;
    if (filters.search && !req.student_name.toLowerCase().includes(filters.search.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return (<div style={{display:'flex',justifyContent:'center',alignItems:'center',height:'100vh'}}><div style={{fontSize:'24px',fontWeight:'600'}}>Loading...</div></div>);
  }

  if (!user) {
    return (
      <div className={`login-container ${darkMode?'dark':''}`}>
        <div className="login-box">
          <h1 style={{fontSize:'32px',fontWeight:'700',marginBottom:'10px'}}>GHANASCO</h1>
          <h2 style={{fontSize:'20px',fontWeight:'500',marginBottom:'30px',color:'#666'}}>Exeat Management System</h2>
          {loginError && (<div style={{background:'#fee',border:'1px solid #fcc',padding:'12px',borderRadius:'8px',marginBottom:'20px',color:'#c33'}}>{loginError}</div>)}
          <form id="loginForm" onSubmit={handleLogin}>
            <input type="email" placeholder="Email" value={loginEmail} onChange={(e)=>setLoginEmail(e.target.value)} style={{width:'100%',padding:'12px',marginBottom:'15px',border:'1px solid #ddd',borderRadius:'8px'}} required />
            <input type="password" placeholder="Password" value={loginPassword} onChange={(e)=>setLoginPassword(e.target.value)} style={{width:'100%',padding:'12px',marginBottom:'20px',border:'1px solid #ddd',borderRadius:'8px'}} required />
            <button type="submit" className="btn-primary" style={{width:'100%'}}>Login</button>
          </form>
          <div style={{marginTop:'30px'}}>
            <p style={{marginBottom:'10px',color:'#666'}}>Quick Login:</p>
            <button onClick={()=>quickLogin('abena.mensah@ghanasco.edu.gh','house123')} className="btn-secondary" style={{width:'100%',marginBottom:'8px'}}>Student</button>
            <button onClick={()=>quickLogin('matilda.adombiri@ghanasco.edu.gh','house123')} className="btn-secondary" style={{width:'100%',marginBottom:'8px'}}>Housemaster</button>
            <button onClick={()=>quickLogin('headmaster@ghanasco.edu.gh','house123')} className="btn-secondary" style={{width:'100%'}}>Headmaster</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-container ${darkMode?'dark':''}`}>
      <header className="app-header">
        <div className="header-left"><div><h1 style={{fontSize:'20px',fontWeight:'700'}}>GHANASCO</h1><p style={{fontSize:'12px',color:'#666'}}>Exeat Management</p></div></div>
        <div className="header-right">
          <button onClick={toggleDarkMode} className="icon-btn">{darkMode?'☀️':'🌙'}</button>
          <div style={{marginLeft:'20px'}}><strong>{user.first_name} {user.last_name}</strong><p style={{fontSize:'12px',color:'#666',textTransform:'capitalize'}}>{user.role}</p></div>
          <button onClick={handleLogout} className="btn-secondary" style={{marginLeft:'15px'}}>Logout</button>
        </div>
      </header>
      <nav className="app-nav">
        <button className={activeTab==='dashboard'?'active':''} onClick={()=>setActiveTab('dashboard')}>📊 Dashboard</button>
        <button className={activeTab==='requests'?'active':''} onClick={()=>setActiveTab('requests')}>📝 Requests</button>
        {(user.role==='housemaster'||user.role==='headmaster')&&(<button className={activeTab==='students'?'active':''} onClick={()=>setActiveTab('students')}>👥 Students</button>)}
        {user.role==='headmaster'&&(<><button className={activeTab==='analytics'?'active':''} onClick={()=>setActiveTab('analytics')}>📈 Analytics</button><button className={activeTab==='audit'?'active':''} onClick={()=>setActiveTab('audit')}>🔍 Audit</button></>)}
      </nav>
      <main className="app-main">
        {activeTab==='dashboard'&&stats&&(<div className="dashboard"><h2 style={{fontSize:'28px',fontWeight:'700',marginBottom:'30px'}}>Welcome, {user.first_name}!</h2><div className="stats-grid"><div className="stat-card" style={{background:'linear-gradient(135deg,#667eea 0%,#764ba2 100%)'}}><h3>Total</h3><p className="stat-number">{stats.total}</p></div><div className="stat-card" style={{background:'linear-gradient(135deg,#f093fb 0%,#f5576c 100%)'}}><h3>Pending</h3><p className="stat-number">{stats.pending}</p></div><div className="stat-card" style={{background:'linear-gradient(135deg,#4facfe 0%,#00f2fe 100%)'}}><h3>Approved</h3><p className="stat-number">{stats.approved}</p></div><div className="stat-card" style={{background:'linear-gradient(135deg,#fa709a 0%,#fee140 100%)'}}><h3>Rejected</h3><p className="stat-number">{stats.rejected}</p></div></div>{user.role==='student'&&(<div style={{marginTop:'30px'}}><button onClick={()=>setShowRequestForm(true)} className="btn-primary btn-large">➕ Submit New Request</button></div>)}<div style={{marginTop:'40px'}}><h3 style={{fontSize:'20px',fontWeight:'600',marginBottom:'20px'}}>Recent Requests</h3><div className="requests-list">{requests.slice(0,5).map(req=>(<div key={req.id} className="request-card"><div><strong>{req.student_name}</strong><p style={{fontSize:'14px',color:'#666'}}>{req.destination} • {req.departure_date}</p></div><span className={`status-badge status-${req.status}`}>{req.status}</span></div>))}</div></div></div>)}
        {activeTab==='requests'&&(<div className="requests-tab"><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'30px'}}><h2 style={{fontSize:'28px',fontWeight:'700'}}>All Requests</h2>{user.role!=='student'&&selectedRequests.length>0&&(<button onClick={handleBatchApprove} className="btn-success">✓ Approve Selected ({selectedRequests.length})</button>)}{user.role==='student'&&(<button onClick={()=>setShowRequestForm(true)} className="btn-primary">➕ New Request</button>)}</div><div className="filters-bar"><select value={filters.status} onChange={(e)=>setFilters({...filters,status:e.target.value})} style={{padding:'10px',borderRadius:'8px',border:'1px solid #ddd'}}><option value="">All Status</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select>{user.role==='headmaster'&&(<select value={filters.house_id} onChange={(e)=>setFilters({...filters,house_id:e.target.value})} style={{padding:'10px',borderRadius:'8px',border:'1px solid #ddd'}}><option value="">All Houses</option>{houses.map(h=>(<option key={h.id} value={h.id}>{h.name}</option>))}</select>)}<input type="text" placeholder="Search..." value={filters.search} onChange={(e)=>setFilters({...filters,search:e.target.value})} style={{padding:'10px',borderRadius:'8px',border:'1px solid #ddd',flex:1}}/></div><div className="requests-table">{filteredRequests.length===0?(<p style={{textAlign:'center',padding:'40px',color:'#666'}}>No requests</p>):(filteredRequests.map(req=>(<div key={req.id} className="request-row">{user.role!=='student'&&req.status==='pending'&&(<input type="checkbox" checked={selectedRequests.includes(req.id)} onChange={(e)=>{if(e.target.checked){setSelectedRequests([...selectedRequests,req.id])}else{setSelectedRequests(selectedRequests.filter(id=>id!==req.id))}}} style={{marginRight:'15px'}}/>)}<div style={{flex:1}}><strong>{req.student_name}</strong><p style={{fontSize:'14px',color:'#666'}}>{req.house_name} • {req.destination} • {req.departure_date}</p></div><span className={`status-badge status-${req.status}`}>{req.status}</span><div className="action-buttons">{user.role==='student'&&req.status==='pending'&&(<><button onClick={()=>{setEditingRequest(req);setRequestForm(req);setShowRequestForm(true);}} className="btn-sm">✏️ Edit</button><button onClick={()=>handleCancelRequest(req.id)} className="btn-sm btn-danger">❌ Cancel</button></>)}{user.role!=='student'&&req.status==='pending'&&(<><button onClick={()=>handleApproveRequest(req.id)} className="btn-sm btn-success">✓</button><button onClick={()=>handleRejectRequest(req.id)} className="btn-sm btn-danger">✗</button><button onClick={()=>setShowNoteModal(req.id)} className="btn-sm">📝</button></>)}{req.status==='approved'&&(<button onClick={()=>handlePrintPass(req)} className="btn-sm btn-success">🖨️</button>)}<button onClick={()=>setShowRequestDetails(req)} className="btn-sm">👁️</button></div></div>)))}</div></div>)}
        {activeTab==='students'&&(user.role==='housemaster'||user.role==='headmaster')&&(<div className="students-tab"><div style={{display:'flex',justifyContent:'space-between',marginBottom:'30px'}}><h2 style={{fontSize:'28px',fontWeight:'700'}}>Manage Students</h2><button onClick={()=>{setEditingStudent(null);setStudentForm({student_id:'',first_name:'',last_name:'',email:'',password:'',phone:'',class:'',house_id:user.role==='housemaster'?user.house_id:'',guardian_name:'',guardian_phone:''});setShowStudentForm(true);}} className="btn-primary">➕ Add Student</button></div><div className="requests-table">{students.length===0?(<p style={{textAlign:'center',padding:'40px',color:'#666'}}>No students</p>):(students.map(s=>(<div key={s.id} className="request-row" style={{opacity:s.is_active?1:0.5}}><div style={{flex:1}}><strong>{s.first_name} {s.last_name}</strong>{!s.is_active&&<span style={{color:'red',marginLeft:'10px'}}>(Inactive)</span>}<p style={{fontSize:'14px',color:'#666'}}>{s.student_id} • {s.class} • {s.house_name}</p><p style={{fontSize:'12px',color:'#999'}}>{s.email}</p></div><div className="action-buttons"><button onClick={()=>{setEditingStudent(s);setStudentForm({student_id:s.student_id,first_name:s.first_name,last_name:s.last_name,email:s.email,password:'',phone:s.phone||'',class:s.class||'',house_id:s.house_id,guardian_name:s.guardian_name||'',guardian_phone:s.guardian_phone||''});setShowStudentForm(true);}} className="btn-sm">✏️</button><button onClick={()=>handleResetPassword(s.id,`${s.first_name} ${s.last_name}`)} className="btn-sm">🔑</button>{s.is_active&&(<button onClick={()=>handleRemoveStudent(s.id,`${s.first_name} ${s.last_name}`)} className="btn-sm btn-danger">🗑️</button>)}</div></div>)))}</div></div>)}
        {activeTab==='analytics'&&user.role==='headmaster'&&(<div><h2>Analytics</h2><p>Coming soon</p></div>)}
        {activeTab==='audit'&&user.role==='headmaster'&&(<div><h2>Audit Logs</h2><p>Coming soon</p></div>)}
      </main>
      {showRequestForm&&(<div className="modal-overlay" onClick={()=>setShowRequestForm(false)}><div className="modal-content" onClick={(e)=>e.stopPropagation()}><h2 style={{fontSize:'24px',fontWeight:'700',marginBottom:'20px'}}>{editingRequest?'Edit':'New'} Request</h2><form onSubmit={handleSubmitRequest}><input type="date" value={requestForm.departure_date} onChange={(e)=>setRequestForm({...requestForm,departure_date:e.target.value})} style={{width:'100%',padding:'12px',marginBottom:'15px',border:'1px solid #ddd',borderRadius:'8px'}} required/><input type="time" value={requestForm.departure_time} onChange={(e)=>setRequestForm({...requestForm,departure_time:e.target.value})} style={{width:'100%',padding:'12px',marginBottom:'15px',border:'1px solid #ddd',borderRadius:'8px'}} required/><select value={requestForm.duration} onChange={(e)=>setRequestForm({...requestForm,duration:e.target.value})} style={{width:'100%',padding:'12px',marginBottom:'15px',border:'1px solid #ddd',borderRadius:'8px'}}><option value="1 day">1 Day</option><option value="2 days">2 Days</option><option value="3 days">3 Days</option><option value="1 week">1 Week</option></select><input type="text" placeholder="Destination" value={requestForm.destination} onChange={(e)=>setRequestForm({...requestForm,destination:e.target.value})} style={{width:'100%',padding:'12px',marginBottom:'15px',border:'1px solid #ddd',borderRadius:'8px'}} required/><textarea placeholder="Reason" value={requestForm.reason} onChange={(e)=>setRequestForm({...requestForm,reason:e.target.value})} style={{width:'100%',padding:'12px',marginBottom:'15px',border:'1px solid #ddd',borderRadius:'8px',minHeight:'100px'}} required/><input type="text" placeholder="Guardian Name" value={requestForm.guardian_name} onChange={(e)=>setRequestForm({...requestForm,guardian_name:e.target.value})} style={{width:'100%',padding:'12px',marginBottom:'15px',border:'1px solid #ddd',borderRadius:'8px'}} required/><input type="tel" placeholder="Guardian Phone" value={requestForm.guardian_phone} onChange={(e)=>setRequestForm({...requestForm,guardian_phone:e.target.value})} style={{width:'100%',padding:'12px',marginBottom:'20px',border:'1px solid #ddd',borderRadius:'8px'}} required/><div style={{display:'flex',gap:'10px'}}><button type="submit" className="btn-primary" style={{flex:1}}>{editingRequest?'Update':'Submit'}</button><button type="button" onClick={()=>{setShowRequestForm(false);setEditingRequest(null);}} className="btn-secondary" style={{flex:1}}>Cancel</button></div></form></div></div>)}
      {showRequestDetails&&(<div className="modal-overlay" onClick={()=>setShowRequestDetails(null)}><div className="modal-content" onClick={(e)=>e.stopPropagation()}><h2>Request Details</h2><p><strong>Student:</strong> {showRequestDetails.student_name}</p><p><strong>House:</strong> {showRequestDetails.house_name}</p><p><strong>Destination:</strong> {showRequestDetails.destination}</p><p><strong>Date:</strong> {showRequestDetails.departure_date} {showRequestDetails.departure_time}</p><p><strong>Duration:</strong> {showRequestDetails.duration}</p><p><strong>Reason:</strong> {showRequestDetails.reason}</p><p><strong>Guardian:</strong> {showRequestDetails.guardian_name} ({showRequestDetails.guardian_phone})</p><p><strong>Status:</strong> <span className={`status-badge status-${showRequestDetails.status}`}>{showRequestDetails.status}</span></p><button onClick={()=>setShowRequestDetails(null)} className="btn-secondary" style={{width:'100%',marginTop:'20px'}}>Close</button></div></div>)}
      {showNoteModal&&(<div className="modal-overlay" onClick={()=>setShowNoteModal(null)}><div className="modal-content" onClick={(e)=>e.stopPropagation()}><h2>Add Note</h2><textarea placeholder="Note..." value={noteText} onChange={(e)=>setNoteText(e.target.value)} style={{width:'100%',padding:'12px',border:'1px solid #ddd',borderRadius:'8px',minHeight:'150px',marginBottom:'20px'}}/><div style={{display:'flex',gap:'10px'}}><button onClick={handleAddNote} className="btn-primary" style={{flex:1}}>Add</button><button onClick={()=>setShowNoteModal(null)} className="btn-secondary" style={{flex:1}}>Cancel</button></div></div></div>)}
      {showStudentForm&&(<div className="modal-overlay" onClick={()=>setShowStudentForm(false)}><div className="modal-content" style={{maxWidth:'700px'}} onClick={(e)=>e.stopPropagation()}><h2>{editingStudent?'Edit':'Add'} Student</h2><form onSubmit={handleSubmitStudent}><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'15px'}}><input type="text" placeholder="Student ID*" value={studentForm.student_id} onChange={(e)=>setStudentForm({...studentForm,student_id:e.target.value})} style={{width:'100%',padding:'12px',border:'1px solid #ddd',borderRadius:'8px'}} required/><input type="text" placeholder="First Name*" value={studentForm.first_name} onChange={(e)=>setStudentForm({...studentForm,first_name:e.target.value})} style={{width:'100%',padding:'12px',border:'1px solid #ddd',borderRadius:'8px'}} required/><input type="text" placeholder="Last Name*" value={studentForm.last_name} onChange={(e)=>setStudentForm({...studentForm,last_name:e.target.value})} style={{width:'100%',padding:'12px',border:'1px solid #ddd',borderRadius:'8px'}} required/><input type="email" placeholder="Email*" value={studentForm.email} onChange={(e)=>setStudentForm({...studentForm,email:e.target.value})} style={{width:'100%',padding:'12px',border:'1px solid #ddd',borderRadius:'8px'}} required/><input type="password" placeholder={editingStudent?"New Password (optional)":"Password*"} value={studentForm.password} onChange={(e)=>setStudentForm({...studentForm,password:e.target.value})} style={{width:'100%',padding:'12px',border:'1px solid #ddd',borderRadius:'8px'}} required={!editingStudent}/><input type="tel" placeholder="Phone" value={studentForm.phone} onChange={(e)=>setStudentForm({...studentForm,phone:e.target.value})} style={{width:'100%',padding:'12px',border:'1px solid #ddd',borderRadius:'8px'}}/><input type="text" placeholder="Class" value={studentForm.class} onChange={(e)=>setStudentForm({...studentForm,class:e.target.value})} style={{width:'100%',padding:'12px',border:'1px solid #ddd',borderRadius:'8px'}}/>{user.role==='headmaster'&&(<select value={studentForm.house_id} onChange={(e)=>setStudentForm({...studentForm,house_id:e.target.value})} style={{width:'100%',padding:'12px',border:'1px solid #ddd',borderRadius:'8px'}} required><option value="">Select House*</option>{houses.map(h=>(<option key={h.id} value={h.id}>{h.name}</option>))}</select>)}<input type="text" placeholder="Guardian Name" value={studentForm.guardian_name} onChange={(e)=>setStudentForm({...studentForm,guardian_name:e.target.value})} style={{width:'100%',padding:'12px',border:'1px solid #ddd',borderRadius:'8px'}}/><input type="tel" placeholder="Guardian Phone" value={studentForm.guardian_phone} onChange={(e)=>setStudentForm({...studentForm,guardian_phone:e.target.value})} style={{width:'100%',padding:'12px',border:'1px solid #ddd',borderRadius:'8px'}}/></div><div style={{display:'flex',gap:'10px',marginTop:'20px'}}><button type="submit" className="btn-primary" style={{flex:1}}>{editingStudent?'Update':'Add'}</button><button type="button" onClick={()=>{setShowStudentForm(false);setEditingStudent(null);}} className="btn-secondary" style={{flex:1}}>Cancel</button></div></form></div></div>)}
    </div>
  );
}

export default App;