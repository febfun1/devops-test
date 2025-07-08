import React, { useState, useEffect } from 'react';
import './App.css';
import axios from 'axios';
import { loadStripe } from '@stripe/stripe-js';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Initialize Stripe
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

// Auth Context
const AuthContext = React.createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('lexa_user');
    const savedOrg = localStorage.getItem('lexa_organization');
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
      
      localStorage.setItem('lexa_user', JSON.stringify(userData));
      localStorage.setItem('lexa_organization', JSON.stringify(orgData));
      
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
      localStorage.setItem('lexa_user', JSON.stringify(user));
      return { success: true, user };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Registration failed' };
    }
  };

  const logout = () => {
    setUser(null);
    setOrganization(null);
    localStorage.removeItem('lexa_user');
    localStorage.removeItem('lexa_organization');
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

// Notifications Component
const NotificationCenter = ({ user }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    if (user) {
      loadNotifications();
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

  const submitLeaveRequest = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await axios.post(`${API}/leaves/request?user_id=${user.id}`, leaveForm);
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
        <h3>Leave Management</h3>
        {(user.role === 'employee' || user.role === 'manager') && (
          <button 
            onClick={() => setShowRequestForm(true)}
            className="request-leave-btn"
          >
            Request Leave
          </button>
        )}
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
              
              <div className="form-group">
                <label>Reason</label>
                <textarea
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  required
                  rows="3"
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
            <div>{request.user_name || `${user.first_name} ${user.last_name}`}</div>
            <div className="leave-type">{request.leave_type}</div>
            <div>
              {new Date(request.start_date).toLocaleDateString()} - 
              {new Date(request.end_date).toLocaleDateString()}
            </div>
            <div>{request.total_days}</div>
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
                    Approve
                  </button>
                  <button 
                    onClick={() => rejectLeave(request.id)}
                    className="reject-btn"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Employee Management Component
const EmployeeManagement = ({ organization, user }) => {
  const [employees, setEmployees] = useState([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="employee-management">
      <h3>Employee Management</h3>
      
      <div className="employees-grid">
        {employees.map((employee) => (
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
                <p className="employee-id">ID: {employee.employee_id}</p>
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
            </div>
            
            <div className="employee-actions">
              <button onClick={() => editEmployee(employee)} className="edit-btn">
                Edit
              </button>
              <button 
                onClick={() => deactivateEmployee(employee.id)} 
                className="deactivate-btn"
              >
                Deactivate
              </button>
            </div>
          </div>
        ))}
      </div>

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

// Analytics Dashboard Component
const AnalyticsDashboard = ({ organization }) => {
  const [analytics, setAnalytics] = useState({});
  const [selectedMetric, setSelectedMetric] = useState('attendance');
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAnalytics();
  }, [selectedMetric, dateRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API}/analytics/organization/${organization.id}`, {
        organization_id: organization.id,
        start_date: dateRange.start,
        end_date: dateRange.end,
        metric_type: selectedMetric
      });
      setAnalytics(response.data);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportData = async () => {
    try {
      const response = await axios.get(
        `${API}/export/attendance/${organization.id}?start_date=${dateRange.start}&end_date=${dateRange.end}`,
        { responseType: 'blob' }
      );
      
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance_export_${dateRange.start}_${dateRange.end}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('Failed to export data');
    }
  };

  return (
    <div className="analytics-dashboard">
      <h3>Analytics & Reports</h3>
      
      <div className="analytics-controls">
        <div className="metric-selector">
          <label>Metric:</label>
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
          >
            <option value="attendance">Attendance</option>
            <option value="payroll">Payroll</option>
            <option value="leaves">Leave Requests</option>
          </select>
        </div>
        
        <div className="date-range">
          <label>From:</label>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
          />
          <label>To:</label>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
          />
        </div>
        
        <button onClick={exportData} className="export-btn">
          Export Data
        </button>
      </div>

      {loading ? (
        <div>Loading analytics...</div>
      ) : (
        <div className="analytics-content">
          {selectedMetric === 'attendance' && analytics.metric_type === 'attendance' && (
            <div className="analytics-grid">
              <div className="analytics-card">
                <h4>Total Hours</h4>
                <div className="analytics-value">{analytics.total_hours?.toFixed(1)}h</div>
              </div>
              <div className="analytics-card">
                <h4>Overtime Hours</h4>
                <div className="analytics-value">{analytics.total_overtime?.toFixed(1)}h</div>
              </div>
              <div className="analytics-card">
                <h4>Unique Employees</h4>
                <div className="analytics-value">{analytics.unique_employees}</div>
              </div>
              <div className="analytics-card">
                <h4>Avg Hours/Employee</h4>
                <div className="analytics-value">{analytics.average_hours_per_employee?.toFixed(1)}h</div>
              </div>
            </div>
          )}
          
          {selectedMetric === 'payroll' && analytics.metric_type === 'payroll' && (
            <div className="analytics-grid">
              <div className="analytics-card">
                <h4>Total Gross Pay</h4>
                <div className="analytics-value">${analytics.total_gross_pay?.toFixed(2)}</div>
              </div>
              <div className="analytics-card">
                <h4>Total Net Pay</h4>
                <div className="analytics-value">${analytics.total_net_pay?.toFixed(2)}</div>
              </div>
              <div className="analytics-card">
                <h4>Total Deductions</h4>
                <div className="analytics-value">${analytics.total_deductions?.toFixed(2)}</div>
              </div>
              <div className="analytics-card">
                <h4>Number of Payrolls</h4>
                <div className="analytics-value">{analytics.number_of_payrolls}</div>
              </div>
            </div>
          )}
          
          {selectedMetric === 'leaves' && analytics.metric_type === 'leaves' && (
            <div className="analytics-grid">
              <div className="analytics-card">
                <h4>Total Requests</h4>
                <div className="analytics-value">{analytics.total_requests}</div>
              </div>
              <div className="analytics-card">
                <h4>Approved</h4>
                <div className="analytics-value">{analytics.approved_requests}</div>
              </div>
              <div className="analytics-card">
                <h4>Pending</h4>
                <div className="analytics-value">{analytics.pending_requests}</div>
              </div>
              <div className="analytics-card">
                <h4>Approval Rate</h4>
                <div className="analytics-value">{analytics.approval_rate?.toFixed(1)}%</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Continue with existing components...

// Subscription Component
const SubscriptionPlans = ({ organization, onSubscribe }) => {
  const [selectedTier, setSelectedTier] = useState('premium');
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  const [loading, setLoading] = useState(false);
  const [pricing, setPricing] = useState({});

  useEffect(() => {
    loadPricing();
  }, []);

  const loadPricing = async () => {
    try {
      const response = await axios.get(`${API}/subscriptions/pricing`);
      setPricing(response.data);
    } catch (error) {
      console.error('Error loading pricing:', error);
    }
  };

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API}/subscriptions/create-checkout-session`, {
        organization_id: organization.id,
        tier: selectedTier,
        currency: selectedCurrency
      });
      
      window.location.href = response.data.checkout_url;
    } catch (error) {
      alert('Failed to create subscription');
    } finally {
      setLoading(false);
    }
  };

  const tiers = {
    basic: {
      name: 'Basic Plan',
      features: [
        'Up to 25 employees',
        'Basic attendance tracking',
        'Payroll generation',
        'Leave management',
        'Basic reports',
        'Email support'
      ]
    },
    premium: {
      name: 'Premium Plan',
      features: [
        'Up to 100 employees',
        'Advanced attendance tracking',
        'Custom branding & logos',
        'Performance tracking',
        'Advanced reports & analytics',
        'API access',
        'Priority support'
      ]
    },
    enterprise: {
      name: 'Enterprise Plan',
      features: [
        'Unlimited employees',
        'White-label solution',
        'Custom integrations',
        'Advanced security',
        'Audit logs',
        'Data export',
        'Dedicated support'
      ]
    }
  };

  if (!pricing || !pricing.basic) {
    return <div>Loading pricing...</div>;
  }

  return (
    <div className="subscription-plans">
      <h2>Choose Your LEXA Plan</h2>
      
      <div className="currency-selector">
        <label>Currency:</label>
        <select 
          value={selectedCurrency} 
          onChange={(e) => setSelectedCurrency(e.target.value)}
        >
          <option value="USD">USD ($)</option>
          <option value="GBP">GBP (£)</option>
          <option value="EUR">EUR (€)</option>
          <option value="NGN">NGN (₦)</option>
        </select>
      </div>

      <div className="plans-grid">
        {Object.entries(tiers).map(([tierKey, tier]) => (
          <div 
            key={tierKey}
            className={`plan-card ${selectedTier === tierKey ? 'selected' : ''}`}
            onClick={() => setSelectedTier(tierKey)}
          >
            <h3>{tier.name}</h3>
            <div className="price">
              {pricing[tierKey] && pricing[tierKey][selectedCurrency] ? (
                <>
                  <span className="amount">
                    {pricing[tierKey][selectedCurrency].symbol}
                    {(pricing[tierKey][selectedCurrency].amount / 100).toFixed(2)}
                  </span>
                  <span className="period">/month</span>
                </>
              ) : (
                <span>Loading...</span>
              )}
            </div>
            <ul className="features">
              {tier.features.map((feature, index) => (
                <li key={index}>{feature}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <button 
        onClick={handleSubscribe}
        disabled={loading}
        className="subscribe-button"
      >
        {loading ? 'Processing...' : `Subscribe to ${tiers[selectedTier].name}`}
      </button>
    </div>
  );
};

// Organization Settings Component
const OrganizationSettings = ({ organization, onUpdate }) => {
  const [formData, setFormData] = useState({
    name: organization?.name || '',
    logo_base64: organization?.logo_base64 || '',
    primary_color: organization?.primary_color || '#3b82f6',
    secondary_color: organization?.secondary_color || '#1e293b',
    address: organization?.address || '',
    phone: organization?.phone || '',
    email: organization?.email || '',
    website: organization?.website || '',
    tax_id: organization?.tax_id || ''
  });
  const [loading, setLoading] = useState(false);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, logo_base64: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await axios.put(`${API}/organizations/${organization.id}`, formData);
      onUpdate();
      alert('Organization updated successfully');
    } catch (error) {
      alert('Failed to update organization');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="organization-settings">
      <h3>Organization Settings</h3>
      
      <form onSubmit={handleSubmit} className="settings-form">
        <div className="form-group">
          <label>Organization Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>

        <div className="form-group">
          <label>Logo Upload</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
          />
          {formData.logo_base64 && (
            <div className="logo-preview">
              <img src={formData.logo_base64} alt="Logo preview" />
            </div>
          )}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Primary Color</label>
            <input
              type="color"
              value={formData.primary_color}
              onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Secondary Color</label>
            <input
              type="color"
              value={formData.secondary_color}
              onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
            />
          </div>
        </div>

        <div className="form-group">
          <label>Address</label>
          <textarea
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            rows="3"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Website</label>
            <input
              type="url"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Tax ID</label>
            <input
              type="text"
              value={formData.tax_id}
              onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
            />
          </div>
        </div>

        <button type="submit" disabled={loading} className="save-button">
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
};

// Payroll Component
const PayrollManagement = ({ organization, user }) => {
  const [payrollRecords, setPayrollRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generatingPayroll, setGeneratingPayroll] = useState(false);
  const [payPeriod, setPayPeriod] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]
  });

  useEffect(() => {
    loadPayrollRecords();
  }, []);

  const loadPayrollRecords = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/payroll/organization/${organization.id}`);
      setPayrollRecords(response.data);
    } catch (error) {
      console.error('Error loading payroll records:', error);
    } finally {
      setLoading(false);
    }
  };

  const generatePayroll = async () => {
    setGeneratingPayroll(true);
    try {
      await axios.post(`${API}/payroll/generate/${organization.id}?pay_period_start=${payPeriod.start}&pay_period_end=${payPeriod.end}`);
      alert('Payroll generated successfully');
      loadPayrollRecords();
    } catch (error) {
      alert('Failed to generate payroll');
    } finally {
      setGeneratingPayroll(false);
    }
  };

  const downloadPayslip = async (payrollId) => {
    try {
      const response = await axios.post(`${API}/payslip/generate`, {
        payroll_id: payrollId,
        organization_id: organization.id
      }, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payslip_${payrollId}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('Failed to download payslip');
    }
  };

  return (
    <div className="payroll-management">
      <h3>Payroll Management</h3>
      
      <div className="payroll-actions">
        <div className="pay-period">
          <label>Pay Period:</label>
          <input
            type="date"
            value={payPeriod.start}
            onChange={(e) => setPayPeriod({ ...payPeriod, start: e.target.value })}
          />
          <span>to</span>
          <input
            type="date"
            value={payPeriod.end}
            onChange={(e) => setPayPeriod({ ...payPeriod, end: e.target.value })}
          />
          <button
            onClick={generatePayroll}
            disabled={generatingPayroll}
            className="generate-button"
          >
            {generatingPayroll ? 'Generating...' : 'Generate Payroll'}
          </button>
        </div>
      </div>

      <div className="payroll-records">
        {loading ? (
          <div>Loading payroll records...</div>
        ) : (
          <div className="records-table">
            <div className="table-header">
              <div>Employee</div>
              <div>Pay Period</div>
              <div>Total Hours</div>
              <div>Gross Pay</div>
              <div>Net Pay</div>
              <div>Actions</div>
            </div>
            {payrollRecords.map((record) => (
              <div key={record.id} className="table-row">
                <div>{record.user_name}</div>
                <div>
                  {new Date(record.pay_period_start).toLocaleDateString()} - 
                  {new Date(record.pay_period_end).toLocaleDateString()}
                </div>
                <div>{record.total_hours?.toFixed(1)}h</div>
                <div>{record.currency} {record.gross_pay?.toFixed(2)}</div>
                <div>{record.currency} {record.net_pay?.toFixed(2)}</div>
                <div>
                  <button
                    onClick={() => downloadPayslip(record.id)}
                    className="download-button"
                  >
                    Download Payslip
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
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
          <h2>Welcome to LEXA</h2>
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
          <h2>Join LEXA</h2>
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

// Subscription Component
const SubscriptionPlans = ({ organization, onSubscribe }) => {
  const [selectedTier, setSelectedTier] = useState('premium');
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  const [loading, setLoading] = useState(false);
  const [pricing, setPricing] = useState({});

  useEffect(() => {
    loadPricing();
  }, []);

  const loadPricing = async () => {
    try {
      const response = await axios.get(`${API}/subscriptions/pricing`);
      setPricing(response.data);
    } catch (error) {
      console.error('Error loading pricing:', error);
    }
  };

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API}/subscriptions/create-checkout-session`, {
        organization_id: organization.id,
        tier: selectedTier,
        currency: selectedCurrency
      });
      
      window.location.href = response.data.checkout_url;
    } catch (error) {
      alert('Failed to create subscription');
    } finally {
      setLoading(false);
    }
  };

  const tiers = {
    basic: {
      name: 'Basic Plan',
      features: [
        'Up to 25 employees',
        'Basic attendance tracking',
        'Payroll generation',
        'Basic reports',
        'Email support'
      ]
    },
    premium: {
      name: 'Premium Plan',
      features: [
        'Up to 100 employees',
        'Advanced attendance tracking',
        'Custom branding & logos',
        'Advanced reports & analytics',
        'API access',
        'Priority support'
      ]
    },
    enterprise: {
      name: 'Enterprise Plan',
      features: [
        'Unlimited employees',
        'White-label solution',
        'Custom integrations',
        'Advanced security',
        'Dedicated support',
        'Custom features'
      ]
    }
  };

  if (!pricing || !pricing.basic) {
    return <div>Loading pricing...</div>;
  }

  return (
    <div className="subscription-plans">
      <h2>Choose Your LEXA Plan</h2>
      
      <div className="currency-selector">
        <label>Currency:</label>
        <select 
          value={selectedCurrency} 
          onChange={(e) => setSelectedCurrency(e.target.value)}
        >
          <option value="USD">USD ($)</option>
          <option value="GBP">GBP (£)</option>
          <option value="EUR">EUR (€)</option>
          <option value="NGN">NGN (₦)</option>
        </select>
      </div>

      <div className="plans-grid">
        {Object.entries(tiers).map(([tierKey, tier]) => (
          <div 
            key={tierKey}
            className={`plan-card ${selectedTier === tierKey ? 'selected' : ''}`}
            onClick={() => setSelectedTier(tierKey)}
          >
            <h3>{tier.name}</h3>
            <div className="price">
              {pricing[tierKey] && pricing[tierKey][selectedCurrency] ? (
                <>
                  <span className="amount">
                    {pricing[tierKey][selectedCurrency].symbol}
                    {(pricing[tierKey][selectedCurrency].amount / 100).toFixed(2)}
                  </span>
                  <span className="period">/month</span>
                </>
              ) : (
                <span>Loading...</span>
              )}
            </div>
            <ul className="features">
              {tier.features.map((feature, index) => (
                <li key={index}>{feature}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <button 
        onClick={handleSubscribe}
        disabled={loading}
        className="subscribe-button"
      >
        {loading ? 'Processing...' : `Subscribe to ${tiers[selectedTier].name}`}
      </button>
    </div>
  );
};

// Organization Settings Component
const OrganizationSettings = ({ organization, onUpdate }) => {
  const [formData, setFormData] = useState({
    name: organization?.name || '',
    logo_base64: organization?.logo_base64 || '',
    primary_color: organization?.primary_color || '#3b82f6',
    secondary_color: organization?.secondary_color || '#1e293b',
    address: organization?.address || '',
    phone: organization?.phone || '',
    email: organization?.email || '',
    website: organization?.website || '',
    tax_id: organization?.tax_id || ''
  });
  const [loading, setLoading] = useState(false);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, logo_base64: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await axios.put(`${API}/organizations/${organization.id}`, formData);
      onUpdate();
      alert('Organization updated successfully');
    } catch (error) {
      alert('Failed to update organization');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="organization-settings">
      <h3>Organization Settings</h3>
      
      <form onSubmit={handleSubmit} className="settings-form">
        <div className="form-group">
          <label>Organization Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>

        <div className="form-group">
          <label>Logo Upload</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
          />
          {formData.logo_base64 && (
            <div className="logo-preview">
              <img src={formData.logo_base64} alt="Logo preview" />
            </div>
          )}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Primary Color</label>
            <input
              type="color"
              value={formData.primary_color}
              onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Secondary Color</label>
            <input
              type="color"
              value={formData.secondary_color}
              onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
            />
          </div>
        </div>

        <div className="form-group">
          <label>Address</label>
          <textarea
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            rows="3"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Website</label>
            <input
              type="url"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Tax ID</label>
            <input
              type="text"
              value={formData.tax_id}
              onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
            />
          </div>
        </div>

        <button type="submit" disabled={loading} className="save-button">
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
};

// Payroll Component
const PayrollManagement = ({ organization, user }) => {
  const [payrollRecords, setPayrollRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generatingPayroll, setGeneratingPayroll] = useState(false);
  const [payPeriod, setPayPeriod] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]
  });

  useEffect(() => {
    loadPayrollRecords();
  }, []);

  const loadPayrollRecords = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/payroll/organization/${organization.id}`);
      setPayrollRecords(response.data);
    } catch (error) {
      console.error('Error loading payroll records:', error);
    } finally {
      setLoading(false);
    }
  };

  const generatePayroll = async () => {
    setGeneratingPayroll(true);
    try {
      await axios.post(`${API}/payroll/generate/${organization.id}?pay_period_start=${payPeriod.start}&pay_period_end=${payPeriod.end}`);
      alert('Payroll generated successfully');
      loadPayrollRecords();
    } catch (error) {
      alert('Failed to generate payroll');
    } finally {
      setGeneratingPayroll(false);
    }
  };

  const downloadPayslip = async (payrollId) => {
    try {
      const response = await axios.post(`${API}/payslip/generate`, {
        payroll_id: payrollId,
        organization_id: organization.id
      }, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payslip_${payrollId}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('Failed to download payslip');
    }
  };

  return (
    <div className="payroll-management">
      <h3>Payroll Management</h3>
      
      <div className="payroll-actions">
        <div className="pay-period">
          <label>Pay Period:</label>
          <input
            type="date"
            value={payPeriod.start}
            onChange={(e) => setPayPeriod({ ...payPeriod, start: e.target.value })}
          />
          <span>to</span>
          <input
            type="date"
            value={payPeriod.end}
            onChange={(e) => setPayPeriod({ ...payPeriod, end: e.target.value })}
          />
          <button
            onClick={generatePayroll}
            disabled={generatingPayroll}
            className="generate-button"
          >
            {generatingPayroll ? 'Generating...' : 'Generate Payroll'}
          </button>
        </div>
      </div>

      <div className="payroll-records">
        {loading ? (
          <div>Loading payroll records...</div>
        ) : (
          <div className="records-table">
            <div className="table-header">
              <div>Employee</div>
              <div>Pay Period</div>
              <div>Total Hours</div>
              <div>Gross Pay</div>
              <div>Net Pay</div>
              <div>Actions</div>
            </div>
            {payrollRecords.map((record) => (
              <div key={record.id} className="table-row">
                <div>{record.user_name}</div>
                <div>
                  {new Date(record.pay_period_start).toLocaleDateString()} - 
                  {new Date(record.pay_period_end).toLocaleDateString()}
                </div>
                <div>{record.total_hours?.toFixed(1)}h</div>
                <div>{record.currency} {record.gross_pay?.toFixed(2)}</div>
                <div>{record.currency} {record.net_pay?.toFixed(2)}</div>
                <div>
                  <button
                    onClick={() => downloadPayslip(record.id)}
                    className="download-button"
                  >
                    Download Payslip
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
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
          <h2>Welcome to LEXA</h2>
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
          <h2>Join LEXA</h2>
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

// Dashboard Component
const Dashboard = ({ user, organization, onLogout }) => {
  const [currentView, setCurrentView] = useState('dashboard');
  const [dashboardStats, setDashboardStats] = useState(null);
  const [currentAttendance, setCurrentAttendance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [attendanceHistory, setAttendanceHistory] = useState([]);

  useEffect(() => {
    loadDashboardData();
    loadCurrentAttendance();
    loadAttendanceHistory();
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

  const loadAttendanceHistory = async () => {
    try {
      const response = await axios.get(`${API}/attendance/history/${user.id}`);
      setAttendanceHistory(response.data);
    } catch (error) {
      console.error('Error loading attendance history:', error);
    }
  };

  const handleAttendanceAction = async (action, projectName = '', location = '') => {
    setLoading(true);
    try {
      const response = await axios.post(`${API}/attendance/action`, {
        user_id: user.id,
        action,
        project_name: projectName || null,
        location: location || null
      });
      
      // Refresh data
      await loadCurrentAttendance();
      await loadDashboardData();
      await loadAttendanceHistory();
      
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
          {currentAttendance.project_name && (
            <p><strong>Project:</strong> {currentAttendance.project_name}</p>
          )}
          {currentAttendance.location && (
            <p><strong>Location:</strong> {currentAttendance.location}</p>
          )}
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
        <div className="stat-value">{dashboardStats?.leave_balances?.vacation || 0}</div>
        <div className="stat-label">Vacation Days</div>
      </div>
    </div>
  );

  const OrganizationBranding = () => {
    if (!organization) return null;
    
    return (
      <div className="organization-branding">
        {organization.logo_base64 && (
          <img src={organization.logo_base64} alt={organization.name} className="org-logo" />
        )}
        <h1 style={{ color: organization.primary_color }}>{organization.name}</h1>
      </div>
    );
  };

  return (
    <div className="dashboard">
      <nav className="dashboard-nav">
        <div className="nav-brand">
          <OrganizationBranding />
          <span>Powered by LEXA</span>
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
          <NotificationCenter user={user} />
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
          </div>
        )}
        
        {currentView === 'leaves' && (
          <LeaveManagement user={user} organization={organization} />
        )}
        
        {currentView === 'employees' && (
          <EmployeeManagement organization={organization} user={user} />
        )}
        
        {currentView === 'payroll' && (
          <PayrollManagement organization={organization} user={user} />
        )}
        
        {currentView === 'analytics' && (
          <AnalyticsDashboard organization={organization} />
        )}
        
        {currentView === 'settings' && (
          <OrganizationSettings 
            organization={organization} 
            onUpdate={loadDashboardData}
          />
        )}
        
        {currentView === 'subscription' && (
          <SubscriptionPlans 
            organization={organization} 
            onSubscribe={loadDashboardData}
          />
        )}
      </main>
    </div>
  );
};

// Landing Page Component
const LandingPage = ({ onGetStarted }) => {
  return (
    <div className="landing-page">
      <div className="hero-section">
        <div className="hero-content">
          <h1>Welcome to LEXA</h1>
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
    </div>
  );
};

// Landing Page Component
const LandingPage = ({ onGetStarted }) => {
  return (
    <div className="landing-page">
      <div className="hero-section">
        <div className="hero-content">
          <h1>Welcome to LEXA</h1>
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