import React, { useState, useEffect } from 'react';
import './App.css';

const API_URL = 'http://10.107.103.196:5000/api';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
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
        setLoading(false);
      }
    } catch (error) {
      console.error('Profile fetch error:', error);
      localStorage.removeItem('token');
      setLoading(false);
    }
  };

  const fetchDashboardData = async (token, currentUser) => {
    const userRole = currentUser || user;
    try {
      const authToken = token || localStorage.getItem('token');
      
      // Fetch stats with error handling
      try {
        const statsRes = await fetch(`${API_URL}/requests/stats/overview`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const statsData = await statsRes.json();
        if (statsData.success && statsData.data) {
          setStats(statsData.data);
        } else {
          console.log('Stats not available, using defaults');
        }
      } catch (err) {
        console.log('Stats error:', err);
      }

      // Fetch requests
      try {
        const requestsRes = await fetch(`${API_URL}/requests`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const requestsData = await requestsRes.json();
        if (requestsData.success) setRequests(requestsData.data || []);
      } catch (err) {
        console.log('Requests error:', err);
      }

      // Fetch houses
      try {
        const housesRes = await fetch(`${API_URL}/houses`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const housesData = await housesRes.json();
        if (housesData.success) setHouses(housesData.data || []);
      } catch (err) {
        console.log('Houses error:', err);
      }
      
      // Fetch students if applicable
      if (userRole?.role === 'housemaster' || userRole?.role === 'headmaster') {
        fetchStudents(authToken);
      }
    } catch (error) {
      console.error('Dashboard fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async (token) => {
    try {
      const response = await fetch(`${API_URL}/users/students`, {
        headers: { 'Authorization': `Bearer ${token || localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (data.success) setStudents(data.data || []);
    } catch (error) {
      console.error('Students fetch error:', error);
    }
  };

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

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setStats({ total: 0, pending: 0, approved: 0, rejected: 0 });
    setRequests([]);
    setStudents([]);
    setActiveTab('dashboard');
  };

  const quickLogin = (email, password) => {
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
        alert(data.message || 'Request submitted successfully');
      } else {
        alert(data.message || 'Failed to submit request');
      }
    } catch (error) {
      alert('Connection error. Please try again.');
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

  const handleRejectRequest = async (id) => {
    const reason = prompt('Reason for rejection:');
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
        alert('Request rejected');
      }
    } catch (error) {
      alert('Failed to reject request');
    }
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

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.body.classList.toggle('dark-mode');
  };

  const filteredRequests = requests.filter(req => {
    if (filters.status && req.status !== filters.status) return false;
    if (filters.house_id && req.house_id !== parseInt(filters.house_id)) return false;
    if (filters.search && !req.student_name.toLowerCase().includes(filters.search.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return (
      <div style={{display:'flex',justifyContent:'center',alignItems:'center',height:'100vh',background:'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}}>
        <div style={{textAlign:'center',color:'white'}}>
          <div style={{fontSize:'48px',marginBottom:'20px'}}>🏫</div>
          <div style={{fontSize:'24px',fontWeight:'600'}}>Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{minHeight:'100vh',background:'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}}>
        <div style={{background:'white',borderRadius:'20px',padding:'40px',maxWidth:'450px',width:'100%',boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}}>
          <div style={{textAlign:'center',marginBottom:'30px'}}>
            <img src="/logo.png" alt="GHANASCO Logo" style={{width:'80px',height:'80px',borderRadius:'50%',objectFit:'cover',marginBottom:'20px',boxShadow:'0 10px 30px rgba(102, 126, 234, 0.4)'}} />
            <h1 style={{fontSize:'32px',fontWeight:'700',marginBottom:'8px',color:'#1a1a1a'}}>GHANASCO</h1>
            <p style={{fontSize:'16px',color:'#666'}}>Exeat Management System</p>
          </div>
          {loginError && (
            <div style={{background:'#fee',border:'1px solid #fcc',padding:'12px',borderRadius:'10px',marginBottom:'20px',color:'#c33',textAlign:'center'}}>
              {loginError}
            </div>
          )}
          <form id="loginForm" onSubmit={handleLogin}>
            <input 
              type="email" 
              placeholder="📧 Email Address" 
              value={loginEmail} 
              onChange={(e)=>setLoginEmail(e.target.value)} 
              style={{width:'100%',padding:'14px 18px',marginBottom:'15px',border:'2px solid #e5e7eb',borderRadius:'12px',fontSize:'15px',transition:'all 0.3s'}} 
              required 
            />
            <input 
              type="password" 
              placeholder="🔒 Password" 
              value={loginPassword} 
              onChange={(e)=>setLoginPassword(e.target.value)} 
              style={{width:'100%',padding:'14px 18px',marginBottom:'20px',border:'2px solid #e5e7eb',borderRadius:'12px',fontSize:'15px',transition:'all 0.3s'}} 
              required 
            />
            <button 
              type="submit" 
              style={{width:'100%',padding:'14px',background:'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',color:'white',border:'none',borderRadius:'12px',fontSize:'16px',fontWeight:'600',cursor:'pointer',transition:'transform 0.2s,box-shadow 0.2s',boxShadow:'0 4px 15px rgba(102, 126, 234, 0.4)'}}
              onMouseOver={(e)=>{e.target.style.transform='translateY(-2px)';e.target.style.boxShadow='0 6px 20px rgba(102, 126, 234, 0.6)'}}
              onMouseOut={(e)=>{e.target.style.transform='translateY(0)';e.target.style.boxShadow='0 4px 15px rgba(102, 126, 234, 0.4)'}}
            >
              Sign In
            </button>
          </form>
          <div style={{marginTop:'30px',borderTop:'1px solid #e5e7eb',paddingTop:'20px'}}>
            <p style={{marginBottom:'12px',color:'#666',fontSize:'14px',textAlign:'center'}}>Quick Access</p>
            <button onClick={()=>quickLogin('abena.mensah@ghanasco.edu.gh','house123')} style={{width:'100%',padding:'12px',marginBottom:'10px',background:'#f8f9fa',border:'1px solid #e5e7eb',borderRadius:'10px',cursor:'pointer',fontSize:'14px',fontWeight:'500',transition:'all 0.2s'}} onMouseOver={(e)=>e.target.style.background='#e5e7eb'} onMouseOut={(e)=>e.target.style.background='#f8f9fa'}>👨‍🎓 Student Login</button>
            <button onClick={()=>quickLogin('matilda.adombiri@ghanasco.edu.gh','house123')} style={{width:'100%',padding:'12px',marginBottom:'10px',background:'#f8f9fa',border:'1px solid #e5e7eb',borderRadius:'10px',cursor:'pointer',fontSize:'14px',fontWeight:'500',transition:'all 0.2s'}} onMouseOver={(e)=>e.target.style.background='#e5e7eb'} onMouseOut={(e)=>e.target.style.background='#f8f9fa'}>👨‍🏫 Housemaster Login</button>
            <button onClick={()=>quickLogin('headmaster@ghanasco.edu.gh','house123')} style={{width:'100%',padding:'12px',background:'#f8f9fa',border:'1px solid #e5e7eb',borderRadius:'10px',cursor:'pointer',fontSize:'14px',fontWeight:'500',transition:'all 0.2s'}} onMouseOver={(e)=>e.target.style.background='#e5e7eb'} onMouseOut={(e)=>e.target.style.background='#f8f9fa'}>👔 Headmaster Login</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-container ${darkMode?'dark':''}`} style={{minHeight:'100vh',background:darkMode?'#0f172a':'#f8f9fa'}}>
      <header style={{background:darkMode?'#1e293b':'white',borderBottom:'1px solid'+(darkMode?'#334155':'#e5e7eb'),padding:'15px 30px',display:'flex',justifyContent:'space-between',alignItems:'center',position:'sticky',top:0,zIndex:100,boxShadow:'0 2px 10px rgba(0,0,0,0.05)'}}>
        <div style={{display:'flex',alignItems:'center',gap:'15px'}}>
          <img src="/logo.png" alt="GHANASCO Logo" style={{width:'50px',height:'50px',borderRadius:'50%',objectFit:'cover',boxShadow:'0 4px 12px rgba(102, 126, 234, 0.4)'}} />
          <div>
            <h1 style={{fontSize:'20px',fontWeight:'700',margin:0,color:darkMode?'white':'#1a1a1a'}}>GHANASCO</h1>
            <p style={{fontSize:'12px',color:darkMode?'#94a3b8':'#666',margin:0}}>Exeat Management</p>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'20px'}}>
          <button onClick={toggleDarkMode} style={{background:'transparent',border:'none',fontSize:'24px',cursor:'pointer',padding:'8px',borderRadius:'8px',transition:'background 0.2s'}} onMouseOver={(e)=>e.target.style.background=darkMode?'#334155':'#f1f5f9'} onMouseOut={(e)=>e.target.style.background='transparent'}>{darkMode?'☀️':'🌙'}</button>
          <div style={{textAlign:'right'}}>
            <strong style={{display:'block',color:darkMode?'white':'#1a1a1a',fontSize:'15px'}}>{user.first_name} {user.last_name}</strong>
            <span style={{fontSize:'12px',color:darkMode?'#94a3b8':'#666',textTransform:'capitalize'}}>{user.role}</span>
          </div>
          <button onClick={handleLogout} style={{padding:'10px 20px',background:darkMode?'#334155':'#f1f5f9',color:darkMode?'white':'#1a1a1a',border:'none',borderRadius:'10px',cursor:'pointer',fontSize:'14px',fontWeight:'500',transition:'all 0.2s'}} onMouseOver={(e)=>e.target.style.background=darkMode?'#475569':'#e2e8f0'} onMouseOut={(e)=>e.target.style.background=darkMode?'#334155':'#f1f5f9'}>Logout</button>
        </div>
      </header>
      <nav style={{background:darkMode?'#1e293b':'white',borderBottom:'1px solid'+(darkMode?'#334155':'#e5e7eb'),padding:'0 30px',display:'flex',gap:'5px',overflowX:'auto'}}>
        <button onClick={()=>setActiveTab('dashboard')} style={{padding:'15px 20px',background:'transparent',border:'none',borderBottom:'3px solid'+(activeTab==='dashboard'?'#667eea':'transparent'),color:activeTab==='dashboard'?(darkMode?'white':'#667eea'):(darkMode?'#94a3b8':'#666'),cursor:'pointer',fontSize:'15px',fontWeight:'500',transition:'all 0.2s',whiteSpace:'nowrap'}}>📊 Dashboard</button>
        <button onClick={()=>setActiveTab('requests')} style={{padding:'15px 20px',background:'transparent',border:'none',borderBottom:'3px solid'+(activeTab==='requests'?'#667eea':'transparent'),color:activeTab==='requests'?(darkMode?'white':'#667eea'):(darkMode?'#94a3b8':'#666'),cursor:'pointer',fontSize:'15px',fontWeight:'500',transition:'all 0.2s',whiteSpace:'nowrap'}}>📝 Requests</button>
        {(user.role==='housemaster'||user.role==='headmaster')&&(
          <button onClick={()=>setActiveTab('students')} style={{padding:'15px 20px',background:'transparent',border:'none',borderBottom:'3px solid'+(activeTab==='students'?'#667eea':'transparent'),color:activeTab==='students'?(darkMode?'white':'#667eea'):(darkMode?'#94a3b8':'#666'),cursor:'pointer',fontSize:'15px',fontWeight:'500',transition:'all 0.2s',whiteSpace:'nowrap'}}>👥 Students</button>
        )}
      </nav>
      <main style={{padding:'30px',maxWidth:'1400px',margin:'0 auto'}}>
        {activeTab==='dashboard'&&(
          <div style={{animation:'fadeIn 0.5s'}}>
            <h2 style={{fontSize:'28px',fontWeight:'700',marginBottom:'30px',color:darkMode?'white':'#1a1a1a'}}>Welcome back, {user.first_name}! 👋</h2>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(250px, 1fr))',gap:'20px',marginBottom:'40px'}}>
              <div style={{background:'linear-gradient(135deg,#667eea 0%,#764ba2 100%)',borderRadius:'16px',padding:'30px',color:'white',boxShadow:'0 10px 30px rgba(102, 126, 234, 0.3)',transition:'transform 0.3s',cursor:'pointer'}} onMouseOver={(e)=>e.currentTarget.style.transform='translateY(-5px)'} onMouseOut={(e)=>e.currentTarget.style.transform='translateY(0)'}>
                <div style={{fontSize:'14px',opacity:0.9,marginBottom:'8px',fontWeight:'500'}}>Total Requests</div>
                <div style={{fontSize:'42px',fontWeight:'700',marginBottom:'8px'}}>{stats.total || 0}</div>
                <div style={{fontSize:'13px',opacity:0.8'}}>All time</div>
              </div>
              <div style={{background:'linear-gradient(135deg,#f093fb 0%,#f5576c 100%)',borderRadius:'16px',padding:'30px',color:'white',boxShadow:'0 10px 30px rgba(240, 147, 251, 0.3)',transition:'transform 0.3s',cursor:'pointer'}} onMouseOver={(e)=>e.currentTarget.style.transform='translateY(-5px)'} onMouseOut={(e)=>e.currentTarget.style.transform='translateY(0)'}>
                <div style={{fontSize:'14px',opacity:0.9,marginBottom:'8px',fontWeight:'500'}}>Pending</div>
                <div style={{fontSize:'42px',fontWeight:'700',marginBottom:'8px'}}>{stats.pending || 0}</div>
                <div style={{fontSize:'13px',opacity:0.8'}}>Awaiting approval</div>
              </div>
              <div style={{background:'linear-gradient(135deg,#4facfe 0%,#00f2fe 100%)',borderRadius:'16px',padding:'30px',color:'white',boxShadow:'0 10px 30px rgba(79, 172, 254, 0.3)',transition:'transform 0.3s',cursor:'pointer'}} onMouseOver={(e)=>e.currentTarget.style.transform='translateY(-5px)'} onMouseOut={(e)=>e.currentTarget.style.transform='translateY(0)'}>
                <div style={{fontSize:'14px',opacity:0.9,marginBottom:'8px',fontWeight:'500'}}>Approved</div>
                <div style={{fontSize:'42px',fontWeight:'700',marginBottom:'8px'}}>{stats.approved || 0}</div>
                <div style={{fontSize:'13px',opacity:0.8'}}>This semester</div>
              </div>
              <div style={{background:'linear-gradient(135deg,#fa709a 0%,#fee140 100%)',borderRadius:'16px',padding:'30px',color:'white',boxShadow:'0 10px 30px rgba(250, 112, 154, 0.3)',transition:'transform 0.3s',cursor:'pointer'}} onMouseOver={(e)=>e.currentTarget.style.transform='translateY(-5px)'} onMouseOut={(e)=>e.currentTarget.style.transform='translateY(0)'}>
                <div style={{fontSize:'14px',opacity:0.9,marginBottom:'8px',fontWeight:'500'}}>Rejected</div>
                <div style={{fontSize:'42px',fontWeight:'700',marginBottom:'8px'}}>{stats.rejected || 0}</div>
                <div style={{fontSize:'13px',opacity:0.8'}}>This semester</div>
              </div>
            </div>
            {user.role==='student'&&(
              <div style={{marginBottom:'30px'}}>
                <button onClick={()=>setShowRequestForm(true)} style={{padding:'16px 32px',background:'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',color:'white',border:'none',borderRadius:'12px',fontSize:'16px',fontWeight:'600',cursor:'pointer',boxShadow:'0 4px 15px rgba(102, 126, 234, 0.4)',transition:'all 0.3s'}} onMouseOver={(e)=>{e.target.style.transform='translateY(-2px)';e.target.style.boxShadow='0 6px 20px rgba(102, 126, 234, 0.6)'}} onMouseOut={(e)=>{e.target.style.transform='translateY(0)';e.target.style.boxShadow='0 4px 15px rgba(102, 126, 234, 0.4)'}}>➕ Submit New Request</button>
              </div>
            )}
            <div>
              <h3 style={{fontSize:'20px',fontWeight:'600',marginBottom:'20px',color:darkMode?'white':'#1a1a1a'}}>Recent Requests</h3>
              <div style={{display:'grid',gap:'15px'}}>
                {requests.slice(0,5).map(req=>(
                  <div key={req.id} style={{background:darkMode?'#1e293b':'white',borderRadius:'12px',padding:'20px',display:'flex',justifyContent:'space-between',alignItems:'center',boxShadow:'0 2px 10px rgba(0,0,0,0.05)',transition:'all 0.2s'}} onMouseOver={(e)=>e.currentTarget.style.boxShadow='0 4px 20px rgba(0,0,0,0.1)'} onMouseOut={(e)=>e.currentTarget.style.boxShadow='0 2px 10px rgba(0,0,0,0.05)'}>
                    <div>
                      <strong style={{display:'block',marginBottom:'4px',fontSize:'16px',color:darkMode?'white':'#1a1a1a'}}>{req.student_name}</strong>
                      <p style={{fontSize:'14px',color:darkMode?'#94a3b8':'#666',margin:0}}>{req.destination} • {req.departure_date}</p>
                    </div>
                    <span style={{padding:'6px 16px',borderRadius:'20px',fontSize:'13px',fontWeight:'500',background:req.status==='approved'?'#d1fae5':req.status==='pending'?'#fef3c7':req.status==='rejected'?'#fee2e2':'#e5e7eb',color:req.status==='approved'?'#059669':req.status==='pending'?'#ca8a04':req.status==='rejected'?'#dc2626':'#666'}}>{req.status}</span>
                  </div>
                ))}
                {requests.length===0&&(
                  <div style={{textAlign:'center',padding:'60px 20px',color:darkMode?'#64748b':'#666'}}>
                    <div style={{fontSize:'48px',marginBottom:'16px'}}>📋</div>
                    <p style={{fontSize:'16px',margin:0}}>No requests yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {activeTab==='requests'&&(<div>Requests content here...</div>)}
        {activeTab==='students'&&(<div>Students content here...</div>)}
      </main>
    </div>
  );
}

export default App;
