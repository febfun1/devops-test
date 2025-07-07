import React, { useState, useEffect } from 'react';
import './App.css';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = React.createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('lexa_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API}/auth/login`, { email, password });
      const userData = response.data.user;
      setUser(userData);
      localStorage.setItem('lexa_user', JSON.stringify(userData));
      return { success: true, user: userData };
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
    localStorage.removeItem('lexa_user');
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
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
    hourly_rate: ''
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
const Dashboard = ({ user, onLogout }) => {
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

  const handleAttendanceAction = async (action, projectName = '') => {
    setLoading(true);
    try {
      const response = await axios.post(`${API}/attendance/action`, {
        user_id: user.id,
        action,
        project_name: projectName || null
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
        <h4>Status</h4>
        <div className="stat-value">
          {dashboardStats?.current_status === 'clocked_in' ? '🟢' : 
           dashboardStats?.current_status === 'break' ? '🟡' : '🔴'}
        </div>
        <div className="stat-label">Current</div>
      </div>
    </div>
  );

  const AttendanceHistory = () => (
    <div className="attendance-history">
      <h3>Recent Attendance</h3>
      <div className="history-table">
        <div className="table-header">
          <div>Date</div>
          <div>Clock In</div>
          <div>Clock Out</div>
          <div>Total Hours</div>
          <div>Project</div>
        </div>
        {attendanceHistory.map((record, index) => (
          <div key={index} className="table-row">
            <div>{record.date}</div>
            <div>{record.clock_in ? new Date(record.clock_in).toLocaleTimeString() : '-'}</div>
            <div>{record.clock_out ? new Date(record.clock_out).toLocaleTimeString() : '-'}</div>
            <div>{record.total_hours ? record.total_hours.toFixed(1) + 'h' : '-'}</div>
            <div>{record.project_name || '-'}</div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="dashboard">
      <nav className="dashboard-nav">
        <div className="nav-brand">
          <h1>LEXA</h1>
          <span>HR & Attendance</span>
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
            className={currentView === 'profile' ? 'active' : ''}
            onClick={() => setCurrentView('profile')}
          >
            Profile
          </button>
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
            <div className="dashboard-section">
              <AttendanceHistory />
            </div>
          </div>
        )}
        
        {currentView === 'attendance' && (
          <div className="attendance-view">
            <AttendanceHistory />
          </div>
        )}
        
        {currentView === 'profile' && (
          <div className="profile-view">
            <div className="profile-card">
              <h3>Profile Information</h3>
              <div className="profile-info">
                <p><strong>Name:</strong> {user.first_name} {user.last_name}</p>
                <p><strong>Email:</strong> {user.email}</p>
                <p><strong>Role:</strong> {user.role}</p>
                <p><strong>Department:</strong> {user.department || 'Not specified'}</p>
                <p><strong>Position:</strong> {user.position || 'Not specified'}</p>
                <p><strong>Hourly Rate:</strong> ${user.hourly_rate || 'Not specified'}</p>
              </div>
            </div>
          </div>
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
          <button onClick={onGetStarted} className="cta-button">
            Get Started
          </button>
        </div>
        <div className="hero-image">
          <img 
            src="https://images.unsplash.com/photo-1580982330720-bd5e0fed108b" 
            alt="Modern workplace technology"
          />
        </div>
      </div>
      
      <div className="features-section">
        <h2>Why Choose LEXA?</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">⏰</div>
            <h3>Real-time Attendance</h3>
            <p>Clock in/out with live tracking, break management, and overtime calculation</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">💰</div>
            <h3>Smart Payroll</h3>
            <p>Automated calculations, tax deductions, and pay slip generation</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🎵</div>
            <h3>Multi-Industry</h3>
            <p>Supports musicians, gig workers, schools, and traditional businesses</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📱</div>
            <h3>Cross-Platform</h3>
            <p>Works on desktop, mobile, and kiosk systems</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>Analytics & Reports</h3>
            <p>Comprehensive insights into attendance, payroll, and HR metrics</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🔒</div>
            <h3>Secure & Scalable</h3>
            <p>Enterprise-grade security that scales from 1 to 10,000+ employees</p>
          </div>
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
          {({ user, login, register, logout, loading }) => {
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

            return <Dashboard user={user} onLogout={logout} />;
          }}
        </AuthContext.Consumer>
      </div>
    </AuthProvider>
  );
};

export default App;