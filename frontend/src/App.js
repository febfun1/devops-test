import React, { useState, useEffect } from 'react';
import './App.css';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// PWA Installation Hook
const usePWAInstall = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const installPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowInstallPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  return { showInstallPrompt, installPWA };
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

  const login = async (emailOrCode, password) => {
    try {
      const response = await axios.post(`${API}/auth/login`, { 
        email_or_code: emailOrCode, 
        password 
      });
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

// Mobile App Install Prompt
const MobileAppPrompt = () => {
  const { showInstallPrompt, installPWA } = usePWAInstall();

  if (!showInstallPrompt) return null;

  return (
    <div className="mobile-app-prompt">
      <div className="prompt-content">
        <div className="prompt-icon">📱</div>
        <div className="prompt-text">
          <h4>Install Timevera App</h4>
          <p>Get the full mobile experience</p>
        </div>
        <button onClick={installPWA} className="install-btn">
          Install
        </button>
      </div>
    </div>
  );
};

// Manual Timesheet Component
const ManualTimesheet = ({ user, organization }) => {
  const [timesheets, setTimesheets] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [timesheetType, setTimesheetType] = useState('daily');
  const [loading, setLoading] = useState(false);
  
  const [timesheetForm, setTimesheetForm] = useState({
    date: new Date().toISOString().split('T')[0],
    start_time: '09:00',
    end_time: '17:00',
    break_duration: '60',
    project_name: '',
    description: '',
    hours_worked: 8
  });

  useEffect(() => {
    loadTimesheets();
  }, []);

  const loadTimesheets = async () => {
    try {
      const response = await axios.get(`${API}/timesheets/user/${user.id}`);
      setTimesheets(response.data);
    } catch (error) {
      console.error('Error loading timesheets:', error);
    }
  };

  const calculateHours = () => {
    const start = new Date(`2000-01-01 ${timesheetForm.start_time}`);
    const end = new Date(`2000-01-01 ${timesheetForm.end_time}`);
    const breakMinutes = parseInt(timesheetForm.break_duration);
    
    const diffMs = end - start;
    const diffHours = diffMs / (1000 * 60 * 60);
    const workHours = Math.max(0, diffHours - (breakMinutes / 60));
    
    setTimesheetForm({ ...timesheetForm, hours_worked: workHours.toFixed(2) });
  };

  useEffect(() => {
    calculateHours();
  }, [timesheetForm.start_time, timesheetForm.end_time, timesheetForm.break_duration]);

  const submitTimesheet = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await axios.post(`${API}/timesheets/submit`, {
        user_id: user.id,
        organization_id: organization.id,
        ...timesheetForm,
        type: timesheetType,
        status: 'pending'
      });
      alert('Timesheet submitted for approval');
      setShowAddForm(false);
      setTimesheetForm({
        date: new Date().toISOString().split('T')[0],
        start_time: '09:00',
        end_time: '17:00',
        break_duration: '60',
        project_name: '',
        description: '',
        hours_worked: 8
      });
      loadTimesheets();
    } catch (error) {
      alert('Failed to submit timesheet');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="manual-timesheet">
      <div className="timesheet-header">
        <div>
          <h3>Manual Timesheet</h3>
          <p className="section-subtitle">Submit your work hours for approval</p>
        </div>
        <button 
          onClick={() => setShowAddForm(true)}
          className="add-timesheet-btn"
        >
          + Add Entry
        </button>
      </div>

      <div className="timesheet-type-selector">
        <label>Entry Type:</label>
        <select value={timesheetType} onChange={(e) => setTimesheetType(e.target.value)}>
          <option value="daily">Daily Entry</option>
          <option value="weekly">Weekly Summary</option>
        </select>
      </div>

      {showAddForm && (
        <div className="modal-overlay">
          <div className="modal large">
            <h4>Add Timesheet Entry</h4>
            <form onSubmit={submitTimesheet}>
              <div className="form-group">
                <label>Date *</label>
                <input
                  type="date"
                  value={timesheetForm.date}
                  onChange={(e) => setTimesheetForm({ ...timesheetForm, date: e.target.value })}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Start Time *</label>
                  <input
                    type="time"
                    value={timesheetForm.start_time}
                    onChange={(e) => setTimesheetForm({ ...timesheetForm, start_time: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>End Time *</label>
                  <input
                    type="time"
                    value={timesheetForm.end_time}
                    onChange={(e) => setTimesheetForm({ ...timesheetForm, end_time: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Break Duration (minutes)</label>
                  <input
                    type="number"
                    value={timesheetForm.break_duration}
                    onChange={(e) => setTimesheetForm({ ...timesheetForm, break_duration: e.target.value })}
                    min="0"
                    max="300"
                  />
                </div>
                <div className="form-group">
                  <label>Total Hours</label>
                  <input
                    type="number"
                    value={timesheetForm.hours_worked}
                    readOnly
                    className="readonly-field"
                    step="0.25"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Project/Task Name</label>
                <input
                  type="text"
                  value={timesheetForm.project_name}
                  onChange={(e) => setTimesheetForm({ ...timesheetForm, project_name: e.target.value })}
                  placeholder="Project or task worked on"
                />
              </div>

              <div className="form-group">
                <label>Work Description *</label>
                <textarea
                  value={timesheetForm.description}
                  onChange={(e) => setTimesheetForm({ ...timesheetForm, description: e.target.value })}
                  required
                  rows="4"
                  placeholder="Describe the work performed during this time..."
                />
              </div>

              <div className="work-summary">
                <h5>Summary</h5>
                <div className="summary-grid">
                  <div className="summary-item">
                    <span>Total Hours:</span>
                    <span>{timesheetForm.hours_worked}</span>
                  </div>
                  <div className="summary-item">
                    <span>Overtime:</span>
                    <span>{timesheetForm.hours_worked > 8 ? (timesheetForm.hours_worked - 8).toFixed(2) : '0.00'}</span>
                  </div>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setShowAddForm(false)}>Cancel</button>
                <button type="submit" disabled={loading}>
                  {loading ? 'Submitting...' : 'Submit for Approval'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="timesheet-list">
        <h4>Recent Submissions</h4>
        <div className="timesheet-table">
          <div className="table-header">
            <div>Date</div>
            <div>Hours</div>
            <div>Project</div>
            <div>Status</div>
            <div>Actions</div>
          </div>
          
          {timesheets.map((timesheet) => (
            <div key={timesheet.id} className="table-row">
              <div>{new Date(timesheet.date).toLocaleDateString()}</div>
              <div>{timesheet.hours_worked}h</div>
              <div>{timesheet.project_name || 'General'}</div>
              <div>
                <span className={`status-badge ${timesheet.status}`}>
                  {timesheet.status}
                </span>
              </div>
              <div>
                {timesheet.status === 'pending' && (
                  <button className="edit-timesheet-btn">Edit</button>
                )}
                <button className="view-timesheet-btn">View</button>
              </div>
            </div>
          ))}
          
          {timesheets.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <h4>No Timesheet Entries</h4>
              <p>Submit your first timesheet entry to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Employee Code Generator
const generateEmployeeCode = () => {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  
  let code = '';
  // 2 letters + 4 numbers
  for (let i = 0; i < 2; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  for (let i = 0; i < 4; i++) {
    code += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }
  
  return code;
};

// Login Component with Employee Code Support
const Login = ({ onLogin, switchToRegister }) => {
  const [formData, setFormData] = useState({ emailOrCode: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loginType, setLoginType] = useState('email');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await onLogin(formData.emailOrCode, formData.password);
    if (!result.success) {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <MobileAppPrompt />
      
      <div className="auth-card">
        <div className="auth-header">
          <h2>Sign In to Your Account</h2>
          <p>Access your workplace dashboard</p>
        </div>
        
        <div className="login-type-selector">
          <button 
            type="button"
            className={loginType === 'email' ? 'active' : ''}
            onClick={() => setLoginType('email')}
          >
            📧 Email
          </button>
          <button 
            type="button"
            className={loginType === 'code' ? 'active' : ''}
            onClick={() => setLoginType('code')}
          >
            🔑 Employee Code
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>
              {loginType === 'email' ? 'Email Address' : 'Employee Code'}
            </label>
            <input
              type={loginType === 'email' ? 'email' : 'text'}
              value={formData.emailOrCode}
              onChange={(e) => setFormData({ ...formData, emailOrCode: e.target.value })}
              required
              placeholder={loginType === 'email' ? 'Enter your email' : 'Enter your employee code (e.g., AB1234)'}
              style={{ textTransform: loginType === 'code' ? 'uppercase' : 'none' }}
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
          <div className="forgot-links">
            <a href="#" className="forgot-link">Forgot password?</a>
            {loginType === 'code' && (
              <a href="#" className="forgot-link">Forgot employee code?</a>
            )}
          </div>
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

// Organization Configuration Component
const WorkforceConfiguration = ({ organization, onUpdate }) => {
  const [config, setConfig] = useState({
    tracking_method: organization?.tracking_method || 'attendance_only',
    payment_structure: organization?.payment_structure || 'monthly_salary',
    ussd_enabled: organization?.ussd_enabled || false,
    ussd_code: organization?.ussd_code || '',
    regional_settings: organization?.regional_settings || 'africa',
    require_timesheets: organization?.require_timesheets || false,
    clock_in_required: organization?.clock_in_required || true,
    overtime_calculation: organization?.overtime_calculation || 'disabled'
  });
  
  const [loading, setLoading] = useState(false);
  const [showUSSDSetup, setShowUSSDSetup] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      await axios.put(`${API}/organizations/${organization.id}/workforce-config`, config);
      alert('Workforce configuration updated successfully');
      onUpdate();
    } catch (error) {
      alert('Failed to update configuration');
    } finally {
      setLoading(false);
    }
  };

  const generateUSSDCode = () => {
    const code = `*${Math.floor(Math.random() * 900) + 100}*${Math.floor(Math.random() * 90) + 10}#`;
    setConfig({ ...config, ussd_code: code });
  };

  return (
    <div className="workforce-configuration">
      <div className="config-header">
        <h3>Workforce Configuration</h3>
        <p className="section-subtitle">Customize Timevera to match your regional and business practices</p>
      </div>

      <div className="config-sections">
        {/* Regional Settings */}
        <div className="config-section">
          <h4>🌍 Regional Business Practices</h4>
          <div className="form-group">
            <label>Primary Business Region</label>
            <select 
              value={config.regional_settings}
              onChange={(e) => setConfig({ ...config, regional_settings: e.target.value })}
            >
              <option value="africa">🌍 Africa (Monthly salary focus)</option>
              <option value="north_america">🇺🇸 North America (Hourly wages common)</option>
              <option value="europe">🇪🇺 Europe (Mixed payment structures)</option>
              <option value="asia_pacific">🌏 Asia Pacific (Varied practices)</option>
              <option value="custom">⚙️ Custom Configuration</option>
            </select>
            <div className="field-hint">
              This helps optimize Timevera for your local business practices
            </div>
          </div>
        </div>

        {/* Payment Structure */}
        <div className="config-section">
          <h4>💰 Payment Structure</h4>
          <div className="payment-options">
            <label className="radio-option">
              <input 
                type="radio" 
                name="payment_structure"
                value="monthly_salary"
                checked={config.payment_structure === 'monthly_salary'}
                onChange={(e) => setConfig({ ...config, payment_structure: e.target.value })}
              />
              <div className="option-content">
                <strong>Monthly Salary</strong>
                <p>Fixed monthly payment, attendance for presence tracking</p>
                <span className="region-tag">Popular in Africa</span>
              </div>
            </label>
            
            <label className="radio-option">
              <input 
                type="radio" 
                name="payment_structure"
                value="hourly_wages"
                checked={config.payment_structure === 'hourly_wages'}
                onChange={(e) => setConfig({ ...config, payment_structure: e.target.value })}
              />
              <div className="option-content">
                <strong>Hourly Wages</strong>
                <p>Payment based on actual hours worked</p>
                <span className="region-tag">Common in Western countries</span>
              </div>
            </label>
            
            <label className="radio-option">
              <input 
                type="radio" 
                name="payment_structure"
                value="mixed"
                checked={config.payment_structure === 'mixed'}
                onChange={(e) => setConfig({ ...config, payment_structure: e.target.value })}
              />
              <div className="option-content">
                <strong>Mixed Structure</strong>
                <p>Some employees salary, others hourly</p>
                <span className="region-tag">Flexible approach</span>
              </div>
            </label>
          </div>
        </div>

        {/* Time Tracking Method */}
        <div className="config-section">
          <h4>⏰ Time Tracking Method</h4>
          <div className="tracking-options">
            <label className="checkbox-option">
              <input 
                type="checkbox"
                checked={config.clock_in_required}
                onChange={(e) => setConfig({ ...config, clock_in_required: e.target.checked })}
              />
              <div className="option-content">
                <strong>Clock In/Out System</strong>
                <p>Real-time attendance tracking with timestamps</p>
              </div>
            </label>
            
            <label className="checkbox-option">
              <input 
                type="checkbox"
                checked={config.require_timesheets}
                onChange={(e) => setConfig({ ...config, require_timesheets: e.target.checked })}
              />
              <div className="option-content">
                <strong>Manual Timesheets</strong>
                <p>Employees submit detailed work hours for approval</p>
              </div>
            </label>
          </div>
          
          <div className="form-group">
            <label>Primary Tracking Method</label>
            <select 
              value={config.tracking_method}
              onChange={(e) => setConfig({ ...config, tracking_method: e.target.value })}
            >
              <option value="attendance_only">📋 Attendance Only (Presence tracking)</option>
              <option value="time_based">⏱️ Time-based (Detailed hour tracking)</option>
              <option value="project_based">📊 Project-based (Task and time tracking)</option>
              <option value="flexible">🔄 Flexible (Employee choice)</option>
            </select>
          </div>
        </div>

        {/* USSD Integration */}
        <div className="config-section">
          <h4>📱 USSD Clock-in (Mobile Accessibility)</h4>
          <div className="ussd-section">
            <label className="checkbox-option">
              <input 
                type="checkbox"
                checked={config.ussd_enabled}
                onChange={(e) => setConfig({ ...config, ussd_enabled: e.target.checked })}
              />
              <div className="option-content">
                <strong>Enable USSD Clock-in</strong>
                <p>Allow employees to clock in using basic phones via USSD codes</p>
                <div className="ussd-benefits">
                  <span className="benefit">✅ Works on any phone</span>
                  <span className="benefit">✅ Perfect for construction sites</span>
                  <span className="benefit">✅ No internet required</span>
                  <span className="benefit">✅ Inclusive for all workers</span>
                </div>
              </div>
            </label>
            
            {config.ussd_enabled && (
              <div className="ussd-setup">
                <div className="form-group">
                  <label>USSD Code for your organization</label>
                  <div className="ussd-code-input">
                    <input 
                      type="text"
                      value={config.ussd_code}
                      onChange={(e) => setConfig({ ...config, ussd_code: e.target.value })}
                      placeholder="*123*45#"
                      className="ussd-input"
                    />
                    <button 
                      type="button"
                      onClick={generateUSSDCode}
                      className="generate-code-btn"
                    >
                      Generate Code
                    </button>
                  </div>
                  <div className="field-hint">
                    Employees will dial this code to clock in/out from any mobile phone
                  </div>
                </div>
                
                <div className="ussd-preview">
                  <h5>📱 How it works for employees:</h5>
                  <div className="ussd-steps">
                    <div className="ussd-step">
                      <span className="step-number">1</span>
                      <span>Dial: <code>{config.ussd_code || '*123*45#'}</code></span>
                    </div>
                    <div className="ussd-step">
                      <span className="step-number">2</span>
                      <span>Enter Employee Code: <code>AB1234</code></span>
                    </div>
                    <div className="ussd-step">
                      <span className="step-number">3</span>
                      <span>Select: 1=Clock In, 2=Clock Out, 3=Break</span>
                    </div>
                    <div className="ussd-step">
                      <span className="step-number">4</span>
                      <span>Receive confirmation SMS</span>
                    </div>
                  </div>
                </div>
                
                <button 
                  onClick={() => setShowUSSDSetup(true)}
                  className="setup-ussd-btn"
                >
                  🔧 Configure USSD Settings
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Overtime Configuration */}
        <div className="config-section">
          <h4>⚡ Overtime & Compliance</h4>
          <div className="form-group">
            <label>Overtime Calculation</label>
            <select 
              value={config.overtime_calculation}
              onChange={(e) => setConfig({ ...config, overtime_calculation: e.target.value })}
            >
              <option value="disabled">❌ Disabled (Salary-based organizations)</option>
              <option value="daily">📅 Daily (Over 8 hours/day)</option>
              <option value="weekly">📊 Weekly (Over 40 hours/week)</option>
              <option value="monthly">📈 Monthly (Over standard hours)</option>
              <option value="custom">⚙️ Custom Rules</option>
            </select>
          </div>
        </div>

        {/* Cultural Adaptations */}
        <div className="config-section">
          <h4>🎭 Cultural Adaptations</h4>
          <div className="cultural-settings">
            <label className="checkbox-option">
              <input type="checkbox" defaultChecked />
              <div className="option-content">
                <strong>Friday Prayer Time (Muslim regions)</strong>
                <p>Automatic break scheduling for religious observance</p>
              </div>
            </label>
            
            <label className="checkbox-option">
              <input type="checkbox" defaultChecked />
              <div className="option-content">
                <strong>Local Holiday Calendar</strong>
                <p>Integrate regional and religious holidays</p>
              </div>
            </label>
            
            <label className="checkbox-option">
              <input type="checkbox" />
              <div className="option-content">
                <strong>Ramadan Work Hours</strong>
                <p>Adjusted schedules during fasting periods</p>
              </div>
            </label>
          </div>
        </div>
      </div>

      <div className="config-actions">
        <button onClick={handleSave} disabled={loading} className="save-config-btn">
          {loading ? '⏳ Saving...' : '💾 Save Configuration'}
        </button>
      </div>

      {/* USSD Setup Modal */}
      {showUSSDSetup && (
        <USSDSetupModal 
          config={config}
          onClose={() => setShowUSSDSetup(false)}
          onSave={(ussdConfig) => {
            setConfig({ ...config, ...ussdConfig });
            setShowUSSDSetup(false);
          }}
        />
      )}
    </div>
  );
};

// USSD Setup Modal
const USSDSetupModal = ({ config, onClose, onSave }) => {
  const [ussdConfig, setUssdConfig] = useState({
    provider: 'africell',
    shortcode: config.ussd_code || '',
    sms_notifications: true,
    supported_languages: ['english', 'french', 'swahili'],
    pricing_model: 'free'
  });

  return (
    <div className="modal-overlay">
      <div className="modal large">
        <h4>🔧 USSD Integration Setup</h4>
        
        <div className="ussd-config-form">
          <div className="form-group">
            <label>Mobile Network Provider</label>
            <select 
              value={ussdConfig.provider}
              onChange={(e) => setUssdConfig({ ...ussdConfig, provider: e.target.value })}
            >
              <option value="africell">Africell</option>
              <option value="mtn">MTN</option>
              <option value="orange">Orange</option>
              <option value="vodacom">Vodacom</option>
              <option value="airtel">Airtel</option>
              <option value="multi_provider">Multiple Providers</option>
            </select>
          </div>

          <div className="form-group">
            <label>USSD Short Code</label>
            <input 
              type="text"
              value={ussdConfig.shortcode}
              onChange={(e) => setUssdConfig({ ...ussdConfig, shortcode: e.target.value })}
              placeholder="*123*45#"
            />
            <div className="field-hint">
              Contact your mobile provider to register this short code
            </div>
          </div>

          <div className="form-group">
            <label>Supported Languages</label>
            <div className="language-checkboxes">
              {['english', 'french', 'swahili', 'arabic', 'portuguese'].map(lang => (
                <label key={lang} className="checkbox-option small">
                  <input 
                    type="checkbox"
                    checked={ussdConfig.supported_languages.includes(lang)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setUssdConfig({
                          ...ussdConfig,
                          supported_languages: [...ussdConfig.supported_languages, lang]
                        });
                      } else {
                        setUssdConfig({
                          ...ussdConfig,
                          supported_languages: ussdConfig.supported_languages.filter(l => l !== lang)
                        });
                      }
                    }}
                  />
                  <span className="capitalize">{lang}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="ussd-testing">
            <h5>📱 Test USSD Integration</h5>
            <p>Before going live, test the USSD flow:</p>
            <div className="test-steps">
              <button className="test-btn">1. Test Connection</button>
              <button className="test-btn">2. Test Clock In</button>
              <button className="test-btn">3. Test SMS Response</button>
            </div>
          </div>

          <div className="pricing-info">
            <h5>💰 USSD Pricing</h5>
            <div className="pricing-tiers">
              <div className="pricing-tier">
                <strong>Basic (Free)</strong>
                <p>Up to 100 USSD transactions/month</p>
              </div>
              <div className="pricing-tier">
                <strong>Standard ($10/month)</strong>
                <p>Up to 1,000 transactions/month</p>
              </div>
              <div className="pricing-tier">
                <strong>Enterprise ($25/month)</strong>
                <p>Unlimited transactions + priority support</p>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button onClick={() => onSave(ussdConfig)} className="save-btn">
            Save USSD Configuration
          </button>
        </div>
      </div>
    </div>
  );
};
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

// Analytics Dashboard Component
const AnalyticsDashboard = ({ organization }) => {
  const [analytics, setAnalytics] = useState({});
  const [selectedMetric, setSelectedMetric] = useState('attendance');
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  useEffect(() => {
    loadAnalytics();
  }, [selectedMetric, dateRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API}/analytics/organization/${organization.id}`, {
        organization_id: organization.id,
        start_date: new Date(dateRange.start).toISOString(),
        end_date: new Date(dateRange.end).toISOString(),
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
    setExportLoading(true);
    try {
      const response = await axios.get(
        `${API}/export/attendance/${organization.id}?start_date=${dateRange.start}&end_date=${dateRange.end}`,
        { responseType: 'blob' }
      );
      
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `timevera_${selectedMetric}_export_${dateRange.start}_${dateRange.end}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('Failed to export data');
    } finally {
      setExportLoading(false);
    }
  };

  const generateReport = async () => {
    try {
      const reportData = {
        organization: organization.name,
        period: `${dateRange.start} to ${dateRange.end}`,
        metrics: analytics,
        generated_at: new Date().toISOString()
      };
      
      const dataStr = JSON.stringify(reportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = window.URL.createObjectURL(dataBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `timevera_analytics_report_${Date.now()}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('Failed to generate report');
    }
  };

  return (
    <div className="analytics-dashboard">
      <div className="analytics-header">
        <div>
          <h3>Analytics & Insights</h3>
          <p className="section-subtitle">Comprehensive business intelligence and reporting</p>
        </div>
        <div className="analytics-actions">
          <button onClick={generateReport} className="report-btn">
            📊 Generate Report
          </button>
          <button 
            onClick={exportData} 
            disabled={exportLoading}
            className="export-btn"
          >
            {exportLoading ? '⏳ Exporting...' : '📤 Export Data'}
          </button>
        </div>
      </div>
      
      <div className="analytics-controls">
        <div className="metric-selector">
          <label>Analysis Type:</label>
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
          >
            <option value="attendance">📅 Attendance Analysis</option>
            <option value="payroll">💰 Payroll Analysis</option>
            <option value="leaves">🏖️ Leave Analysis</option>
            <option value="performance">📈 Performance Metrics</option>
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
      </div>

      {loading ? (
        <div className="analytics-loading">
          <div className="loading-spinner"></div>
          <p>Analyzing data...</p>
        </div>
      ) : (
        <div className="analytics-content">
          {selectedMetric === 'attendance' && analytics.metric_type === 'attendance' && (
            <div className="analytics-section">
              <h4>📊 Attendance Analytics</h4>
              <div className="analytics-grid">
                <div className="analytics-card primary">
                  <div className="card-icon">⏰</div>
                  <div className="card-content">
                    <h4>Total Hours</h4>
                    <div className="analytics-value">{analytics.total_hours?.toFixed(1) || 0}h</div>
                    <div className="analytics-trend">+12% from last period</div>
                  </div>
                </div>
                <div className="analytics-card secondary">
                  <div className="card-icon">📈</div>
                  <div className="card-content">
                    <h4>Overtime Hours</h4>
                    <div className="analytics-value">{analytics.total_overtime?.toFixed(1) || 0}h</div>
                    <div className="analytics-trend">-5% from last period</div>
                  </div>
                </div>
                <div className="analytics-card success">
                  <div className="card-icon">👥</div>
                  <div className="card-content">
                    <h4>Active Employees</h4>
                    <div className="analytics-value">{analytics.unique_employees || 0}</div>
                    <div className="analytics-trend">+2 new hires</div>
                  </div>
                </div>
                <div className="analytics-card info">
                  <div className="card-icon">📊</div>
                  <div className="card-content">
                    <h4>Avg Hours/Employee</h4>
                    <div className="analytics-value">{analytics.average_hours_per_employee?.toFixed(1) || 0}h</div>
                    <div className="analytics-trend">Industry standard: 40h</div>
                  </div>
                </div>
              </div>
              
              <div className="productivity-insights">
                <h5>🎯 Productivity Insights</h5>
                <div className="insights-grid">
                  <div className="insight-item">
                    <span className="insight-label">Peak Productivity Hours:</span>
                    <span className="insight-value">9:00 AM - 11:00 AM</span>
                  </div>
                  <div className="insight-item">
                    <span className="insight-label">Average Late Arrivals:</span>
                    <span className="insight-value">3.2 per week</span>
                  </div>
                  <div className="insight-item">
                    <span className="insight-label">Attendance Rate:</span>
                    <span className="insight-value">94.5%</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {selectedMetric === 'payroll' && analytics.metric_type === 'payroll' && (
            <div className="analytics-section">
              <h4>💰 Payroll Analytics</h4>
              <div className="analytics-grid">
                <div className="analytics-card primary">
                  <div className="card-icon">💵</div>
                  <div className="card-content">
                    <h4>Total Gross Pay</h4>
                    <div className="analytics-value">${analytics.total_gross_pay?.toFixed(2) || 0}</div>
                    <div className="analytics-trend">+8% from last period</div>
                  </div>
                </div>
                <div className="analytics-card secondary">
                  <div className="card-icon">💰</div>
                  <div className="card-content">
                    <h4>Total Net Pay</h4>
                    <div className="analytics-value">${analytics.total_net_pay?.toFixed(2) || 0}</div>
                    <div className="analytics-trend">+7% from last period</div>
                  </div>
                </div>
                <div className="analytics-card warning">
                  <div className="card-icon">📉</div>
                  <div className="card-content">
                    <h4>Total Deductions</h4>
                    <div className="analytics-value">${analytics.total_deductions?.toFixed(2) || 0}</div>
                    <div className="analytics-trend">Tax: 68%, Benefits: 32%</div>
                  </div>
                </div>
                <div className="analytics-card info">
                  <div className="card-icon">📊</div>
                  <div className="card-content">
                    <h4>Payroll Count</h4>
                    <div className="analytics-value">{analytics.number_of_payrolls || 0}</div>
                    <div className="analytics-trend">Processed this period</div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {selectedMetric === 'leaves' && analytics.metric_type === 'leaves' && (
            <div className="analytics-section">
              <h4>🏖️ Leave Analytics</h4>
              <div className="analytics-grid">
                <div className="analytics-card primary">
                  <div className="card-icon">📝</div>
                  <div className="card-content">
                    <h4>Total Requests</h4>
                    <div className="analytics-value">{analytics.total_requests || 0}</div>
                    <div className="analytics-trend">This period</div>
                  </div>
                </div>
                <div className="analytics-card success">
                  <div className="card-icon">✅</div>
                  <div className="card-content">
                    <h4>Approved</h4>
                    <div className="analytics-value">{analytics.approved_requests || 0}</div>
                    <div className="analytics-trend">{analytics.approval_rate?.toFixed(1) || 0}% approval rate</div>
                  </div>
                </div>
                <div className="analytics-card warning">
                  <div className="card-icon">⏳</div>
                  <div className="card-content">
                    <h4>Pending</h4>
                    <div className="analytics-value">{analytics.pending_requests || 0}</div>
                    <div className="analytics-trend">Awaiting approval</div>
                  </div>
                </div>
                <div className="analytics-card danger">
                  <div className="card-icon">❌</div>
                  <div className="card-content">
                    <h4>Rejected</h4>
                    <div className="analytics-value">{analytics.rejected_requests || 0}</div>
                    <div className="analytics-trend">Need attention</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedMetric === 'performance' && (
            <div className="analytics-section">
              <h4>📈 Performance Metrics</h4>
              <div className="analytics-grid">
                <div className="analytics-card primary">
                  <div className="card-icon">⭐</div>
                  <div className="card-content">
                    <h4>Avg Performance</h4>
                    <div className="analytics-value">4.2/5.0</div>
                    <div className="analytics-trend">+0.3 improvement</div>
                  </div>
                </div>
                <div className="analytics-card success">
                  <div className="card-icon">🏆</div>
                  <div className="card-content">
                    <h4>Top Performers</h4>
                    <div className="analytics-value">23%</div>
                    <div className="analytics-trend">Above 4.5 rating</div>
                  </div>
                </div>
                <div className="analytics-card info">
                  <div className="card-icon">📚</div>
                  <div className="card-content">
                    <h4>Training Hours</h4>
                    <div className="analytics-value">156h</div>
                    <div className="analytics-trend">This quarter</div>
                  </div>
                </div>
                <div className="analytics-card secondary">
                  <div className="card-icon">🎯</div>
                  <div className="card-content">
                    <h4>Goals Achieved</h4>
                    <div className="analytics-value">87%</div>
                    <div className="analytics-trend">On track</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Organization Settings Component
const OrganizationSettings = ({ organization, onUpdate }) => {
  const [formData, setFormData] = useState({
    name: organization?.name || '',
    logo_base64: organization?.logo_base64 || '',
    primary_color: organization?.primary_color || '#2DD4BF',
    secondary_color: organization?.secondary_color || '#0F766E',
    address: organization?.address || '',
    phone: organization?.phone || '',
    email: organization?.email || '',
    website: organization?.website || '',
    tax_id: organization?.tax_id || '',
    currency: organization?.currency || 'USD',
    timezone: organization?.timezone || 'UTC'
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        alert('File size must be less than 5MB');
        return;
      }
      
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
      alert('Organization settings updated successfully');
    } catch (error) {
      alert('Failed to update organization settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="organization-settings">
      <div className="settings-header">
        <h3>Organization Settings</h3>
        <p className="section-subtitle">Configure your organization's profile and preferences</p>
      </div>
      
      <div className="settings-tabs">
        <button 
          className={activeTab === 'general' ? 'active' : ''}
          onClick={() => setActiveTab('general')}
        >
          🏢 General
        </button>
        <button 
          className={activeTab === 'branding' ? 'active' : ''}
          onClick={() => setActiveTab('branding')}
        >
          🎨 Branding
        </button>
        <button 
          className={activeTab === 'compliance' ? 'active' : ''}
          onClick={() => setActiveTab('compliance')}
        >
          📋 Compliance
        </button>
        <button 
          className={activeTab === 'integrations' ? 'active' : ''}
          onClick={() => setActiveTab('integrations')}
        >
          🔗 Integrations
        </button>
      </div>

      <form onSubmit={handleSubmit} className="settings-form">
        {activeTab === 'general' && (
          <div className="tab-content">
            <h4>General Information</h4>
            
            <div className="form-group">
              <label>Organization Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="Enter organization name"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="contact@company.com"
                />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Address</label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows="3"
                placeholder="Enter complete address"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Website</label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  placeholder="https://www.company.com"
                />
              </div>
              <div className="form-group">
                <label>Tax ID</label>
                <input
                  type="text"
                  value={formData.tax_id}
                  onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                  placeholder="Tax identification number"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Currency</label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                >
                  <option value="USD">🇺🇸 USD - US Dollar</option>
                  <option value="GBP">🇬🇧 GBP - British Pound</option>
                  <option value="EUR">🇪🇺 EUR - Euro</option>
                  <option value="NGN">🇳🇬 NGN - Nigerian Naira</option>
                </select>
              </div>
              <div className="form-group">
                <label>Timezone</label>
                <select
                  value={formData.timezone}
                  onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                >
                  <option value="UTC">UTC - Coordinated Universal Time</option>
                  <option value="America/New_York">EST - Eastern Standard Time</option>
                  <option value="America/Los_Angeles">PST - Pacific Standard Time</option>
                  <option value="Europe/London">GMT - Greenwich Mean Time</option>
                  <option value="Africa/Lagos">WAT - West Africa Time</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'branding' && (
          <div className="tab-content">
            <h4>Brand Identity</h4>
            
            <div className="form-group">
              <label>Logo Upload</label>
              <div className="logo-upload-area">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  id="logo-upload"
                  className="file-input"
                />
                <label htmlFor="logo-upload" className="upload-label">
                  {formData.logo_base64 ? (
                    <div className="logo-preview">
                      <img src={formData.logo_base64} alt="Logo preview" />
                      <div className="upload-text">Click to change logo</div>
                    </div>
                  ) : (
                    <div className="upload-placeholder">
                      <div className="upload-icon">📎</div>
                      <div className="upload-text">Click to upload logo</div>
                      <div className="upload-hint">PNG, JPG up to 5MB</div>
                    </div>
                  )}
                </label>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Primary Color</label>
                <div className="color-picker">
                  <input
                    type="color"
                    value={formData.primary_color}
                    onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                    className="color-input"
                  />
                  <input
                    type="text"
                    value={formData.primary_color}
                    onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                    className="color-text"
                    placeholder="#2DD4BF"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Secondary Color</label>
                <div className="color-picker">
                  <input
                    type="color"
                    value={formData.secondary_color}
                    onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                    className="color-input"
                  />
                  <input
                    type="text"
                    value={formData.secondary_color}
                    onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                    className="color-text"
                    placeholder="#0F766E"
                  />
                </div>
              </div>
            </div>

            <div className="brand-preview">
              <h5>Brand Preview</h5>
              <div 
                className="preview-card"
                style={{
                  background: `linear-gradient(135deg, ${formData.primary_color}, ${formData.secondary_color})`,
                  color: 'white'
                }}
              >
                <div className="preview-content">
                  <TimeveraLogo size="small" showText={false} />
                  <span style={{ marginLeft: '1rem', fontWeight: '600' }}>
                    {formData.name || 'Organization Name'}
                  </span>
                </div>
                <p>This is how your brand colors will appear</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'compliance' && (
          <div className="tab-content">
            <h4>Compliance & Policies</h4>
            
            <div className="compliance-section">
              <h5>Leave Policies</h5>
              <div className="policy-grid">
                <div className="policy-item">
                  <label>Annual Vacation Days</label>
                  <input type="number" defaultValue="20" min="0" max="50" />
                </div>
                <div className="policy-item">
                  <label>Sick Leave Days</label>
                  <input type="number" defaultValue="10" min="0" max="30" />
                </div>
                <div className="policy-item">
                  <label>Personal Days</label>
                  <input type="number" defaultValue="5" min="0" max="15" />
                </div>
              </div>
            </div>

            <div className="compliance-section">
              <h5>Work Policies</h5>
              <div className="policy-grid">
                <div className="policy-item">
                  <label>Standard Work Hours</label>
                  <input type="number" defaultValue="8" min="6" max="12" />
                </div>
                <div className="policy-item">
                  <label>Overtime Threshold</label>
                  <input type="number" defaultValue="40" min="35" max="50" />
                </div>
                <div className="policy-item">
                  <label>Break Duration (minutes)</label>
                  <input type="number" defaultValue="60" min="30" max="120" />
                </div>
              </div>
            </div>

            <div className="compliance-section">
              <h5>Data Retention</h5>
              <div className="policy-item">
                <label>Employee Record Retention (years)</label>
                <select defaultValue="7">
                  <option value="3">3 years</option>
                  <option value="5">5 years</option>
                  <option value="7">7 years</option>
                  <option value="10">10 years</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'integrations' && (
          <div className="tab-content">
            <h4>Third-party Integrations</h4>
            
            <div className="integrations-grid">
              <div className="integration-card">
                <div className="integration-header">
                  <div className="integration-icon">💳</div>
                  <div>
                    <h5>Stripe Payments</h5>
                    <p>Payment processing for subscriptions</p>
                  </div>
                  <div className="integration-status connected">Connected</div>
                </div>
                <div className="integration-actions">
                  <button className="config-btn">Configure</button>
                </div>
              </div>

              <div className="integration-card">
                <div className="integration-header">
                  <div className="integration-icon">📧</div>
                  <div>
                    <h5>Email Service</h5>
                    <p>Automated email notifications</p>
                  </div>
                  <div className="integration-status available">Available</div>
                </div>
                <div className="integration-actions">
                  <button className="connect-btn">Connect</button>
                </div>
              </div>

              <div className="integration-card">
                <div className="integration-header">
                  <div className="integration-icon">📊</div>
                  <div>
                    <h5>Analytics Tools</h5>
                    <p>Advanced reporting and insights</p>
                  </div>
                  <div className="integration-status available">Available</div>
                </div>
                <div className="integration-actions">
                  <button className="connect-btn">Connect</button>
                </div>
              </div>

              <div className="integration-card">
                <div className="integration-header">
                  <div className="integration-icon">🔐</div>
                  <div>
                    <h5>SSO Integration</h5>
                    <p>Single Sign-On for enterprise</p>
                  </div>
                  <div className="integration-status premium">Premium</div>
                </div>
                <div className="integration-actions">
                  <button className="upgrade-btn">Upgrade</button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="form-actions">
          <button type="submit" disabled={loading} className="save-button">
            {loading ? '⏳ Saving...' : '💾 Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};
// Subscription Plans Component
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
      description: 'Perfect for small teams getting started',
      features: [
        'Up to 25 employees',
        'Basic attendance tracking',
        'Payroll generation',
        'Leave management',
        'Basic reports',
        'Email support',
        'Mobile access'
      ],
      limitations: [
        'No custom branding',
        'Limited integrations',
        'Basic analytics only'
      ]
    },
    premium: {
      name: 'Premium Plan',
      description: 'Most popular for growing businesses',
      popular: true,
      features: [
        'Up to 100 employees',
        'Advanced attendance tracking',
        'Custom branding & logos',
        'Performance tracking',
        'Advanced reports & analytics',
        'API access',
        'Priority support',
        'Leave workflow automation',
        'Department management'
      ]
    },
    enterprise: {
      name: 'Enterprise Plan',
      description: 'Complete solution for large organizations',
      features: [
        'Unlimited employees',
        'White-label solution',
        'Custom integrations',
        'Advanced security & compliance',
        'Audit logs & data export',
        'SSO integration',
        'Dedicated account manager',
        'Custom training & onboarding',
        'SLA guarantee',
        'Advanced workflow automation'
      ]
    }
  };

  if (!pricing || !pricing.basic) {
    return (
      <div className="subscription-loading">
        <div className="loading-spinner"></div>
        <p>Loading subscription plans...</p>
      </div>
    );
  }

  return (
    <div className="subscription-plans">
      <div className="subscription-header">
        <h2>Choose Your Timevera Plan</h2>
        <p className="subscription-subtitle">
          Flexible pricing designed to grow with your business
        </p>
      </div>
      
      <div className="currency-selector">
        <label>Currency:</label>
        <select 
          value={selectedCurrency} 
          onChange={(e) => setSelectedCurrency(e.target.value)}
        >
          <option value="USD">🇺🇸 USD ($)</option>
          <option value="GBP">🇬🇧 GBP (£)</option>
          <option value="EUR">🇪🇺 EUR (€)</option>
          <option value="NGN">🇳🇬 NGN (₦)</option>
        </select>
      </div>

      <div className="plans-grid">
        {Object.entries(tiers).map(([tierKey, tier]) => (
          <div 
            key={tierKey}
            className={`plan-card ${selectedTier === tierKey ? 'selected' : ''} ${tier.popular ? 'popular' : ''}`}
            onClick={() => setSelectedTier(tierKey)}
          >
            {tier.popular && <div className="popular-badge">Most Popular</div>}
            
            <div className="plan-header">
              <h3>{tier.name}</h3>
              <p className="plan-description">{tier.description}</p>
            </div>
            
            <div className="price">
              {pricing[tierKey] && pricing[tierKey][selectedCurrency] ? (
                <>
                  <span className="currency">{pricing[tierKey][selectedCurrency].symbol}</span>
                  <span className="amount">
                    {(pricing[tierKey][selectedCurrency].amount / 100).toFixed(2)}
                  </span>
                  <span className="period">/month</span>
                </>
              ) : (
                <span className="loading-price">Loading...</span>
              )}
            </div>

            <div className="features-section">
              <h4>✅ Included Features</h4>
              <ul className="features">
                {tier.features.map((feature, index) => (
                  <li key={index}>{feature}</li>
                ))}
              </ul>
              
              {tier.limitations && (
                <div className="limitations">
                  <h4>⚠️ Limitations</h4>
                  <ul>
                    {tier.limitations.map((limitation, index) => (
                      <li key={index}>{limitation}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="plan-footer">
              <div className="trial-info">
                <span>🎁 14-day free trial</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="subscription-actions">
        <button 
          onClick={handleSubscribe}
          disabled={loading}
          className="subscribe-button"
        >
          {loading ? '⏳ Processing...' : `🚀 Start ${tiers[selectedTier].name} Trial`}
        </button>
        
        <div className="subscription-features">
          <div className="feature-item">✅ No setup fees</div>
          <div className="feature-item">✅ Cancel anytime</div>
          <div className="feature-item">✅ 24/7 support</div>
          <div className="feature-item">✅ Data migration included</div>
        </div>
      </div>

      <div className="enterprise-contact">
        <h3>Need a custom solution?</h3>
        <p>Contact our enterprise team for volume discounts and custom integrations</p>
        <button className="contact-sales-btn">📞 Contact Sales</button>
      </div>
    </div>
  );
};
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