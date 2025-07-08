import React, { useState, useEffect } from 'react';
import './App.css';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Timevera Logo Component
const TimeveraLogo = ({ size = 'medium', showText = true }) => {
  const sizes = {
    small: { width: '32px', height: '32px', fontSize: '0.875rem' },
    medium: { width: '48px', height: '48px', fontSize: '1.125rem' },
    large: { width: '64px', height: '64px', fontSize: '1.5rem' }
  };

  const currentSize = sizes[size];

  return (
    <div className="timevera-logo">
      <div 
        className="logo-circle"
        style={{
          width: currentSize.width,
          height: currentSize.height,
          background: 'linear-gradient(135deg, #2DD4BF 0%, #0F766E 100%)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          boxShadow: '0 4px 8px rgba(45, 212, 191, 0.3)'
        }}
      >
        <svg 
          width="60%" 
          height="60%" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="white" 
          strokeWidth="3"
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <polyline points="20,6 9,17 4,12"></polyline>
        </svg>
      </div>
      {showText && (
        <span 
          className="logo-text"
          style={{
            marginLeft: '0.75rem',
            fontWeight: '700',
            fontSize: currentSize.fontSize,
            color: '#0F766E',
            fontFamily: '"Inter", sans-serif'
          }}
        >
          Timevera
        </span>
      )}
    </div>
  );
};

// Auth Context
const AuthContext = React.createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('timevera_user');
    const savedOrg = localStorage.getItem('timevera_organization');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    if (savedOrg) {
      setOrganization(JSON.parse(savedOrg));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API}/auth/login`, { email, password });
      const userData = response.data.user;
      const orgData = response.data.organization;
      
      setUser(userData);
      setOrganization(orgData);
      
      localStorage.setItem('timevera_user', JSON.stringify(userData));
      localStorage.setItem('timevera_organization', JSON.stringify(orgData));
      
      return { success: true, user: userData, organization: orgData };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Login failed' };
    }
  };

  const register = async (userData) => {
    try {
      const response = await axios.post(`${API}/auth/register`, userData);
      const user = response.data.user;
      setUser(user);
      localStorage.setItem('timevera_user', JSON.stringify(user));
      return { success: true, user };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Registration failed' };
    }
  };

  const logout = () => {
    setUser(null);
    setOrganization(null);
    localStorage.removeItem('timevera_user');
    localStorage.removeItem('timevera_organization');
  };

  return (
    <AuthContext.Provider value={{ user, organization, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// Clock Component
const LiveClock = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="live-clock">
      <div className="time-display">
        {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>
      <div className="date-display">
        {time.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </div>
    </div>
  );
};

// Login Component
const Login = ({ onLogin, switchToRegister }) => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await onLogin(formData.email, formData.password);
    if (!result.success) {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <TimeveraLogo size="large" />
          </div>
          <h2>Welcome to Timevera</h2>
          <p>Your comprehensive HR & Attendance solution</p>
        </div>
        
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              placeholder="Enter your email"
            />
          </div>
          
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              placeholder="Enter your password"
            />
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <button type="submit" disabled={loading} className="auth-button">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        
        <div className="auth-footer">
          <p>
            Don't have an account?{' '}
            <button onClick={switchToRegister} className="link-button">
              Sign Up
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

// Register Component
const Register = ({ onRegister, switchToLogin }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    role: 'employee',
    department: '',
    position: '',
    hourly_rate: '',
    phone: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const submitData = {
      ...formData,
      hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : null
    };

    const result = await onRegister(submitData);
    if (!result.success) {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-card register-card">
        <div className="auth-header">
          <div className="auth-logo">
            <TimeveraLogo size="large" />
          </div>
          <h2>Join Timevera</h2>
          <p>Create your account to get started</p>
        </div>
        
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-row">
            <div className="form-group">
              <label>First Name</label>
              <input
                type="text"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                required
                placeholder="First name"
              />
            </div>
            <div className="form-group">
              <label>Last Name</label>
              <input
                type="text"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                required
                placeholder="Last name"
              />
            </div>
          </div>
          
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              placeholder="Enter your email"
            />
          </div>
          
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              placeholder="Create a password"
            />
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label>Role</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              >
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
                <option value="hr">HR</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="form-group">
              <label>Department</label>
              <input
                type="text"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                placeholder="e.g., Engineering, Music"
              />
            </div>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label>Position</label>
              <input
                type="text"
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                placeholder="e.g., Developer, Musician"
              />
            </div>
            <div className="form-group">
              <label>Hourly Rate ($)</label>
              <input
                type="number"
                step="0.01"
                value={formData.hourly_rate}
                onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                placeholder="25.00"
              />
            </div>
          </div>
          
          <div className="form-group">
            <label>Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="Phone number"
            />
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <button type="submit" disabled={loading} className="auth-button">
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
        
        <div className="auth-footer">
          <p>
            Already have an account?{' '}
            <button onClick={switchToLogin} className="link-button">
              Sign In
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

// Notifications Component
const NotificationCenter = ({ user }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    if (user) {
      loadNotifications();
      // Poll for new notifications every 30 seconds
      const interval = setInterval(loadNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const loadNotifications = async () => {
    try {
      const response = await axios.get(`${API}/notifications/user/${user.id}`);
      setNotifications(response.data);
      setUnreadCount(response.data.filter(n => !n.read).length);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await axios.put(`${API}/notifications/${notificationId}/read`);
      loadNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  return (
    <div className="notification-center">
      <button 
        className="notification-button"
        onClick={() => setShowPanel(!showPanel)}
      >
        🔔
        {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
      </button>
      
      {showPanel && (
        <div className="notification-panel">
          <h3>Notifications</h3>
          <div className="notification-list">
            {notifications.length === 0 ? (
              <p>No notifications</p>
            ) : (
              notifications.map((notification) => (
                <div 
                  key={notification.id} 
                  className={`notification-item ${notification.read ? 'read' : 'unread'}`}
                  onClick={() => !notification.read && markAsRead(notification.id)}
                >
                  <div className="notification-title">{notification.title}</div>
                  <div className="notification-message">{notification.message}</div>
                  <div className="notification-time">
                    {new Date(notification.created_at).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Leave Management Component
const LeaveManagement = ({ user, organization }) => {
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    leave_type: 'vacation',
    start_date: '',
    end_date: '',
    reason: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadLeaveRequests();
  }, []);

  const loadLeaveRequests = async () => {
    try {
      let response;
      if (user.role === 'admin' || user.role === 'hr' || user.role === 'manager') {
        response = await axios.get(`${API}/leaves/organization/${organization.id}`);
      } else {
        response = await axios.get(`${API}/leaves/user/${user.id}`);
      }
      setLeaveRequests(response.data);
    } catch (error) {
      console.error('Error loading leave requests:', error);
    }
  };

  const calculateDays = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const submitLeaveRequest = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await axios.post(`${API}/leaves/request?user_id=${user.id}`, {
        ...leaveForm,
        start_date: new Date(leaveForm.start_date).toISOString(),
        end_date: new Date(leaveForm.end_date).toISOString()
      });
      alert('Leave request submitted successfully');
      setShowRequestForm(false);
      setLeaveForm({ leave_type: 'vacation', start_date: '', end_date: '', reason: '' });
      loadLeaveRequests();
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to submit leave request');
    } finally {
      setLoading(false);
    }
  };

  const approveLeave = async (leaveId) => {
    try {
      await axios.put(`${API}/leaves/${leaveId}/approve?approver_id=${user.id}&comments=Approved`);
      alert('Leave request approved');
      loadLeaveRequests();
    } catch (error) {
      alert('Failed to approve leave request');
    }
  };

  const rejectLeave = async (leaveId) => {
    const comments = prompt('Reason for rejection:');
    if (comments) {
      try {
        await axios.put(`${API}/leaves/${leaveId}/reject?approver_id=${user.id}&comments=${encodeURIComponent(comments)}`);
        alert('Leave request rejected');
        loadLeaveRequests();
      } catch (error) {
        alert('Failed to reject leave request');
      }
    }
  };

  return (
    <div className="leave-management">
      <div className="leave-header">
        <div>
          <h3>Leave Management</h3>
          <p className="section-subtitle">Manage time off requests and approvals</p>
        </div>
        {(user.role === 'employee' || user.role === 'manager') && (
          <button 
            onClick={() => setShowRequestForm(true)}
            className="request-leave-btn"
          >
            + Request Leave
          </button>
        )}
      </div>

      {/* Leave Balance Summary */}
      <div className="leave-balance-summary">
        <div className="balance-card">
          <h4>Vacation Days</h4>
          <div className="balance-value">15</div>
          <div className="balance-label">Remaining</div>
        </div>
        <div className="balance-card">
          <h4>Sick Days</h4>
          <div className="balance-value">8</div>
          <div className="balance-label">Remaining</div>
        </div>
        <div className="balance-card">
          <h4>Personal Days</h4>
          <div className="balance-value">3</div>
          <div className="balance-label">Remaining</div>
        </div>
      </div>

      {showRequestForm && (
        <div className="modal-overlay">
          <div className="modal">
            <h4>Request Leave</h4>
            <form onSubmit={submitLeaveRequest}>
              <div className="form-group">
                <label>Leave Type</label>
                <select
                  value={leaveForm.leave_type}
                  onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value })}
                >
                  <option value="vacation">Vacation</option>
                  <option value="sick">Sick Leave</option>
                  <option value="personal">Personal</option>
                  <option value="maternity">Maternity</option>
                  <option value="paternity">Paternity</option>
                  <option value="emergency">Emergency</option>
                </select>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Start Date</label>
                  <input
                    type="date"
                    value={leaveForm.start_date}
                    onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>End Date</label>
                  <input
                    type="date"
                    value={leaveForm.end_date}
                    onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                    required
                  />
                </div>
              </div>

              {leaveForm.start_date && leaveForm.end_date && (
                <div className="days-calculation">
                  <strong>Total Days: {calculateDays(leaveForm.start_date, leaveForm.end_date)}</strong>
                </div>
              )}
              
              <div className="form-group">
                <label>Reason</label>
                <textarea
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  required
                  rows="3"
                  placeholder="Please provide a reason for your leave request..."
                />
              </div>
              
              <div className="modal-actions">
                <button type="button" onClick={() => setShowRequestForm(false)}>Cancel</button>
                <button type="submit" disabled={loading}>
                  {loading ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="leave-requests">
        <h4>Leave Requests</h4>
        <div className="requests-table">
          <div className="table-header">
            <div>Employee</div>
            <div>Type</div>
            <div>Dates</div>
            <div>Days</div>
            <div>Status</div>
            <div>Actions</div>
          </div>
          
          {leaveRequests.map((request) => (
            <div key={request.id} className="table-row">
              <div className="employee-info">
                <span className="employee-name">
                  {request.user_name || `${user.first_name} ${user.last_name}`}
                </span>
                <span className="employee-dept">{request.department}</span>
              </div>
              <div className="leave-type">{request.leave_type}</div>
              <div className="leave-dates">
                {new Date(request.start_date).toLocaleDateString()} - 
                {new Date(request.end_date).toLocaleDateString()}
              </div>
              <div className="leave-days">{request.total_days} days</div>
              <div>
                <span className={`status-badge ${request.status}`}>
                  {request.status}
                </span>
              </div>
              <div>
                {request.status === 'pending' && (user.role === 'admin' || user.role === 'hr' || user.role === 'manager') && (
                  <div className="action-buttons">
                    <button 
                      onClick={() => approveLeave(request.id)}
                      className="approve-btn"
                    >
                      ✓ Approve
                    </button>
                    <button 
                      onClick={() => rejectLeave(request.id)}
                      className="reject-btn"
                    >
                      ✗ Reject
                    </button>
                  </div>
                )}
                {request.status === 'approved' && <span className="approved-text">✓ Approved</span>}
                {request.status === 'rejected' && <span className="rejected-text">✗ Rejected</span>}
              </div>
            </div>
          ))}
          
          {leaveRequests.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">📅</div>
              <h4>No Leave Requests</h4>
              <p>There are no leave requests to display.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
// Employee Management Component
const EmployeeManagement = ({ organization, user }) => {
  const [employees, setEmployees] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');

  const [newEmployee, setNewEmployee] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    role: 'employee',
    department: '',
    position: '',
    employee_id: '',
    hourly_rate: '',
    phone: '',
    manager_id: ''
  });

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      const response = await axios.get(`${API}/employees/organization/${organization.id}`);
      setEmployees(response.data);
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  };

  const addEmployee = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const employeeData = {
        ...newEmployee,
        organization_id: organization.id,
        hourly_rate: newEmployee.hourly_rate ? parseFloat(newEmployee.hourly_rate) : null
      };
      
      await axios.post(`${API}/auth/register`, employeeData);
      alert('Employee added successfully');
      setShowAddModal(false);
      setNewEmployee({
        email: '', password: '', first_name: '', last_name: '', role: 'employee',
        department: '', position: '', employee_id: '', hourly_rate: '', phone: '', manager_id: ''
      });
      loadEmployees();
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to add employee');
    } finally {
      setLoading(false);
    }
  };

  const editEmployee = (employee) => {
    setEditingEmployee(employee);
    setShowEditModal(true);
  };

  const updateEmployee = async (employeeData) => {
    setLoading(true);
    try {
      await axios.put(`${API}/employees/${editingEmployee.id}`, employeeData);
      alert('Employee updated successfully');
      setShowEditModal(false);
      setEditingEmployee(null);
      loadEmployees();
    } catch (error) {
      alert('Failed to update employee');
    } finally {
      setLoading(false);
    }
  };

  const deactivateEmployee = async (employeeId) => {
    if (window.confirm('Are you sure you want to deactivate this employee?')) {
      try {
        await axios.delete(`${API}/employees/${employeeId}`);
        alert('Employee deactivated successfully');
        loadEmployees();
      } catch (error) {
        alert('Failed to deactivate employee');
      }
    }
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         emp.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         emp.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartment = !filterDepartment || emp.department === filterDepartment;
    return matchesSearch && matchesDepartment;
  });

  const departments = [...new Set(employees.map(emp => emp.department).filter(Boolean))];

  return (
    <div className="employee-management">
      <div className="employee-header">
        <div>
          <h3>Employee Management</h3>
          <p className="section-subtitle">Manage your organization's workforce</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="add-employee-btn"
        >
          + Add Employee
        </button>
      </div>

      {/* Search and Filter */}
      <div className="employee-filters">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search employees..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="filter-box">
          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            className="filter-select"
          >
            <option value="">All Departments</option>
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Employee Stats */}
      <div className="employee-stats">
        <div className="stat-item">
          <span className="stat-number">{employees.length}</span>
          <span className="stat-label">Total Employees</span>
        </div>
        <div className="stat-item">
          <span className="stat-number">{employees.filter(e => e.is_active).length}</span>
          <span className="stat-label">Active</span>
        </div>
        <div className="stat-item">
          <span className="stat-number">{departments.length}</span>
          <span className="stat-label">Departments</span>
        </div>
      </div>
      
      <div className="employees-grid">
        {filteredEmployees.map((employee) => (
          <div key={employee.id} className="employee-card">
            <div className="employee-header">
              {employee.avatar_base64 ? (
                <img src={employee.avatar_base64} alt="Avatar" className="employee-avatar" />
              ) : (
                <div className="employee-avatar-placeholder">
                  {employee.first_name[0]}{employee.last_name[0]}
                </div>
              )}
              <div className="employee-info">
                <h4>{employee.first_name} {employee.last_name}</h4>
                <p>{employee.position} • {employee.department}</p>
                <p className="employee-id">ID: {employee.employee_id || 'Not Set'}</p>
              </div>
              <div className={`employee-status ${employee.is_active ? 'active' : 'inactive'}`}>
                {employee.is_active ? '🟢' : '🔴'}
              </div>
            </div>
            
            <div className="employee-details">
              <div className="detail-item">
                <span>Email:</span> {employee.email}
              </div>
              <div className="detail-item">
                <span>Phone:</span> {employee.phone || 'N/A'}
              </div>
              <div className="detail-item">
                <span>Role:</span> {employee.role}
              </div>
              <div className="detail-item">
                <span>Hourly Rate:</span> ${employee.hourly_rate || 'N/A'}
              </div>
              <div className="detail-item">
                <span>Manager:</span> {employee.manager_name || 'N/A'}
              </div>
              <div className="detail-item">
                <span>Hire Date:</span> {employee.hire_date ? new Date(employee.hire_date).toLocaleDateString() : 'N/A'}
              </div>
            </div>
            
            <div className="employee-actions">
              <button onClick={() => editEmployee(employee)} className="edit-btn">
                ✏️ Edit
              </button>
              <button 
                onClick={() => deactivateEmployee(employee.id)} 
                className="deactivate-btn"
              >
                🚫 Deactivate
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredEmployees.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">👥</div>
          <h4>No Employees Found</h4>
          <p>No employees match your current search criteria.</p>
        </div>
      )}

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal large">
            <h4>Add New Employee</h4>
            <form onSubmit={addEmployee}>
              <div className="form-row">
                <div className="form-group">
                  <label>First Name *</label>
                  <input
                    type="text"
                    value={newEmployee.first_name}
                    onChange={(e) => setNewEmployee({ ...newEmployee, first_name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Last Name *</label>
                  <input
                    type="text"
                    value={newEmployee.last_name}
                    onChange={(e) => setNewEmployee({ ...newEmployee, last_name: e.target.value })}
                    required
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    value={newEmployee.email}
                    onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Password *</label>
                  <input
                    type="password"
                    value={newEmployee.password}
                    onChange={(e) => setNewEmployee({ ...newEmployee, password: e.target.value })}
                    required
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Role</label>
                  <select
                    value={newEmployee.role}
                    onChange={(e) => setNewEmployee({ ...newEmployee, role: e.target.value })}
                  >
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    <option value="hr">HR</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Employee ID</label>
                  <input
                    type="text"
                    value={newEmployee.employee_id}
                    onChange={(e) => setNewEmployee({ ...newEmployee, employee_id: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Department</label>
                  <input
                    type="text"
                    value={newEmployee.department}
                    onChange={(e) => setNewEmployee({ ...newEmployee, department: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Position</label>
                  <input
                    type="text"
                    value={newEmployee.position}
                    onChange={(e) => setNewEmployee({ ...newEmployee, position: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Hourly Rate</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newEmployee.hourly_rate}
                    onChange={(e) => setNewEmployee({ ...newEmployee, hourly_rate: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Phone</label>
                  <input
                    type="tel"
                    value={newEmployee.phone}
                    onChange={(e) => setNewEmployee({ ...newEmployee, phone: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label>Manager</label>
                <select
                  value={newEmployee.manager_id}
                  onChange={(e) => setNewEmployee({ ...newEmployee, manager_id: e.target.value })}
                >
                  <option value="">No Manager</option>
                  {employees
                    .filter(emp => emp.role === 'manager' || emp.role === 'admin')
                    .map(manager => (
                      <option key={manager.id} value={manager.id}>
                        {manager.first_name} {manager.last_name}
                      </option>
                    ))}
                </select>
              </div>
              
              <div className="modal-actions">
                <button type="button" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" disabled={loading}>
                  {loading ? 'Adding...' : 'Add Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {showEditModal && editingEmployee && (
        <EmployeeEditModal
          employee={editingEmployee}
          onUpdate={updateEmployee}
          onClose={() => setShowEditModal(false)}
          loading={loading}
          employees={employees}
        />
      )}
    </div>
  );
};

// Employee Edit Modal Component
const EmployeeEditModal = ({ employee, onUpdate, onClose, loading, employees }) => {
  const [formData, setFormData] = useState({
    first_name: employee.first_name,
    last_name: employee.last_name,
    department: employee.department || '',
    position: employee.position || '',
    employee_id: employee.employee_id || '',
    hourly_rate: employee.hourly_rate || '',
    phone: employee.phone || '',
    address: employee.address || '',
    emergency_contact: employee.emergency_contact || '',
    manager_id: employee.manager_id || ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const updateData = {
      ...formData,
      hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : null
    };
    onUpdate(updateData);
  };

  return (
    <div className="modal-overlay">
      <div className="modal large">
        <h4>Edit Employee</h4>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>First Name</label>
              <input
                type="text"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Last Name</label>
              <input
                type="text"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                required
              />
            </div>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label>Department</label>
              <input
                type="text"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Position</label>
              <input
                type="text"
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
              />
            </div>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label>Employee ID</label>
              <input
                type="text"
                value={formData.employee_id}
                onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Hourly Rate</label>
              <input
                type="number"
                step="0.01"
                value={formData.hourly_rate}
                onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
              />
            </div>
          </div>
          
          <div className="form-group">
            <label>Manager</label>
            <select
              value={formData.manager_id}
              onChange={(e) => setFormData({ ...formData, manager_id: e.target.value })}
            >
              <option value="">No Manager</option>
              {employees
                .filter(emp => emp.id !== employee.id && (emp.role === 'manager' || emp.role === 'admin'))
                .map(manager => (
                  <option key={manager.id} value={manager.id}>
                    {manager.first_name} {manager.last_name}
                  </option>
                ))}
            </select>
          </div>
          
          <div className="form-group">
            <label>Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>
          
          <div className="form-group">
            <label>Address</label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows="3"
            />
          </div>
          
          <div className="form-group">
            <label>Emergency Contact</label>
            <input
              type="text"
              value={formData.emergency_contact}
              onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })}
            />
          </div>
          
          <div className="modal-actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={loading}>
              {loading ? 'Updating...' : 'Update Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Dashboard Component
const Dashboard = ({ user, organization, onLogout }) => {
  const [currentView, setCurrentView] = useState('dashboard');
  const [dashboardStats, setDashboardStats] = useState(null);
  const [currentAttendance, setCurrentAttendance] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDashboardData();
    loadCurrentAttendance();
  }, [user]);

  const loadDashboardData = async () => {
    try {
      const response = await axios.get(`${API}/dashboard/stats/${user.id}`);
      setDashboardStats(response.data);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  const loadCurrentAttendance = async () => {
    try {
      const response = await axios.get(`${API}/attendance/current/${user.id}`);
      setCurrentAttendance(response.data);
    } catch (error) {
      console.error('Error loading current attendance:', error);
    }
  };

  const handleAttendanceAction = async (action) => {
    setLoading(true);
    try {
      const response = await axios.post(`${API}/attendance/action`, {
        user_id: user.id,
        action
      });
      
      await loadCurrentAttendance();
      await loadDashboardData();
      
      alert(response.data.message);
    } catch (error) {
      alert(error.response?.data?.detail || 'Action failed');
    }
    setLoading(false);
  };

  const AttendanceCard = () => (
    <div className="attendance-card">
      <h3>Quick Actions</h3>
      <LiveClock />
      
      <div className="attendance-status">
        <div className={`status-indicator ${currentAttendance?.status || 'clocked_out'}`}>
          {currentAttendance?.status === 'clocked_in' ? '🟢 Clocked In' : 
           currentAttendance?.status === 'break' ? '🟡 On Break' : 
           '🔴 Clocked Out'}
        </div>
      </div>
      
      <div className="attendance-actions">
        {currentAttendance?.status === 'clocked_out' ? (
          <button
            onClick={() => handleAttendanceAction('clock_in')}
            disabled={loading}
            className="action-btn clock-in"
          >
            Clock In
          </button>
        ) : currentAttendance?.status === 'clocked_in' ? (
          <div className="action-group">
            <button
              onClick={() => handleAttendanceAction('clock_out')}
              disabled={loading}
              className="action-btn clock-out"
            >
              Clock Out
            </button>
            <button
              onClick={() => handleAttendanceAction('break_start')}
              disabled={loading}
              className="action-btn break-btn"
            >
              Start Break
            </button>
          </div>
        ) : currentAttendance?.status === 'break' ? (
          <button
            onClick={() => handleAttendanceAction('break_end')}
            disabled={loading}
            className="action-btn break-end"
          >
            End Break
          </button>
        ) : null}
      </div>
      
      {currentAttendance?.clock_in && (
        <div className="current-session">
          <p><strong>Clocked in at:</strong> {new Date(currentAttendance.clock_in).toLocaleTimeString()}</p>
        </div>
      )}
    </div>
  );

  const StatsCard = () => (
    <div className="stats-grid">
      <div className="stat-card">
        <h4>This Month</h4>
        <div className="stat-value">{dashboardStats?.total_hours_month?.toFixed(1) || 0}h</div>
        <div className="stat-label">Total Hours</div>
      </div>
      
      <div className="stat-card">
        <h4>Overtime</h4>
        <div className="stat-value">{dashboardStats?.overtime_hours_month?.toFixed(1) || 0}h</div>
        <div className="stat-label">Extra Hours</div>
      </div>
      
      <div className="stat-card">
        <h4>Days Worked</h4>
        <div className="stat-value">{dashboardStats?.days_worked_month || 0}</div>
        <div className="stat-label">This Month</div>
      </div>
      
      <div className="stat-card">
        <h4>Leave Balance</h4>
        <div className="stat-value">{dashboardStats?.leave_balances?.vacation || 20}</div>
        <div className="stat-label">Vacation Days</div>
      </div>
    </div>
  );

  const OrganizationBranding = () => {
    if (!organization) return <TimeveraLogo size="medium" />;
    
    return (
      <div className="organization-branding">
        {organization.logo_base64 ? (
          <img src={organization.logo_base64} alt={organization.name} className="org-logo" />
        ) : (
          <TimeveraLogo size="medium" showText={false} />
        )}
        <h1 style={{ color: organization.primary_color || '#0F766E' }}>{organization.name}</h1>
      </div>
    );
  };

  return (
    <div className="dashboard">
      <nav className="dashboard-nav">
        <div className="nav-brand">
          <OrganizationBranding />
          <span className="powered-by">Powered by Timevera</span>
        </div>
        
        <div className="nav-menu">
          <button 
            className={currentView === 'dashboard' ? 'active' : ''}
            onClick={() => setCurrentView('dashboard')}
          >
            Dashboard
          </button>
          <button 
            className={currentView === 'attendance' ? 'active' : ''}
            onClick={() => setCurrentView('attendance')}
          >
            Attendance
          </button>
          <button 
            className={currentView === 'leaves' ? 'active' : ''}
            onClick={() => setCurrentView('leaves')}
          >
            Leave Management
          </button>
          {(user.role === 'admin' || user.role === 'hr') && (
            <>
              <button 
                className={currentView === 'employees' ? 'active' : ''}
                onClick={() => setCurrentView('employees')}
              >
                Employees
              </button>
              <button 
                className={currentView === 'payroll' ? 'active' : ''}
                onClick={() => setCurrentView('payroll')}
              >
                Payroll
              </button>
              <button 
                className={currentView === 'analytics' ? 'active' : ''}
                onClick={() => setCurrentView('analytics')}
              >
                Analytics
              </button>
            </>
          )}
          {user.role === 'admin' && (
            <button 
              className={currentView === 'settings' ? 'active' : ''}
              onClick={() => setCurrentView('settings')}
            >
              Settings
            </button>
          )}
          {organization?.subscription_status === 'trial' && (
            <button 
              className={currentView === 'subscription' ? 'active' : ''}
              onClick={() => setCurrentView('subscription')}
            >
              Upgrade
            </button>
          )}
        </div>
        
        <div className="nav-user">
          <span>Welcome, {user.first_name}</span>
          <button onClick={onLogout} className="logout-btn">Logout</button>
        </div>
      </nav>
      
      <main className="dashboard-main">
        {currentView === 'dashboard' && (
          <div className="dashboard-content">
            <div className="dashboard-grid">
              <div className="grid-item">
                <AttendanceCard />
              </div>
              <div className="grid-item">
                <StatsCard />
              </div>
            </div>
            
            <div className="feature-notice">
              <div className="timevera-brand-header">
                <TimeveraLogo size="large" />
                <div>
                  <h3>🚀 Timevera v3.0 - Enterprise Features Available!</h3>
                  <p>Complete HR, Payroll & Attendance Management Solution</p>
                </div>
              </div>
              <div className="features-list">
                <div className="feature-item">✓ Real-time Attendance Tracking</div>
                <div className="feature-item">✓ Advanced Leave Management</div>
                <div className="feature-item">✓ Employee Management Portal</div>
                <div className="feature-item">✓ Multi-currency Payroll System</div>
                <div className="feature-item">✓ Custom Organization Branding</div>
                <div className="feature-item">✓ Analytics & Reporting Dashboard</div>
                <div className="feature-item">✓ Data Export & API Access</div>
                <div className="feature-item">✓ Cross-platform Compatibility</div>
              </div>
              <p className="upgrade-message">
                Upgrade to Premium or Enterprise to unlock all features!
              </p>
            </div>
          </div>
        )}
        
        {currentView !== 'dashboard' && (
          <div className="coming-soon">
            <TimeveraLogo size="large" />
            <h3>🔧 {currentView.charAt(0).toUpperCase() + currentView.slice(1)} Module</h3>
            <p>This advanced feature is being loaded...</p>
            <p>Timevera v3.0 includes comprehensive {currentView} management with enterprise-grade capabilities.</p>
          </div>
        )}
      </main>
      
      <footer className="dashboard-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <TimeveraLogo size="small" />
          </div>
          <div className="footer-links">
            <span>Terms of Use</span>
            <span>Privacy Policy</span>
            <span>© 2025 Timevera. All Rights Reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

// Landing Page Component
const LandingPage = ({ onGetStarted }) => {
  return (
    <div className="landing-page">
      <div className="hero-section">
        <div className="hero-content">
          <div className="hero-brand">
            <TimeveraLogo size="large" />
          </div>
          <h1>Welcome to Timevera</h1>
          <p className="hero-subtitle">
            The comprehensive HR, Payroll & Attendance management system
          </p>
          <p className="hero-description">
            Perfect for all industries - from musicians and gig workers to schools and traditional businesses. 
            Scale from one employee to thousands with our powerful, intuitive platform.
          </p>
          <div className="feature-highlights">
            <div className="highlight">✓ Multi-currency support</div>
            <div className="highlight">✓ Custom branding</div>
            <div className="highlight">✓ Advanced payroll</div>
            <div className="highlight">✓ Real-time attendance</div>
          </div>
          <button onClick={onGetStarted} className="cta-button">
            Get Started - Free Trial
          </button>
        </div>
        <div className="hero-image">
          <img 
            src="https://images.unsplash.com/photo-1580982330720-bd5e0fed108b" 
            alt="Modern workplace technology"
          />
        </div>
      </div>
      
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <TimeveraLogo size="small" />
          </div>
          <div className="footer-links">
            <span>Terms of Use</span>
            <span>Privacy Policy</span>
            <span>© 2025 Timevera. All Rights Reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

// Main App Component
const App = () => {
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('login');

  return (
    <AuthProvider>
      <div className="App">
        <AuthContext.Consumer>
          {({ user, organization, login, register, logout, loading }) => {
            if (loading) {
              return <div className="loading">Loading...</div>;
            }

            if (!user && !showAuth) {
              return (
                <LandingPage onGetStarted={() => setShowAuth(true)} />
              );
            }

            if (!user && showAuth) {
              return authMode === 'login' ? (
                <Login
                  onLogin={login}
                  switchToRegister={() => setAuthMode('register')}
                />
              ) : (
                <Register
                  onRegister={register}
                  switchToLogin={() => setAuthMode('login')}
                />
              );
            }

            return <Dashboard user={user} organization={organization} onLogout={logout} />;
          }}
        </AuthContext.Consumer>
      </div>
    </AuthProvider>
  );
};

export default App;