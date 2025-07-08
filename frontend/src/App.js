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
    if (!organization) return null;
    
    return (
      <div className="organization-branding">
        {organization.logo_base64 && (
          <img src={organization.logo_base64} alt={organization.name} className="org-logo" />
        )}
        <h1 style={{ color: organization.primary_color || '#3b82f6' }}>{organization.name}</h1>
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
              <h3>🚀 LEXA v3.0 - Enterprise Features Available!</h3>
              <div className="features-list">
                <div className="feature-item">✓ Leave Management System</div>
                <div className="feature-item">✓ Employee Management Portal</div>
                <div className="feature-item">✓ Advanced Analytics & Reporting</div>
                <div className="feature-item">✓ Multi-currency Payroll</div>
                <div className="feature-item">✓ Custom Organization Branding</div>
                <div className="feature-item">✓ Real-time Notifications</div>
                <div className="feature-item">✓ Data Export & API Access</div>
              </div>
              <p className="upgrade-message">
                Upgrade to Premium or Enterprise to unlock all features!
              </p>
            </div>
          </div>
        )}
        
        {currentView !== 'dashboard' && (
          <div className="coming-soon">
            <h3>🔧 {currentView.charAt(0).toUpperCase() + currentView.slice(1)} Module</h3>
            <p>This advanced feature is being loaded...</p>
            <p>LEXA v3.0 includes comprehensive {currentView} management with enterprise-grade capabilities.</p>
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