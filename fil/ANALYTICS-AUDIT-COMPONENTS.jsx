{/* Analytics Tab - Headmaster Only */}
{activeTab==='analytics'&&user.role==='headmaster'&&(
  <div style={{animation:'fadeIn 0.5s'}}>
    <h2 style={{fontSize:'28px',fontWeight:'700',marginBottom:'30px',color:darkMode?'white':'#1a1a1a'}}>Analytics Dashboard 📊</h2>
    
    {/* House Performance */}
    <div style={{background:darkMode?'#1e293b':'white',borderRadius:'16px',padding:'30px',marginBottom:'30px',boxShadow:'0 2px 10px rgba(0,0,0,0.05)'}}>
      <h3 style={{fontSize:'20px',fontWeight:'600',marginBottom:'20px',color:darkMode?'white':'#1a1a1a'}}>House Performance</h3>
      <div style={{display:'grid',gap:'20px'}}>
        {houses.map(house=>{
          const houseRequests = requests.filter(r=>r.house_id===house.id);
          const approved = houseRequests.filter(r=>r.status==='approved').length;
          const pending = houseRequests.filter(r=>r.status==='pending').length;
          const total = houseRequests.length;
          const approvalRate = total > 0 ? Math.round((approved/total)*100) : 0;
          
          return (
            <div key={house.id} style={{padding:'20px',background:darkMode?'#0f172a':'#f8f9fa',borderRadius:'12px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}>
                <strong style={{fontSize:'16px',color:darkMode?'white':'#1a1a1a'}}>{house.name}</strong>
                <span style={{fontSize:'14px',color:darkMode?'#94a3b8':'#666'}}>{total} requests</span>
              </div>
              <div style={{display:'flex',gap:'10px',marginBottom:'10px'}}>
                <div style={{flex:1,textAlign:'center',padding:'12px',background:'linear-gradient(135deg,#4facfe 0%,#00f2fe 100%)',borderRadius:'8px',color:'white'}}>
                  <div style={{fontSize:'24px',fontWeight:'700'}}>{approved}</div>
                  <div style={{fontSize:'12px',opacity:0.9}}>Approved</div>
                </div>
                <div style={{flex:1,textAlign:'center',padding:'12px',background:'linear-gradient(135deg,#f093fb 0%,#f5576c 100%)',borderRadius:'8px',color:'white'}}>
                  <div style={{fontSize:'24px',fontWeight:'700'}}>{pending}</div>
                  <div style={{fontSize:'12px',opacity:0.9}}>Pending</div>
                </div>
                <div style={{flex:1,textAlign:'center',padding:'12px',background:'linear-gradient(135deg,#667eea 0%,#764ba2 100%)',borderRadius:'8px',color:'white'}}>
                  <div style={{fontSize:'24px',fontWeight:'700'}}>{approvalRate}%</div>
                  <div style={{fontSize:'12px',opacity:0.9}}>Rate</div>
                </div>
              </div>
              {/* Progress Bar */}
              <div style={{height:'8px',background:darkMode?'#334155':'#e5e7eb',borderRadius:'4px',overflow:'hidden'}}>
                <div style={{height:'100%',width:`${approvalRate}%`,background:'linear-gradient(90deg,#667eea 0%,#764ba2 100%)',transition:'width 0.3s'}}></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>

    {/* Status Overview */}
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(250px, 1fr))',gap:'20px',marginBottom:'30px'}}>
      <div style={{background:'linear-gradient(135deg,#667eea 0%,#764ba2 100%)',borderRadius:'16px',padding:'30px',color:'white',boxShadow:'0 10px 30px rgba(102, 126, 234, 0.3)'}}>
        <div style={{fontSize:'14px',opacity:0.9,marginBottom:'8px'}}>Total Students</div>
        <div style={{fontSize:'42px',fontWeight:'700'}}>{students.length || 0}</div>
      </div>
      <div style={{background:'linear-gradient(135deg,#4facfe 0%,#00f2fe 100%)',borderRadius:'16px',padding:'30px',color:'white',boxShadow:'0 10px 30px rgba(79, 172, 254, 0.3)'}}>
        <div style={{fontSize:'14px',opacity:0.9,marginBottom:'8px'}}>Active Requests</div>
        <div style={{fontSize:'42px',fontWeight:'700'}}>{requests.filter(r=>r.status==='pending').length}</div>
      </div>
      <div style={{background:'linear-gradient(135deg,#fa709a 0%,#fee140 100%)',borderRadius:'16px',padding:'30px',color:'white',boxShadow:'0 10px 30px rgba(250, 112, 154, 0.3)'}}>
        <div style={{fontSize:'14px',opacity:0.9,marginBottom:'8px'}}>Approval Rate</div>
        <div style={{fontSize:'42px',fontWeight:'700'}}>
          {requests.length > 0 ? Math.round((stats.approved / requests.length) * 100) : 0}%
        </div>
      </div>
    </div>

    {/* Recent Activity */}
    <div style={{background:darkMode?'#1e293b':'white',borderRadius:'16px',padding:'30px',boxShadow:'0 2px 10px rgba(0,0,0,0.05)'}}>
      <h3 style={{fontSize:'20px',fontWeight:'600',marginBottom:'20px',color:darkMode?'white':'#1a1a1a'}}>Recent Activity</h3>
      <div style={{display:'grid',gap:'12px'}}>
        {requests.slice(0,10).map(req=>(
          <div key={req.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'15px',background:darkMode?'#0f172a':'#f8f9fa',borderRadius:'10px'}}>
            <div>
              <strong style={{color:darkMode?'white':'#1a1a1a',display:'block',marginBottom:'4px'}}>{req.student_name}</strong>
              <span style={{fontSize:'14px',color:darkMode?'#94a3b8':'#666'}}>{req.destination} • {req.departure_date}</span>
            </div>
            <span style={{padding:'6px 16px',borderRadius:'20px',fontSize:'13px',fontWeight:'500',background:req.status==='approved'?'#d1fae5':req.status==='pending'?'#fef3c7':'#fee2e2',color:req.status==='approved'?'#059669':req.status==='pending'?'#ca8a04':'#dc2626'}}>{req.status}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
)}

{/* Audit Logs Tab - Headmaster Only */}
{activeTab==='audit'&&user.role==='headmaster'&&(
  <div style={{animation:'fadeIn 0.5s'}}>
    <h2 style={{fontSize:'28px',fontWeight:'700',marginBottom:'30px',color:darkMode?'white':'#1a1a1a'}}>Audit Logs 🔍</h2>
    
    {/* Filters */}
    <div style={{background:darkMode?'#1e293b':'white',borderRadius:'16px',padding:'20px',marginBottom:'20px',boxShadow:'0 2px 10px rgba(0,0,0,0.05)'}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))',gap:'15px'}}>
        <input 
          type="text" 
          placeholder="🔍 Search logs..." 
          style={{padding:'12px',border:darkMode?'1px solid #334155':'1px solid #e5e7eb',borderRadius:'10px',background:darkMode?'#0f172a':'white',color:darkMode?'white':'#1a1a1a'}}
        />
        <select style={{padding:'12px',border:darkMode?'1px solid #334155':'1px solid #e5e7eb',borderRadius:'10px',background:darkMode?'#0f172a':'white',color:darkMode?'white':'#1a1a1a'}}>
          <option value="">All Actions</option>
          <option value="REQUEST_CREATED">Request Created</option>
          <option value="REQUEST_APPROVED">Request Approved</option>
          <option value="REQUEST_REJECTED">Request Rejected</option>
          <option value="STUDENT_ADDED">Student Added</option>
          <option value="STUDENT_REMOVED">Student Removed</option>
        </select>
        <input 
          type="date" 
          style={{padding:'12px',border:darkMode?'1px solid #334155':'1px solid #e5e7eb',borderRadius:'10px',background:darkMode?'#0f172a':'white',color:darkMode?'white':'#1a1a1a'}}
        />
      </div>
    </div>

    {/* Audit Logs Table */}
    <div style={{background:darkMode?'#1e293b':'white',borderRadius:'16px',padding:'30px',boxShadow:'0 2px 10px rgba(0,0,0,0.05)'}}>
      <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr style={{borderBottom:darkMode?'2px solid #334155':'2px solid #e5e7eb'}}>
              <th style={{textAlign:'left',padding:'15px',color:darkMode?'#94a3b8':'#666',fontSize:'14px',fontWeight:'600'}}>Time</th>
              <th style={{textAlign:'left',padding:'15px',color:darkMode?'#94a3b8':'#666',fontSize:'14px',fontWeight:'600'}}>User</th>
              <th style={{textAlign:'left',padding:'15px',color:darkMode?'#94a3b8':'#666',fontSize:'14px',fontWeight:'600'}}>Action</th>
              <th style={{textAlign:'left',padding:'15px',color:darkMode?'#94a3b8':'#666',fontSize:'14px',fontWeight:'600'}}>Details</th>
              <th style={{textAlign:'left',padding:'15px',color:darkMode?'#94a3b8':'#666',fontSize:'14px',fontWeight:'600'}}>IP</th>
            </tr>
          </thead>
          <tbody>
            {/* Sample audit log entries - Replace with real data from API */}
            {[
              {id:1,time:'2 mins ago',user:'John Doe',action:'REQUEST_APPROVED',details:'Approved exeat for Abena Mensah',ip:'192.168.1.1'},
              {id:2,time:'15 mins ago',user:'Jane Smith',action:'STUDENT_ADDED',details:'Added new student: Kwame Boateng',ip:'192.168.1.2'},
              {id:3,time:'1 hour ago',user:'Douglas Yakubu',action:'REQUEST_REJECTED',details:'Rejected exeat request - Incomplete info',ip:'192.168.1.3'},
              {id:4,time:'2 hours ago',user:'Matilda Adombiri',action:'STUDENT_REMOVED',details:'Removed student: Ibrahim Sule',ip:'192.168.1.4'},
              {id:5,time:'3 hours ago',user:'Abena Mensah',action:'REQUEST_CREATED',details:'Created new exeat request to Accra',ip:'192.168.1.5'},
            ].map(log=>(
              <tr key={log.id} style={{borderBottom:darkMode?'1px solid #334155':'1px solid #e5e7eb',transition:'background 0.2s'}} onMouseOver={(e)=>e.currentTarget.style.background=darkMode?'#0f172a':'#f8f9fa'} onMouseOut={(e)=>e.currentTarget.style.background='transparent'}>
                <td style={{padding:'15px',color:darkMode?'#94a3b8':'#666',fontSize:'14px'}}>{log.time}</td>
                <td style={{padding:'15px',color:darkMode?'white':'#1a1a1a',fontSize:'14px',fontWeight:'500'}}>{log.user}</td>
                <td style={{padding:'15px'}}>
                  <span style={{padding:'4px 12px',borderRadius:'12px',fontSize:'12px',fontWeight:'500',background:log.action.includes('APPROVED')?'#d1fae5':log.action.includes('REJECTED')?'#fee2e2':log.action.includes('ADDED')?'#dbeafe':'#fef3c7',color:log.action.includes('APPROVED')?'#059669':log.action.includes('REJECTED')?'#dc2626':log.action.includes('ADDED')?'#2563eb':'#ca8a04'}}>
                    {log.action.replace('_',' ')}
                  </span>
                </td>
                <td style={{padding:'15px',color:darkMode?'#94a3b8':'#666',fontSize:'14px'}}>{log.details}</td>
                <td style={{padding:'15px',color:darkMode?'#64748b':'#999',fontSize:'13px',fontFamily:'monospace'}}>{log.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Load More Button */}
      <div style={{textAlign:'center',marginTop:'20px'}}>
        <button style={{padding:'10px 24px',background:darkMode?'#334155':'#f1f5f9',color:darkMode?'white':'#1a1a1a',border:'none',borderRadius:'10px',cursor:'pointer',fontSize:'14px',fontWeight:'500',transition:'all 0.2s'}} onMouseOver={(e)=>e.target.style.background=darkMode?'#475569':'#e2e8f0'} onMouseOut={(e)=>e.target.style.background=darkMode?'#334155':'#f1f5f9'}>
          Load More
        </button>
      </div>
    </div>
  </div>
)}
