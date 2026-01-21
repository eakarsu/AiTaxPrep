import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';

// API Configuration
const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' }
});

// Add auth token to requests
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auth Context
const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

// Auth Provider
function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.get('/auth/me')
        .then(res => setUser(res.data))
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', res.data.token);
    setUser(res.data.user);
    return res.data;
  };

  const register = async (data) => {
    const res = await api.post('/auth/register', data);
    localStorage.setItem('token', res.data.token);
    setUser(res.data.user);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// Protected Route
function ProtectedRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" />;
}

// Layout with Sidebar
function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { path: '/dashboard', icon: '📊', label: 'Dashboard' },
    { path: '/interview', icon: '🎯', label: 'Tax Interview' },
    { path: '/ai-chat', icon: '🤖', label: 'AI Assistant' },
    { path: '/income', icon: '💰', label: 'Income' },
    { path: '/schedule-c', icon: '💼', label: 'Self-Employment' },
    { path: '/deductions', icon: '📝', label: 'Deductions' },
    { path: '/credits', icon: '🎁', label: 'Tax Credits' },
    { path: '/dependents', icon: '👨‍👩‍👧', label: 'Dependents' },
    { path: '/documents', icon: '📁', label: 'Documents' },
    { path: '/scan-document', icon: '📷', label: 'Scan Documents' },
    { path: '/expenses', icon: '💳', label: 'Expenses' },
    { path: '/deduction-finder', icon: '🔍', label: 'Find Deductions' },
    { path: '/calculations', icon: '🧮', label: 'Tax Calculator' },
    { path: '/tax-planning', icon: '📈', label: 'Tax Planning' },
    { path: '/state-returns', icon: '🗺️', label: 'State Returns' },
    { path: '/advice', icon: '💡', label: 'AI Advice' },
    { path: '/forms', icon: '📋', label: 'Tax Forms' },
    { path: '/efile', icon: '📤', label: 'E-File' },
    { path: '/pdf-export', icon: '📄', label: 'PDF Export' },
    { path: '/profile', icon: '⚙️', label: 'Profile' },
  ];

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-icon">AI</div>
          <span className="logo-text">Tax Prep</span>
        </div>
        <nav>
          <ul className="nav-menu">
            {navItems.map(item => (
              <li key={item.path} className="nav-item">
                <Link
                  to={item.path}
                  className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="user-menu">
          <div className="user-info">
            <div className="user-avatar">{user?.firstName?.[0]}{user?.lastName?.[0]}</div>
            <div>
              <div className="user-name">{user?.firstName} {user?.lastName}</div>
              <div className="user-email">{user?.email}</div>
            </div>
          </div>
          <button className="btn btn-secondary" style={{width: '100%', marginTop: '12px'}} onClick={() => { logout(); navigate('/login'); }}>
            Logout
          </button>
        </div>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}

// Login Page
function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="logo" style={{justifyContent: 'center', borderBottom: 'none', marginBottom: '16px'}}>
            <div className="logo-icon">AI</div>
            <span className="logo-text">Tax Prep</span>
          </div>
          <h1 className="auth-title">Welcome back</h1>
          <p className="auth-subtitle">Sign in to continue to your account</p>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" className="form-input" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input type="password" className="form-input" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary" style={{width: '100%'}}>Sign In</button>
        </form>
        <div className="auth-footer">
          Don't have an account? <Link to="/register">Sign up</Link>
        </div>
        <div style={{marginTop: '16px', padding: '12px', background: '#f0f9ff', borderRadius: '8px', fontSize: '13px'}}>
          <strong>Demo Login:</strong><br/>
          Email: john.doe@email.com<br/>
          Password: password123
        </div>
      </div>
    </div>
  );
}

// Register Page
function RegisterPage() {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', phone: '' });
  const [error, setError] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await register(form);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-title">Create Account</h1>
          <p className="auth-subtitle">Start your tax preparation journey</p>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="grid grid-2">
            <div className="form-group">
              <label className="form-label">First Name</label>
              <input type="text" className="form-input" value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} required />
            </div>
            <div className="form-group">
              <label className="form-label">Last Name</label>
              <input type="text" className="form-input" value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})} required />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" className="form-input" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input type="password" className="form-input" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required />
          </div>
          <button type="submit" className="btn btn-primary" style={{width: '100%'}}>Create Account</button>
        </form>
        <div className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}

// Dashboard Page
function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/dashboard/overview')
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading"><div className="spinner"></div></div>;
  if (!data?.hasTaxYear) return (
    <div className="empty-state">
      <div className="empty-icon">📋</div>
      <h3 className="empty-title">No Tax Year Found</h3>
      <p>Create a new tax year to get started</p>
    </div>
  );

  const refundOrOwed = data.taxYear.federalRefund > 0
    ? { amount: data.taxYear.federalRefund, type: 'refund' }
    : { amount: data.taxYear.federalOwed, type: 'owed' };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <span className="badge badge-info">Tax Year {data.taxYear.year}</span>
      </div>

      <div className="grid grid-4">
        <div className="stat-card clickable" onClick={() => navigate('/income')} style={{cursor: 'pointer'}}>
          <div className="stat-label">Total Income</div>
          <div className="stat-value">${data.income.totalIncome.toLocaleString()}</div>
          <div style={{fontSize: '12px', color: 'var(--primary)', marginTop: '8px'}}>Click to view →</div>
        </div>
        <div className="stat-card clickable" onClick={() => navigate('/income')} style={{cursor: 'pointer'}}>
          <div className="stat-label">Tax Withheld</div>
          <div className="stat-value">${data.income.withheld.toLocaleString()}</div>
          <div style={{fontSize: '12px', color: 'var(--primary)', marginTop: '8px'}}>Click to view →</div>
        </div>
        <div className="stat-card clickable" onClick={() => navigate('/deductions')} style={{cursor: 'pointer'}}>
          <div className="stat-label">Deductions</div>
          <div className="stat-value">${data.deductions.total.toLocaleString()}</div>
          <div style={{fontSize: '12px', color: 'var(--primary)', marginTop: '8px'}}>Click to view →</div>
        </div>
        <div className="stat-card clickable" onClick={() => navigate('/calculations')} style={{cursor: 'pointer'}}>
          <div className="stat-label">{refundOrOwed.type === 'refund' ? 'Estimated Refund' : 'Amount Owed'}</div>
          <div className={`stat-value ${refundOrOwed.type === 'refund' ? 'positive' : 'negative'}`}>
            ${refundOrOwed.amount.toLocaleString()}
          </div>
          <div style={{fontSize: '12px', color: 'var(--primary)', marginTop: '8px'}}>Click to view →</div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card clickable" onClick={() => navigate('/calculations')} style={{cursor: 'pointer'}}>
          <div className="card-header">
            <h3 className="card-title">Tax Summary</h3>
            <span style={{fontSize: '12px', color: 'var(--primary)'}}>Click for details →</span>
          </div>
          {data.calculation ? (
            <table className="table">
              <tbody>
                <tr><td>Gross Income</td><td style={{textAlign:'right'}}>${data.calculation.grossIncome.toLocaleString()}</td></tr>
                <tr><td>Taxable Income</td><td style={{textAlign:'right'}}>${data.calculation.taxableIncome.toLocaleString()}</td></tr>
                <tr><td>Federal Tax Liability</td><td style={{textAlign:'right'}}>${data.calculation.federalTaxLiability.toLocaleString()}</td></tr>
                <tr><td>Total Withheld</td><td style={{textAlign:'right'}}>${data.calculation.totalWithheld.toLocaleString()}</td></tr>
              </tbody>
            </table>
          ) : (
            <p style={{color: 'var(--text-light)'}}>Run tax calculation to see summary</p>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Quick Stats</h3>
          </div>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px'}}>
            <div onClick={() => navigate('/income')} style={{textAlign: 'center', padding: '16px', background: 'var(--background)', borderRadius: '8px', cursor: 'pointer', transition: 'transform 0.2s'}} className="quick-stat">
              <div style={{fontSize: '24px', fontWeight: '700'}}>{data.income.sources}</div>
              <div style={{fontSize: '13px', color: 'var(--text-light)'}}>Income Sources</div>
            </div>
            <div onClick={() => navigate('/deductions')} style={{textAlign: 'center', padding: '16px', background: 'var(--background)', borderRadius: '8px', cursor: 'pointer', transition: 'transform 0.2s'}} className="quick-stat">
              <div style={{fontSize: '24px', fontWeight: '700'}}>{data.deductions.count}</div>
              <div style={{fontSize: '13px', color: 'var(--text-light)'}}>Deductions</div>
            </div>
            <div onClick={() => navigate('/credits')} style={{textAlign: 'center', padding: '16px', background: 'var(--background)', borderRadius: '8px', cursor: 'pointer', transition: 'transform 0.2s'}} className="quick-stat">
              <div style={{fontSize: '24px', fontWeight: '700'}}>{data.credits.count}</div>
              <div style={{fontSize: '13px', color: 'var(--text-light)'}}>Tax Credits</div>
            </div>
            <div onClick={() => navigate('/documents')} style={{textAlign: 'center', padding: '16px', background: 'var(--background)', borderRadius: '8px', cursor: 'pointer', transition: 'transform 0.2s'}} className="quick-stat">
              <div style={{fontSize: '24px', fontWeight: '700'}}>{data.documents}</div>
              <div style={{fontSize: '13px', color: 'var(--text-light)'}}>Documents</div>
            </div>
          </div>
        </div>
      </div>

      {data.unreadAdvice > 0 && (
        <div className="alert alert-warning" onClick={() => navigate('/advice')} style={{cursor: 'pointer'}}>
          You have {data.unreadAdvice} new AI tax advice recommendations. <strong>Click to view now →</strong>
        </div>
      )}
    </div>
  );
}

// Income Page
function IncomePage() {
  const [income, setIncome] = useState([]);
  const [taxYears, setTaxYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [form, setForm] = useState({ sourceType: 'W-2', employerName: '', employerEin: '', wages: '', federalTaxWithheld: '', stateTaxWithheld: '' });

  useEffect(() => {
    api.get('/tax-years').then(res => {
      setTaxYears(res.data);
      if (res.data.length > 0) setSelectedYear(res.data[0].id);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedYear) {
      setLoading(true);
      api.get(`/income/tax-year/${selectedYear}`)
        .then(res => setIncome(res.data))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [selectedYear]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/income', { ...form, taxYearId: selectedYear });
      setShowModal(false);
      setForm({ sourceType: 'W-2', employerName: '', employerEin: '', wages: '', federalTaxWithheld: '', stateTaxWithheld: '' });
      const res = await api.get(`/income/tax-year/${selectedYear}`);
      setIncome(res.data);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add income');
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this income source?')) return;
    await api.delete(`/income/${id}`);
    setIncome(income.filter(i => i.id !== id));
    setShowDetailModal(false);
  };

  const handleRowClick = (item) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Income Sources</h1>
        <div style={{display: 'flex', gap: '12px'}}>
          <select className="form-select" style={{width: '150px'}} value={selectedYear || ''} onChange={e => setSelectedYear(e.target.value)}>
            {taxYears.map(ty => <option key={ty.id} value={ty.id}>{ty.year}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Income</button>
        </div>
      </div>

      {loading ? <div className="loading"><div className="spinner"></div></div> : (
        <div className="card">
          {income.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">💰</div>
              <h3 className="empty-title">No Income Sources</h3>
              <p>Add your W-2s, 1099s, and other income</p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Employer/Payer</th>
                  <th>Wages/Income</th>
                  <th>Fed. Withheld</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {income.map(i => (
                  <tr key={i.id} onClick={() => handleRowClick(i)} style={{cursor: 'pointer'}}>
                    <td><span className="badge badge-info">{i.sourceType}</span></td>
                    <td>{i.employerName}</td>
                    <td>${(i.wages + i.otherIncome).toLocaleString()}</td>
                    <td>${i.federalTaxWithheld.toLocaleString()}</td>
                    <td>
                      <button className="btn btn-danger btn-sm" onClick={(e) => handleDelete(i.id, e)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Add Income Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add Income Source</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-select" value={form.sourceType} onChange={e => setForm({...form, sourceType: e.target.value})}>
                  <option value="W-2">W-2 (Employment)</option>
                  <option value="1099-NEC">1099-NEC (Self-Employment)</option>
                  <option value="1099-INT">1099-INT (Interest)</option>
                  <option value="1099-DIV">1099-DIV (Dividends)</option>
                  <option value="1099-MISC">1099-MISC (Other)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Employer/Payer Name</label>
                <input type="text" className="form-input" value={form.employerName} onChange={e => setForm({...form, employerName: e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="form-label">EIN</label>
                <input type="text" className="form-input" placeholder="XX-XXXXXXX" value={form.employerEin} onChange={e => setForm({...form, employerEin: e.target.value})} />
              </div>
              <div className="grid grid-2">
                <div className="form-group">
                  <label className="form-label">Wages/Income</label>
                  <input type="number" step="0.01" className="form-input" value={form.wages} onChange={e => setForm({...form, wages: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Federal Tax Withheld</label>
                  <input type="number" step="0.01" className="form-input" value={form.federalTaxWithheld} onChange={e => setForm({...form, federalTaxWithheld: e.target.value})} />
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{width: '100%'}}>Add Income</button>
            </form>
          </div>
        </div>
      )}

      {/* Income Detail Modal */}
      {showDetailModal && selectedItem && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth: '600px'}}>
            <div className="modal-header">
              <h3 className="modal-title">Income Details</h3>
              <button className="modal-close" onClick={() => setShowDetailModal(false)}>&times;</button>
            </div>
            <div style={{marginBottom: '20px'}}>
              <span className="badge badge-info" style={{fontSize: '14px', padding: '8px 16px'}}>{selectedItem.sourceType}</span>
            </div>
            <table className="table">
              <tbody>
                <tr><td style={{fontWeight: '600'}}>Employer/Payer</td><td>{selectedItem.employerName}</td></tr>
                <tr><td style={{fontWeight: '600'}}>EIN</td><td>{selectedItem.employerEin || 'N/A'}</td></tr>
                <tr><td style={{fontWeight: '600'}}>Wages</td><td style={{color: 'var(--success)', fontWeight: '700'}}>${selectedItem.wages.toLocaleString()}</td></tr>
                <tr><td style={{fontWeight: '600'}}>Other Income</td><td>${selectedItem.otherIncome.toLocaleString()}</td></tr>
                <tr><td style={{fontWeight: '600'}}>Federal Tax Withheld</td><td>${selectedItem.federalTaxWithheld.toLocaleString()}</td></tr>
                <tr><td style={{fontWeight: '600'}}>State Tax Withheld</td><td>${selectedItem.stateTaxWithheld.toLocaleString()}</td></tr>
                <tr><td style={{fontWeight: '600'}}>Social Security Wages</td><td>${selectedItem.socialSecurityWages.toLocaleString()}</td></tr>
                <tr><td style={{fontWeight: '600'}}>Social Security Tax</td><td>${selectedItem.socialSecurityTax.toLocaleString()}</td></tr>
                <tr><td style={{fontWeight: '600'}}>Medicare Wages</td><td>${selectedItem.medicareWages.toLocaleString()}</td></tr>
                <tr><td style={{fontWeight: '600'}}>Medicare Tax</td><td>${selectedItem.medicareTax.toLocaleString()}</td></tr>
                <tr><td style={{fontWeight: '600'}}>Total Income</td><td style={{fontWeight: '700', fontSize: '18px'}}>${(selectedItem.wages + selectedItem.otherIncome).toLocaleString()}</td></tr>
              </tbody>
            </table>
            <div style={{display: 'flex', gap: '12px', marginTop: '20px'}}>
              <button className="btn btn-secondary" style={{flex: 1}} onClick={() => setShowDetailModal(false)}>Close</button>
              <button className="btn btn-danger" style={{flex: 1}} onClick={(e) => handleDelete(selectedItem.id, e)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Deductions Page
function DeductionsPage() {
  const [deductions, setDeductions] = useState([]);
  const [taxYears, setTaxYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [form, setForm] = useState({ category: 'Mortgage Interest', description: '', amount: '', isItemized: true });

  useEffect(() => {
    api.get('/tax-years').then(res => {
      setTaxYears(res.data);
      if (res.data.length > 0) setSelectedYear(res.data[0].id);
    });
  }, []);

  useEffect(() => {
    if (selectedYear) {
      setLoading(true);
      api.get(`/deductions/tax-year/${selectedYear}`)
        .then(res => setDeductions(res.data))
        .finally(() => setLoading(false));
    }
  }, [selectedYear]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await api.post('/deductions', { ...form, taxYearId: selectedYear });
    setShowModal(false);
    const res = await api.get(`/deductions/tax-year/${selectedYear}`);
    setDeductions(res.data);
  };

  const handleDelete = async (id, e) => {
    e && e.stopPropagation();
    if (!window.confirm('Delete this deduction?')) return;
    await api.delete(`/deductions/${id}`);
    setDeductions(deductions.filter(d => d.id !== id));
    setShowDetailModal(false);
  };

  const handleRowClick = (item) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  const total = deductions.reduce((sum, d) => sum + d.amount, 0);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Deductions</h1>
        <div style={{display: 'flex', gap: '12px'}}>
          <select className="form-select" style={{width: '150px'}} value={selectedYear || ''} onChange={e => setSelectedYear(e.target.value)}>
            {taxYears.map(ty => <option key={ty.id} value={ty.id}>{ty.year}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Deduction</button>
        </div>
      </div>

      <div className="card" style={{marginBottom: '20px'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <div>
            <div style={{fontSize: '13px', color: 'var(--text-light)'}}>Total Deductions</div>
            <div style={{fontSize: '28px', fontWeight: '700'}}>${total.toLocaleString()}</div>
          </div>
          <div style={{textAlign: 'right'}}>
            <div style={{fontSize: '13px', color: 'var(--text-light)'}}>Standard Deduction (2024)</div>
            <div style={{fontSize: '18px', fontWeight: '600'}}>$14,600</div>
          </div>
        </div>
      </div>

      {loading ? <div className="loading"><div className="spinner"></div></div> : (
        <div className="card">
          {deductions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📝</div>
              <h3 className="empty-title">No Deductions</h3>
              <p>Add deductions to reduce your taxable income</p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Type</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {deductions.map(d => (
                  <tr key={d.id} onClick={() => handleRowClick(d)} style={{cursor: 'pointer'}}>
                    <td>{d.category}</td>
                    <td>{d.description}</td>
                    <td>${d.amount.toLocaleString()}</td>
                    <td><span className={`badge ${d.isItemized ? 'badge-info' : 'badge-success'}`}>{d.isItemized ? 'Itemized' : 'Above-line'}</span></td>
                    <td><button className="btn btn-danger btn-sm" onClick={(e) => handleDelete(d.id, e)}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Add Deduction Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add Deduction</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                  <option>Mortgage Interest</option>
                  <option>Property Tax</option>
                  <option>State Income Tax</option>
                  <option>Charitable Donations</option>
                  <option>Medical Expenses</option>
                  <option>Student Loan Interest</option>
                  <option>Educator Expenses</option>
                  <option>Home Office</option>
                  <option>Business Expenses</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <input type="text" className="form-input" value={form.description} onChange={e => setForm({...form, description: e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="form-label">Amount</label>
                <input type="number" step="0.01" className="form-input" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} required />
              </div>
              <div className="form-group">
                <label style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                  <input type="checkbox" checked={form.isItemized} onChange={e => setForm({...form, isItemized: e.target.checked})} />
                  Itemized deduction
                </label>
              </div>
              <button type="submit" className="btn btn-primary" style={{width: '100%'}}>Add Deduction</button>
            </form>
          </div>
        </div>
      )}

      {/* Deduction Detail Modal */}
      {showDetailModal && selectedItem && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth: '500px'}}>
            <div className="modal-header">
              <h3 className="modal-title">Deduction Details</h3>
              <button className="modal-close" onClick={() => setShowDetailModal(false)}>&times;</button>
            </div>
            <div style={{marginBottom: '20px'}}>
              <span className={`badge ${selectedItem.isItemized ? 'badge-info' : 'badge-success'}`} style={{fontSize: '14px', padding: '8px 16px'}}>
                {selectedItem.isItemized ? 'Itemized Deduction' : 'Above-the-line Deduction'}
              </span>
            </div>
            <table className="table">
              <tbody>
                <tr><td style={{fontWeight: '600'}}>Category</td><td>{selectedItem.category}</td></tr>
                <tr><td style={{fontWeight: '600'}}>Description</td><td>{selectedItem.description}</td></tr>
                <tr><td style={{fontWeight: '600'}}>Amount</td><td style={{color: 'var(--success)', fontWeight: '700', fontSize: '20px'}}>${selectedItem.amount.toLocaleString()}</td></tr>
                <tr><td style={{fontWeight: '600'}}>Type</td><td>{selectedItem.isItemized ? 'Itemized (Schedule A)' : 'Above-the-line (Form 1040)'}</td></tr>
                <tr><td style={{fontWeight: '600'}}>Receipt</td><td>{selectedItem.receiptPath ? 'Attached' : 'Not attached'}</td></tr>
                <tr><td style={{fontWeight: '600'}}>Added On</td><td>{new Date(selectedItem.createdAt).toLocaleDateString()}</td></tr>
              </tbody>
            </table>
            <div style={{display: 'flex', gap: '12px', marginTop: '20px'}}>
              <button className="btn btn-secondary" style={{flex: 1}} onClick={() => setShowDetailModal(false)}>Close</button>
              <button className="btn btn-danger" style={{flex: 1}} onClick={(e) => handleDelete(selectedItem.id, e)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Tax Credits Page
function CreditsPage() {
  const [credits, setCredits] = useState([]);
  const [taxYears, setTaxYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [form, setForm] = useState({ creditType: 'Child Tax Credit', description: '', amount: '', isRefundable: true });

  useEffect(() => {
    api.get('/tax-years').then(res => {
      setTaxYears(res.data);
      if (res.data.length > 0) setSelectedYear(res.data[0].id);
    });
  }, []);

  useEffect(() => {
    if (selectedYear) {
      setLoading(true);
      api.get(`/credits/tax-year/${selectedYear}`)
        .then(res => setCredits(res.data))
        .finally(() => setLoading(false));
    }
  }, [selectedYear]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await api.post('/credits', { ...form, taxYearId: selectedYear });
    setShowModal(false);
    const res = await api.get(`/credits/tax-year/${selectedYear}`);
    setCredits(res.data);
  };

  const handleDelete = async (id, e) => {
    e && e.stopPropagation();
    if (!window.confirm('Delete this credit?')) return;
    await api.delete(`/credits/${id}`);
    setCredits(credits.filter(c => c.id !== id));
    setShowDetailModal(false);
  };

  const handleRowClick = (item) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  const total = credits.reduce((sum, c) => sum + c.amount, 0);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Tax Credits</h1>
        <div style={{display: 'flex', gap: '12px'}}>
          <select className="form-select" style={{width: '150px'}} value={selectedYear || ''} onChange={e => setSelectedYear(e.target.value)}>
            {taxYears.map(ty => <option key={ty.id} value={ty.id}>{ty.year}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Credit</button>
        </div>
      </div>

      <div className="card" style={{marginBottom: '20px'}}>
        <div style={{fontSize: '13px', color: 'var(--text-light)'}}>Total Tax Credits</div>
        <div style={{fontSize: '28px', fontWeight: '700', color: 'var(--success)'}}>${total.toLocaleString()}</div>
      </div>

      {loading ? <div className="loading"><div className="spinner"></div></div> : (
        <div className="card">
          {credits.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🎁</div>
              <h3 className="empty-title">No Tax Credits</h3>
              <p>Add eligible tax credits to reduce your tax liability</p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Credit Type</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Refundable</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {credits.map(c => (
                  <tr key={c.id} onClick={() => handleRowClick(c)} style={{cursor: 'pointer'}}>
                    <td>{c.creditType}</td>
                    <td>{c.description}</td>
                    <td>${c.amount.toLocaleString()}</td>
                    <td><span className={`badge ${c.isRefundable ? 'badge-success' : 'badge-warning'}`}>{c.isRefundable ? 'Yes' : 'No'}</span></td>
                    <td><button className="btn btn-danger btn-sm" onClick={(e) => handleDelete(c.id, e)}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Add Credit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add Tax Credit</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Credit Type</label>
                <select className="form-select" value={form.creditType} onChange={e => setForm({...form, creditType: e.target.value})}>
                  <option>Child Tax Credit</option>
                  <option>Earned Income Credit</option>
                  <option>Child and Dependent Care</option>
                  <option>American Opportunity Credit</option>
                  <option>Lifetime Learning Credit</option>
                  <option>Retirement Savings Credit</option>
                  <option>Energy Efficient Home Credit</option>
                  <option>Electric Vehicle Credit</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <input type="text" className="form-input" value={form.description} onChange={e => setForm({...form, description: e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="form-label">Amount</label>
                <input type="number" step="0.01" className="form-input" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} required />
              </div>
              <div className="form-group">
                <label style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                  <input type="checkbox" checked={form.isRefundable} onChange={e => setForm({...form, isRefundable: e.target.checked})} />
                  Refundable credit
                </label>
              </div>
              <button type="submit" className="btn btn-primary" style={{width: '100%'}}>Add Credit</button>
            </form>
          </div>
        </div>
      )}

      {/* Credit Detail Modal */}
      {showDetailModal && selectedItem && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth: '500px'}}>
            <div className="modal-header">
              <h3 className="modal-title">Tax Credit Details</h3>
              <button className="modal-close" onClick={() => setShowDetailModal(false)}>&times;</button>
            </div>
            <div style={{marginBottom: '20px'}}>
              <span className={`badge ${selectedItem.isRefundable ? 'badge-success' : 'badge-warning'}`} style={{fontSize: '14px', padding: '8px 16px'}}>
                {selectedItem.isRefundable ? 'Refundable Credit' : 'Non-Refundable Credit'}
              </span>
            </div>
            <table className="table">
              <tbody>
                <tr><td style={{fontWeight: '600'}}>Credit Type</td><td>{selectedItem.creditType}</td></tr>
                <tr><td style={{fontWeight: '600'}}>Description</td><td>{selectedItem.description}</td></tr>
                <tr><td style={{fontWeight: '600'}}>Amount</td><td style={{color: 'var(--success)', fontWeight: '700', fontSize: '20px'}}>${selectedItem.amount.toLocaleString()}</td></tr>
                <tr><td style={{fontWeight: '600'}}>Refundable</td><td>{selectedItem.isRefundable ? 'Yes - Can result in a refund even if you owe no tax' : 'No - Can only reduce tax owed to $0'}</td></tr>
                <tr><td style={{fontWeight: '600'}}>Added On</td><td>{new Date(selectedItem.createdAt).toLocaleDateString()}</td></tr>
              </tbody>
            </table>
            <div style={{display: 'flex', gap: '12px', marginTop: '20px'}}>
              <button className="btn btn-secondary" style={{flex: 1}} onClick={() => setShowDetailModal(false)}>Close</button>
              <button className="btn btn-danger" style={{flex: 1}} onClick={(e) => handleDelete(selectedItem.id, e)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Dependents Page
function DependentsPage() {
  const [dependents, setDependents] = useState([]);
  const [taxYears, setTaxYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', relationship: 'child', dateOfBirth: '', isStudent: false });

  useEffect(() => {
    api.get('/tax-years').then(res => {
      setTaxYears(res.data);
      if (res.data.length > 0) setSelectedYear(res.data[0].id);
    });
  }, []);

  useEffect(() => {
    if (selectedYear) {
      setLoading(true);
      api.get(`/dependents/tax-year/${selectedYear}`)
        .then(res => setDependents(res.data))
        .finally(() => setLoading(false));
    }
  }, [selectedYear]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await api.post('/dependents', { ...form, taxYearId: selectedYear });
    setShowModal(false);
    const res = await api.get(`/dependents/tax-year/${selectedYear}`);
    setDependents(res.data);
  };

  const handleDelete = async (id, e) => {
    e && e.stopPropagation();
    if (!window.confirm('Delete this dependent?')) return;
    await api.delete(`/dependents/${id}`);
    setDependents(dependents.filter(d => d.id !== id));
    setShowDetailModal(false);
  };

  const handleRowClick = (item) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  const getAge = (dob) => {
    const birth = new Date(dob);
    const today = new Date();
    return Math.floor((today - birth) / (365.25 * 24 * 60 * 60 * 1000));
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dependents</h1>
        <div style={{display: 'flex', gap: '12px'}}>
          <select className="form-select" style={{width: '150px'}} value={selectedYear || ''} onChange={e => setSelectedYear(e.target.value)}>
            {taxYears.map(ty => <option key={ty.id} value={ty.id}>{ty.year}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Dependent</button>
        </div>
      </div>

      {loading ? <div className="loading"><div className="spinner"></div></div> : (
        <div className="card">
          {dependents.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👨‍👩‍👧</div>
              <h3 className="empty-title">No Dependents</h3>
              <p>Add dependents to qualify for tax credits</p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Relationship</th>
                  <th>Age</th>
                  <th>Student</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {dependents.map(d => (
                  <tr key={d.id} onClick={() => handleRowClick(d)} style={{cursor: 'pointer'}}>
                    <td>{d.firstName} {d.lastName}</td>
                    <td style={{textTransform: 'capitalize'}}>{d.relationship}</td>
                    <td>{getAge(d.dateOfBirth)} years</td>
                    <td><span className={`badge ${d.isStudent ? 'badge-success' : 'badge-secondary'}`}>{d.isStudent ? 'Yes' : 'No'}</span></td>
                    <td><button className="btn btn-danger btn-sm" onClick={(e) => handleDelete(d.id, e)}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Add Dependent Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add Dependent</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-2">
                <div className="form-group">
                  <label className="form-label">First Name</label>
                  <input type="text" className="form-input" value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name</label>
                  <input type="text" className="form-input" value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})} required />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Relationship</label>
                <select className="form-select" value={form.relationship} onChange={e => setForm({...form, relationship: e.target.value})}>
                  <option value="child">Child</option>
                  <option value="son">Son</option>
                  <option value="daughter">Daughter</option>
                  <option value="parent">Parent</option>
                  <option value="sibling">Sibling</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Date of Birth</label>
                <input type="date" className="form-input" value={form.dateOfBirth} onChange={e => setForm({...form, dateOfBirth: e.target.value})} required />
              </div>
              <div className="form-group">
                <label style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                  <input type="checkbox" checked={form.isStudent} onChange={e => setForm({...form, isStudent: e.target.checked})} />
                  Full-time student
                </label>
              </div>
              <button type="submit" className="btn btn-primary" style={{width: '100%'}}>Add Dependent</button>
            </form>
          </div>
        </div>
      )}

      {/* Dependent Detail Modal */}
      {showDetailModal && selectedItem && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth: '500px'}}>
            <div className="modal-header">
              <h3 className="modal-title">Dependent Details</h3>
              <button className="modal-close" onClick={() => setShowDetailModal(false)}>&times;</button>
            </div>
            <div style={{marginBottom: '20px', textAlign: 'center'}}>
              <div style={{width: '80px', height: '80px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: '700', margin: '0 auto 12px'}}>
                {selectedItem.firstName?.[0]}{selectedItem.lastName?.[0]}
              </div>
              <h2 style={{margin: '0', fontSize: '20px'}}>{selectedItem.firstName} {selectedItem.lastName}</h2>
            </div>
            <table className="table">
              <tbody>
                <tr><td style={{fontWeight: '600'}}>Relationship</td><td style={{textTransform: 'capitalize'}}>{selectedItem.relationship}</td></tr>
                <tr><td style={{fontWeight: '600'}}>Date of Birth</td><td>{new Date(selectedItem.dateOfBirth).toLocaleDateString()}</td></tr>
                <tr><td style={{fontWeight: '600'}}>Age</td><td>{getAge(selectedItem.dateOfBirth)} years old</td></tr>
                <tr><td style={{fontWeight: '600'}}>Full-time Student</td><td><span className={`badge ${selectedItem.isStudent ? 'badge-success' : 'badge-secondary'}`}>{selectedItem.isStudent ? 'Yes' : 'No'}</span></td></tr>
                <tr><td style={{fontWeight: '600'}}>Disabled</td><td><span className={`badge ${selectedItem.isDisabled ? 'badge-warning' : 'badge-secondary'}`}>{selectedItem.isDisabled ? 'Yes' : 'No'}</span></td></tr>
                <tr><td style={{fontWeight: '600'}}>SSN (Last 4)</td><td>{selectedItem.ssn ? `***-**-${selectedItem.ssn.slice(-4)}` : 'Not provided'}</td></tr>
                <tr><td style={{fontWeight: '600'}}>Tax Credit Eligibility</td><td>{getAge(selectedItem.dateOfBirth) < 17 ? <span className="badge badge-success">Eligible for Child Tax Credit</span> : <span className="badge badge-info">Other Dependent Credit</span>}</td></tr>
              </tbody>
            </table>
            <div style={{display: 'flex', gap: '12px', marginTop: '20px'}}>
              <button className="btn btn-secondary" style={{flex: 1}} onClick={() => setShowDetailModal(false)}>Close</button>
              <button className="btn btn-danger" style={{flex: 1}} onClick={(e) => handleDelete(selectedItem.id, e)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Documents Page
function DocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [taxYears, setTaxYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    api.get('/tax-years').then(res => {
      setTaxYears(res.data);
      if (res.data.length > 0) setSelectedYear(res.data[0].id);
    });
  }, []);

  useEffect(() => {
    if (selectedYear) {
      setLoading(true);
      api.get(`/documents/tax-year/${selectedYear}`)
        .then(res => setDocuments(res.data))
        .finally(() => setLoading(false));
    }
  }, [selectedYear]);

  const handleDelete = async (id, e) => {
    e && e.stopPropagation();
    if (!window.confirm('Delete this document?')) return;
    await api.delete(`/documents/${id}`);
    setDocuments(documents.filter(d => d.id !== id));
    setShowDetailModal(false);
  };

  const handleRowClick = (item) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  const getFileIcon = (type) => {
    const icons = {
      'W-2': '📄',
      '1099': '📋',
      'Receipt': '🧾',
      'Form': '📑',
      'Other': '📁'
    };
    return icons[type] || '📁';
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Documents</h1>
        <select className="form-select" style={{width: '150px'}} value={selectedYear || ''} onChange={e => setSelectedYear(e.target.value)}>
          {taxYears.map(ty => <option key={ty.id} value={ty.id}>{ty.year}</option>)}
        </select>
      </div>

      {loading ? <div className="loading"><div className="spinner"></div></div> : (
        <div className="card">
          {documents.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📁</div>
              <h3 className="empty-title">No Documents</h3>
              <p>Upload your tax documents (W-2, 1099, receipts)</p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>File Name</th>
                  <th>Upload Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map(d => (
                  <tr key={d.id} onClick={() => handleRowClick(d)} style={{cursor: 'pointer'}}>
                    <td><span className="badge badge-info">{d.documentType}</span></td>
                    <td>{d.fileName}</td>
                    <td>{new Date(d.uploadDate).toLocaleDateString()}</td>
                    <td><span className={`badge ${d.processed ? 'badge-success' : 'badge-warning'}`}>{d.processed ? 'Processed' : 'Pending'}</span></td>
                    <td><button className="btn btn-danger btn-sm" onClick={(e) => handleDelete(d.id, e)}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Document Detail Modal */}
      {showDetailModal && selectedItem && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth: '550px'}}>
            <div className="modal-header">
              <h3 className="modal-title">Document Details</h3>
              <button className="modal-close" onClick={() => setShowDetailModal(false)}>&times;</button>
            </div>
            <div style={{marginBottom: '20px', textAlign: 'center'}}>
              <div style={{fontSize: '48px', marginBottom: '12px'}}>{getFileIcon(selectedItem.documentType)}</div>
              <h2 style={{margin: '0 0 8px', fontSize: '18px', wordBreak: 'break-all'}}>{selectedItem.fileName}</h2>
              <span className="badge badge-info" style={{fontSize: '14px', padding: '6px 12px'}}>{selectedItem.documentType}</span>
            </div>
            <table className="table">
              <tbody>
                <tr><td style={{fontWeight: '600'}}>Document Type</td><td>{selectedItem.documentType}</td></tr>
                <tr><td style={{fontWeight: '600'}}>File Name</td><td style={{wordBreak: 'break-all'}}>{selectedItem.fileName}</td></tr>
                <tr><td style={{fontWeight: '600'}}>File Size</td><td>{formatFileSize(selectedItem.fileSize)}</td></tr>
                <tr><td style={{fontWeight: '600'}}>Upload Date</td><td>{new Date(selectedItem.uploadDate).toLocaleDateString()} at {new Date(selectedItem.uploadDate).toLocaleTimeString()}</td></tr>
                <tr><td style={{fontWeight: '600'}}>Processing Status</td><td><span className={`badge ${selectedItem.processed ? 'badge-success' : 'badge-warning'}`}>{selectedItem.processed ? 'Processed' : 'Pending Review'}</span></td></tr>
                <tr><td style={{fontWeight: '600'}}>Extracted Data</td><td>{selectedItem.extractedData ? 'Available' : 'Not yet extracted'}</td></tr>
                <tr><td style={{fontWeight: '600'}}>Notes</td><td>{selectedItem.notes || 'No notes'}</td></tr>
              </tbody>
            </table>
            <div style={{display: 'flex', gap: '12px', marginTop: '20px'}}>
              <button className="btn btn-secondary" style={{flex: 1}} onClick={() => setShowDetailModal(false)}>Close</button>
              <button className="btn btn-danger" style={{flex: 1}} onClick={(e) => handleDelete(selectedItem.id, e)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Expenses Page
function ExpensesPage() {
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [taxYears, setTaxYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [form, setForm] = useState({ categoryId: '', description: '', amount: '', expenseDate: '', vendor: '' });

  useEffect(() => {
    Promise.all([
      api.get('/tax-years'),
      api.get('/expenses/categories')
    ]).then(([tyRes, catRes]) => {
      setTaxYears(tyRes.data);
      setCategories(catRes.data);
      if (tyRes.data.length > 0) setSelectedYear(tyRes.data[0].id);
      if (catRes.data.length > 0) setForm(f => ({...f, categoryId: catRes.data[0].id}));
    });
  }, []);

  useEffect(() => {
    if (selectedYear) {
      setLoading(true);
      api.get(`/expenses/tax-year/${selectedYear}`)
        .then(res => setExpenses(res.data))
        .finally(() => setLoading(false));
    }
  }, [selectedYear]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await api.post('/expenses', { ...form, taxYearId: selectedYear });
    setShowModal(false);
    const res = await api.get(`/expenses/tax-year/${selectedYear}`);
    setExpenses(res.data);
  };

  const handleDelete = async (id, e) => {
    e && e.stopPropagation();
    if (!window.confirm('Delete this expense?')) return;
    await api.delete(`/expenses/${id}`);
    setExpenses(expenses.filter(exp => exp.id !== id));
    setShowDetailModal(false);
  };

  const handleRowClick = (item) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Expenses</h1>
        <div style={{display: 'flex', gap: '12px'}}>
          <select className="form-select" style={{width: '150px'}} value={selectedYear || ''} onChange={e => setSelectedYear(e.target.value)}>
            {taxYears.map(ty => <option key={ty.id} value={ty.id}>{ty.year}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Expense</button>
        </div>
      </div>

      <div className="card" style={{marginBottom: '20px'}}>
        <div style={{fontSize: '13px', color: 'var(--text-light)'}}>Total Expenses</div>
        <div style={{fontSize: '28px', fontWeight: '700'}}>${total.toLocaleString()}</div>
      </div>

      {loading ? <div className="loading"><div className="spinner"></div></div> : (
        <div className="card">
          {expenses.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">💳</div>
              <h3 className="empty-title">No Expenses</h3>
              <p>Track your deductible expenses</p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Vendor</th>
                  <th>Amount</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(exp => (
                  <tr key={exp.id} onClick={() => handleRowClick(exp)} style={{cursor: 'pointer'}}>
                    <td>{new Date(exp.expenseDate).toLocaleDateString()}</td>
                    <td>{exp.categoryName}</td>
                    <td>{exp.description}</td>
                    <td>{exp.vendor}</td>
                    <td>${exp.amount.toLocaleString()}</td>
                    <td><button className="btn btn-danger btn-sm" onClick={(e) => handleDelete(exp.id, e)}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Add Expense Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add Expense</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={form.categoryId} onChange={e => setForm({...form, categoryId: e.target.value})}>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <input type="text" className="form-input" value={form.description} onChange={e => setForm({...form, description: e.target.value})} required />
              </div>
              <div className="grid grid-2">
                <div className="form-group">
                  <label className="form-label">Amount</label>
                  <input type="number" step="0.01" className="form-input" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input type="date" className="form-input" value={form.expenseDate} onChange={e => setForm({...form, expenseDate: e.target.value})} required />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Vendor</label>
                <input type="text" className="form-input" value={form.vendor} onChange={e => setForm({...form, vendor: e.target.value})} />
              </div>
              <button type="submit" className="btn btn-primary" style={{width: '100%'}}>Add Expense</button>
            </form>
          </div>
        </div>
      )}

      {/* Expense Detail Modal */}
      {showDetailModal && selectedItem && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth: '500px'}}>
            <div className="modal-header">
              <h3 className="modal-title">Expense Details</h3>
              <button className="modal-close" onClick={() => setShowDetailModal(false)}>&times;</button>
            </div>
            <div style={{marginBottom: '20px'}}>
              <span className="badge badge-info" style={{fontSize: '14px', padding: '8px 16px'}}>{selectedItem.categoryName}</span>
            </div>
            <table className="table">
              <tbody>
                <tr><td style={{fontWeight: '600'}}>Description</td><td>{selectedItem.description}</td></tr>
                <tr><td style={{fontWeight: '600'}}>Amount</td><td style={{color: 'var(--danger)', fontWeight: '700', fontSize: '20px'}}>${selectedItem.amount.toLocaleString()}</td></tr>
                <tr><td style={{fontWeight: '600'}}>Category</td><td>{selectedItem.categoryName}</td></tr>
                <tr><td style={{fontWeight: '600'}}>Vendor</td><td>{selectedItem.vendor || 'Not specified'}</td></tr>
                <tr><td style={{fontWeight: '600'}}>Date</td><td>{new Date(selectedItem.expenseDate).toLocaleDateString()}</td></tr>
                <tr><td style={{fontWeight: '600'}}>Tax Deductible</td><td><span className={`badge ${selectedItem.isDeductible !== false ? 'badge-success' : 'badge-secondary'}`}>{selectedItem.isDeductible !== false ? 'Yes' : 'No'}</span></td></tr>
                <tr><td style={{fontWeight: '600'}}>Receipt</td><td>{selectedItem.receiptPath ? 'Attached' : 'No receipt attached'}</td></tr>
                <tr><td style={{fontWeight: '600'}}>Added On</td><td>{new Date(selectedItem.createdAt).toLocaleDateString()}</td></tr>
              </tbody>
            </table>
            <div style={{display: 'flex', gap: '12px', marginTop: '20px'}}>
              <button className="btn btn-secondary" style={{flex: 1}} onClick={() => setShowDetailModal(false)}>Close</button>
              <button className="btn btn-danger" style={{flex: 1}} onClick={(e) => handleDelete(selectedItem.id, e)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Tax Calculator Page
function CalculationsPage() {
  const [calculation, setCalculation] = useState(null);
  const [taxYears, setTaxYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    api.get('/tax-years').then(res => {
      setTaxYears(res.data);
      if (res.data.length > 0) setSelectedYear(res.data[0].id);
    });
  }, []);

  useEffect(() => {
    if (selectedYear) {
      setLoading(true);
      api.get(`/calculations/tax-year/${selectedYear}`)
        .then(res => setCalculation(res.data))
        .catch(() => setCalculation(null))
        .finally(() => setLoading(false));
    }
  }, [selectedYear]);

  const runCalculation = async () => {
    setCalculating(true);
    try {
      const res = await api.post(`/calculations/tax-year/${selectedYear}/calculate`);
      setCalculation(res.data);
    } catch (err) {
      alert(err.response?.data?.error || 'Calculation failed');
    } finally {
      setCalculating(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Tax Calculator</h1>
        <div style={{display: 'flex', gap: '12px'}}>
          <select className="form-select" style={{width: '150px'}} value={selectedYear || ''} onChange={e => setSelectedYear(e.target.value)}>
            {taxYears.map(ty => <option key={ty.id} value={ty.id}>{ty.year}</option>)}
          </select>
          <button className="btn btn-primary" onClick={runCalculation} disabled={calculating}>
            {calculating ? 'Calculating...' : 'Calculate Taxes'}
          </button>
        </div>
      </div>

      {loading ? <div className="loading"><div className="spinner"></div></div> : !calculation ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">🧮</div>
            <h3 className="empty-title">No Calculation Yet</h3>
            <p>Click "Calculate Taxes" to see your tax summary</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-2">
          <div className="card">
            <h3 className="card-title" style={{marginBottom: '20px'}}>Income Summary</h3>
            <table className="table">
              <tbody>
                <tr><td>Gross Income</td><td style={{textAlign:'right', fontWeight:'600'}}>${calculation.grossIncome?.toLocaleString()}</td></tr>
                <tr><td>Adjusted Gross Income</td><td style={{textAlign:'right', fontWeight:'600'}}>${calculation.adjustedGrossIncome?.toLocaleString()}</td></tr>
                <tr><td>Taxable Income</td><td style={{textAlign:'right', fontWeight:'600'}}>${calculation.taxableIncome?.toLocaleString()}</td></tr>
              </tbody>
            </table>
          </div>

          <div className="card">
            <h3 className="card-title" style={{marginBottom: '20px'}}>Deductions</h3>
            <table className="table">
              <tbody>
                <tr><td>Standard Deduction</td><td style={{textAlign:'right'}}>${calculation.standardDeduction?.toLocaleString()}</td></tr>
                <tr><td>Itemized Deductions</td><td style={{textAlign:'right'}}>${calculation.itemizedDeductions?.toLocaleString()}</td></tr>
                <tr><td>Deduction Used</td><td style={{textAlign:'right'}}><span className="badge badge-info" style={{textTransform:'capitalize'}}>{calculation.deductionUsed}</span></td></tr>
              </tbody>
            </table>
          </div>

          <div className="card">
            <h3 className="card-title" style={{marginBottom: '20px'}}>Tax Liability</h3>
            <table className="table">
              <tbody>
                <tr><td>Federal Tax</td><td style={{textAlign:'right', fontWeight:'600'}}>${calculation.federalTaxLiability?.toLocaleString()}</td></tr>
                <tr><td>Self-Employment Tax</td><td style={{textAlign:'right'}}>${calculation.selfEmploymentTax?.toLocaleString()}</td></tr>
                <tr><td>Total Credits</td><td style={{textAlign:'right', color:'var(--success)'}}>-${calculation.totalCredits?.toLocaleString()}</td></tr>
                <tr><td><strong>Total Tax</strong></td><td style={{textAlign:'right', fontWeight:'700'}}>${calculation.totalTax?.toLocaleString()}</td></tr>
              </tbody>
            </table>
          </div>

          <div className="card">
            <h3 className="card-title" style={{marginBottom: '20px'}}>Result</h3>
            <table className="table">
              <tbody>
                <tr><td>Tax Withheld</td><td style={{textAlign:'right'}}>${calculation.totalTaxWithheld?.toLocaleString()}</td></tr>
                <tr><td>Effective Tax Rate</td><td style={{textAlign:'right'}}>{calculation.effectiveTaxRate}%</td></tr>
              </tbody>
            </table>
            <div style={{marginTop: '20px', padding: '20px', background: calculation.refund > 0 ? '#d1fae5' : '#fee2e2', borderRadius: '8px', textAlign: 'center'}}>
              <div style={{fontSize: '14px', color: calculation.refund > 0 ? '#065f46' : '#991b1b'}}>
                {calculation.refund > 0 ? 'Estimated Refund' : 'Amount Owed'}
              </div>
              <div style={{fontSize: '32px', fontWeight: '700', color: calculation.refund > 0 ? '#065f46' : '#991b1b'}}>
                ${(calculation.refund || calculation.amountOwed || 0).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// AI Advice Page
function AdvicePage() {
  const [advice, setAdvice] = useState([]);
  const [taxYears, setTaxYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [auditRisk, setAuditRisk] = useState(null);
  const [analyzingRisk, setAnalyzingRisk] = useState(false);

  useEffect(() => {
    api.get('/tax-years').then(res => {
      setTaxYears(res.data);
      if (res.data.length > 0) setSelectedYear(res.data[0].id);
    });
  }, []);

  useEffect(() => {
    if (selectedYear) {
      setLoading(true);
      api.get(`/advice/tax-year/${selectedYear}`)
        .then(res => setAdvice(res.data))
        .finally(() => setLoading(false));
    }
  }, [selectedYear]);

  const generateAdvice = async () => {
    setGenerating(true);
    try {
      // Use AI-powered advice generation
      await api.post(`/ai/tax-year/${selectedYear}/generate-advice`);
      const res = await api.get(`/advice/tax-year/${selectedYear}`);
      setAdvice(res.data);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to generate AI advice');
    } finally {
      setGenerating(false);
    }
  };

  const analyzeAuditRisk = async () => {
    setAnalyzingRisk(true);
    try {
      const res = await api.post('/ai/audit-risk', { taxYearId: selectedYear });
      setAuditRisk(res.data);
    } catch (err) {
      alert('Failed to analyze audit risk');
    } finally {
      setAnalyzingRisk(false);
    }
  };

  const totalSavings = advice.reduce((sum, a) => sum + (a.potentialSavings || 0), 0);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">AI Tax Advice</h1>
        <div style={{display: 'flex', gap: '12px'}}>
          <select className="form-select" style={{width: '150px'}} value={selectedYear || ''} onChange={e => setSelectedYear(e.target.value)}>
            {taxYears.map(ty => <option key={ty.id} value={ty.id}>{ty.year}</option>)}
          </select>
          <button className="btn btn-secondary" onClick={analyzeAuditRisk} disabled={analyzingRisk}>
            {analyzingRisk ? 'Analyzing...' : 'Audit Risk'}
          </button>
          <button className="btn btn-primary" onClick={generateAdvice} disabled={generating}>
            {generating ? 'AI Analyzing...' : 'Generate AI Advice'}
          </button>
        </div>
      </div>

      {/* Audit Risk Card */}
      {auditRisk && (
        <div className="card" style={{marginBottom: '20px'}}>
          <h3 className="card-title" style={{marginBottom: '16px'}}>Audit Risk Analysis</h3>
          <div style={{display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '16px'}}>
            <div style={{
              width: '100px', height: '100px', borderRadius: '50%',
              background: auditRisk.overallRisk === 'low' ? '#d1fae5' : auditRisk.overallRisk === 'medium' ? '#fef3c7' : '#fee2e2',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
            }}>
              <div style={{fontSize: '24px', fontWeight: '700', color: auditRisk.overallRisk === 'low' ? '#065f46' : auditRisk.overallRisk === 'medium' ? '#92400e' : '#991b1b'}}>
                {auditRisk.riskScore}
              </div>
              <div style={{fontSize: '11px', textTransform: 'uppercase', color: auditRisk.overallRisk === 'low' ? '#065f46' : auditRisk.overallRisk === 'medium' ? '#92400e' : '#991b1b'}}>
                {auditRisk.overallRisk} risk
              </div>
            </div>
            <div style={{flex: 1}}>
              {auditRisk.riskFactors?.slice(0, 3).map((f, i) => (
                <div key={i} style={{marginBottom: '8px', padding: '8px', background: 'var(--background)', borderRadius: '6px'}}>
                  <strong>{f.factor}</strong>: {f.description}
                </div>
              ))}
            </div>
          </div>
          {auditRisk.positiveFactors?.length > 0 && (
            <div style={{padding: '12px', background: '#d1fae5', borderRadius: '8px'}}>
              <strong style={{color: '#065f46'}}>Positive factors:</strong> {auditRisk.positiveFactors.join(', ')}
            </div>
          )}
        </div>
      )}

      {advice.length > 0 && (
        <div className="card" style={{marginBottom: '20px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <div>
              <div style={{fontSize: '13px', color: 'var(--text-light)'}}>Total Potential Savings</div>
              <div style={{fontSize: '28px', fontWeight: '700', color: 'var(--success)'}}>${totalSavings.toLocaleString()}</div>
            </div>
            <div style={{textAlign: 'right'}}>
              <div style={{fontSize: '24px', fontWeight: '700'}}>{advice.length}</div>
              <div style={{fontSize: '13px', color: 'var(--text-light)'}}>AI Recommendations</div>
            </div>
          </div>
        </div>
      )}

      {loading ? <div className="loading"><div className="spinner"></div></div> : advice.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">🤖</div>
            <h3 className="empty-title">No AI Advice Yet</h3>
            <p>Click "Generate AI Advice" to get personalized tax recommendations powered by AI</p>
          </div>
        </div>
      ) : (
        <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
          {advice.map(a => (
            <div key={a.id} className={`card advice-card ${a.priority}`}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
                <div>
                  <span className={`badge badge-${a.priority === 'high' ? 'danger' : a.priority === 'medium' ? 'warning' : 'success'}`} style={{marginRight: '8px'}}>
                    {a.priority} priority
                  </span>
                  <span className="badge badge-info">{a.adviceType}</span>
                </div>
                <div style={{fontSize: '18px', fontWeight: '700', color: 'var(--success)'}}>
                  +${(a.potentialSavings || 0).toLocaleString()}
                </div>
              </div>
              <h3 style={{fontSize: '16px', fontWeight: '600', marginBottom: '8px'}}>{a.title}</h3>
              <p style={{color: 'var(--text-light)', lineHeight: '1.6', marginBottom: '12px'}}>{a.adviceText}</p>
              {a.actionItems && a.actionItems.length > 0 && (
                <div style={{background: 'var(--background)', padding: '12px', borderRadius: '8px'}}>
                  <strong style={{fontSize: '13px'}}>Action Items:</strong>
                  <ul style={{margin: '8px 0 0', paddingLeft: '20px'}}>
                    {(typeof a.actionItems === 'string' ? JSON.parse(a.actionItems) : a.actionItems).map((item, i) => (
                      <li key={i} style={{marginBottom: '4px', color: 'var(--text-light)', fontSize: '14px'}}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Tax Forms Page
function FormsPage() {
  const [forms, setForms] = useState([]);
  const [taxYears, setTaxYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    api.get('/tax-years').then(res => {
      setTaxYears(res.data);
      if (res.data.length > 0) setSelectedYear(res.data[0].id);
    });
  }, []);

  useEffect(() => {
    if (selectedYear) {
      setLoading(true);
      api.get(`/forms/tax-year/${selectedYear}`)
        .then(res => setForms(res.data))
        .finally(() => setLoading(false));
    }
  }, [selectedYear]);

  const generateForm1040 = async () => {
    setGenerating(true);
    try {
      await api.post(`/forms/tax-year/${selectedYear}/generate-1040`);
      const res = await api.get(`/forms/tax-year/${selectedYear}`);
      setForms(res.data);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to generate form');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Tax Forms</h1>
        <div style={{display: 'flex', gap: '12px'}}>
          <select className="form-select" style={{width: '150px'}} value={selectedYear || ''} onChange={e => setSelectedYear(e.target.value)}>
            {taxYears.map(ty => <option key={ty.id} value={ty.id}>{ty.year}</option>)}
          </select>
          <button className="btn btn-primary" onClick={generateForm1040} disabled={generating}>
            {generating ? 'Generating...' : 'Generate Form 1040'}
          </button>
        </div>
      </div>

      {loading ? <div className="loading"><div className="spinner"></div></div> : forms.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3 className="empty-title">No Forms Generated</h3>
            <p>Click "Generate Form 1040" to create your tax return</p>
          </div>
        </div>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Form</th>
                <th>Status</th>
                <th>Generated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {forms.map(f => (
                <tr key={f.id}>
                  <td><strong>Form {f.formType}</strong></td>
                  <td><span className={`badge badge-${f.status === 'submitted' ? 'success' : f.status === 'completed' ? 'info' : 'warning'}`}>{f.status}</span></td>
                  <td>{f.generatedAt ? new Date(f.generatedAt).toLocaleDateString() : '-'}</td>
                  <td>
                    <button className="btn btn-secondary btn-sm">View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Profile Page
function ProfilePage() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    phone: user?.phone || '',
    filingStatus: user?.filingStatus || 'single',
    addressStreet: user?.address?.street || '',
    addressCity: user?.address?.city || '',
    addressState: user?.address?.state || '',
    addressZip: user?.address?.zip || ''
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put('/users/profile', form);
      setUser(res.data.user);
      setMessage('Profile updated successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Profile Settings</h1>
      </div>

      {message && <div className={`alert ${message.includes('success') ? 'alert-success' : 'alert-error'}`}>{message}</div>}

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-2">
            <div className="form-group">
              <label className="form-label">First Name</label>
              <input type="text" className="form-input" value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Last Name</label>
              <input type="text" className="form-input" value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})} />
            </div>
          </div>

          <div className="grid grid-2">
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input type="tel" className="form-input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Filing Status</label>
              <select className="form-select" value={form.filingStatus} onChange={e => setForm({...form, filingStatus: e.target.value})}>
                <option value="single">Single</option>
                <option value="married_filing_jointly">Married Filing Jointly</option>
                <option value="married_filing_separately">Married Filing Separately</option>
                <option value="head_of_household">Head of Household</option>
                <option value="qualifying_widow">Qualifying Widow(er)</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Street Address</label>
            <input type="text" className="form-input" value={form.addressStreet} onChange={e => setForm({...form, addressStreet: e.target.value})} />
          </div>

          <div className="grid grid-3">
            <div className="form-group">
              <label className="form-label">City</label>
              <input type="text" className="form-input" value={form.addressCity} onChange={e => setForm({...form, addressCity: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">State</label>
              <input type="text" className="form-input" value={form.addressState} onChange={e => setForm({...form, addressState: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">ZIP Code</label>
              <input type="text" className="form-input" value={form.addressZip} onChange={e => setForm({...form, addressZip: e.target.value})} />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}

// AI Chat Assistant Page
function AIChatPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [taxYears, setTaxYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);

  useEffect(() => {
    api.get('/tax-years').then(res => {
      setTaxYears(res.data);
      if (res.data.length > 0) setSelectedYear(res.data[0].id);
    });
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await api.post('/ai/chat', {
        messages: newMessages,
        taxYearId: selectedYear
      });
      setMessages([...newMessages, { role: 'assistant', content: res.data.response }]);
    } catch (err) {
      setMessages([...newMessages, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const quickQuestions = [
    "What deductions am I missing?",
    "How can I reduce my tax liability?",
    "Explain the difference between tax credits and deductions",
    "What is my estimated tax refund?",
    "Should I itemize or take the standard deduction?"
  ];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">AI Tax Assistant</h1>
        <select className="form-select" style={{width: '150px'}} value={selectedYear || ''} onChange={e => setSelectedYear(e.target.value)}>
          {taxYears.map(ty => <option key={ty.id} value={ty.id}>{ty.year}</option>)}
        </select>
      </div>

      <div className="card" style={{height: 'calc(100vh - 250px)', display: 'flex', flexDirection: 'column'}}>
        <div style={{flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px'}}>
          {messages.length === 0 ? (
            <div style={{textAlign: 'center', padding: '40px'}}>
              <div style={{fontSize: '48px', marginBottom: '16px'}}>🤖</div>
              <h3 style={{marginBottom: '8px'}}>AI Tax Assistant</h3>
              <p style={{color: 'var(--text-light)', marginBottom: '24px'}}>Ask me anything about your taxes!</p>
              <div style={{display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center'}}>
                {quickQuestions.map((q, i) => (
                  <button key={i} className="btn btn-secondary btn-sm" onClick={() => setInput(q)}>{q}</button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
                padding: '12px 16px',
                borderRadius: '16px',
                background: msg.role === 'user' ? 'var(--primary)' : 'var(--background)',
                color: msg.role === 'user' ? 'white' : 'inherit'
              }}>
                {msg.content}
              </div>
            ))
          )}
          {loading && (
            <div style={{alignSelf: 'flex-start', padding: '12px 16px', background: 'var(--background)', borderRadius: '16px'}}>
              <div className="spinner" style={{width: '20px', height: '20px'}}></div>
            </div>
          )}
        </div>

        <div style={{borderTop: '1px solid var(--border)', padding: '16px', display: 'flex', gap: '12px'}}>
          <input
            type="text"
            className="form-input"
            placeholder="Ask a tax question..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && sendMessage()}
            disabled={loading}
          />
          <button className="btn btn-primary" onClick={sendMessage} disabled={loading || !input.trim()}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

// Document Scanner Page
function ScanDocumentPage() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [documentType, setDocumentType] = useState('W-2');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [taxYears, setTaxYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    api.get('/tax-years').then(res => {
      setTaxYears(res.data);
      if (res.data.length > 0) setSelectedYear(res.data[0].id);
    });
  }, []);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (f) {
      setFile(f);
      setPreview(URL.createObjectURL(f));
      setResult(null);
    }
  };

  const scanDocument = async () => {
    if (!file) return;
    setScanning(true);
    setResult(null);

    const formData = new FormData();
    formData.append('document', file);
    formData.append('documentType', documentType);

    try {
      const res = await api.post('/ai/scan-document', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setResult(res.data);
    } catch (err) {
      alert('Failed to scan document. Please try again.');
    } finally {
      setScanning(false);
    }
  };

  const importData = async () => {
    if (!result?.extractedData || !selectedYear) return;
    setImporting(true);

    try {
      await api.post('/ai/import-scanned-data', {
        documentType,
        data: result.extractedData,
        taxYearId: selectedYear
      });
      alert('Data imported successfully!');
      setFile(null);
      setPreview(null);
      setResult(null);
    } catch (err) {
      alert('Failed to import data. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Scan Tax Documents</h1>
        <select className="form-select" style={{width: '150px'}} value={selectedYear || ''} onChange={e => setSelectedYear(e.target.value)}>
          {taxYears.map(ty => <option key={ty.id} value={ty.id}>{ty.year}</option>)}
        </select>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3 className="card-title" style={{marginBottom: '20px'}}>Upload Document</h3>

          <div className="form-group">
            <label className="form-label">Document Type</label>
            <select className="form-select" value={documentType} onChange={e => setDocumentType(e.target.value)}>
              <option value="W-2">W-2 (Employment)</option>
              <option value="1099-NEC">1099-NEC (Self-Employment)</option>
              <option value="1099-INT">1099-INT (Interest)</option>
              <option value="1099-DIV">1099-DIV (Dividends)</option>
              <option value="Receipt">Receipt/Expense</option>
            </select>
          </div>

          <div
            style={{
              border: '2px dashed var(--border)',
              borderRadius: '12px',
              padding: '40px',
              textAlign: 'center',
              marginBottom: '20px',
              cursor: 'pointer',
              background: preview ? 'transparent' : 'var(--background)'
            }}
            onClick={() => document.getElementById('fileInput').click()}
          >
            {preview ? (
              <img src={preview} alt="Preview" style={{maxWidth: '100%', maxHeight: '300px', borderRadius: '8px'}} />
            ) : (
              <>
                <div style={{fontSize: '48px', marginBottom: '12px'}}>📷</div>
                <p>Click to upload or drag & drop</p>
                <p style={{color: 'var(--text-light)', fontSize: '13px'}}>Supports: JPG, PNG, PDF</p>
              </>
            )}
          </div>
          <input type="file" id="fileInput" accept="image/*,.pdf" style={{display: 'none'}} onChange={handleFileChange} />

          <button className="btn btn-primary" style={{width: '100%'}} onClick={scanDocument} disabled={!file || scanning}>
            {scanning ? 'Scanning with AI...' : 'Scan Document'}
          </button>
        </div>

        <div className="card">
          <h3 className="card-title" style={{marginBottom: '20px'}}>Extracted Data</h3>

          {!result ? (
            <div className="empty-state">
              <div className="empty-icon">🔍</div>
              <h3 className="empty-title">No Data Yet</h3>
              <p>Upload and scan a document to extract data</p>
            </div>
          ) : result.extractedData?.error ? (
            <div className="alert alert-error">{result.extractedData.error}</div>
          ) : (
            <>
              <div style={{marginBottom: '16px'}}>
                <span className={`badge ${result.extractedData?.confidence === 'high' ? 'badge-success' : result.extractedData?.confidence === 'medium' ? 'badge-warning' : 'badge-danger'}`}>
                  {result.extractedData?.confidence || 'unknown'} confidence
                </span>
              </div>

              <table className="table">
                <tbody>
                  {Object.entries(result.extractedData || {}).filter(([k]) => k !== 'confidence').map(([key, value]) => (
                    <tr key={key}>
                      <td style={{fontWeight: '600', textTransform: 'capitalize'}}>{key.replace(/([A-Z])/g, ' $1')}</td>
                      <td>{typeof value === 'number' ? `$${value.toLocaleString()}` : String(value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <button className="btn btn-success" style={{width: '100%', marginTop: '20px'}} onClick={importData} disabled={importing}>
                {importing ? 'Importing...' : 'Import to Tax Return'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Deduction Finder Page
function DeductionFinderPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [taxYears, setTaxYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [additionalInfo, setAdditionalInfo] = useState({
    isHomeowner: false,
    worksFromHome: false,
    hasStudentLoans: false,
    madeCharitableDonations: false,
    hasMedicalExpenses: false,
    paidForEducation: false
  });

  useEffect(() => {
    api.get('/tax-years').then(res => {
      setTaxYears(res.data);
      if (res.data.length > 0) setSelectedYear(res.data[0].id);
    });
  }, []);

  const findDeductions = async () => {
    if (!selectedYear) return;
    setLoading(true);
    setResult(null);

    try {
      const res = await api.post('/ai/find-deductions', {
        taxYearId: selectedYear,
        additionalInfo
      });
      setResult(res.data);
    } catch (err) {
      alert('Failed to analyze deductions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">AI Deduction Finder</h1>
        <select className="form-select" style={{width: '150px'}} value={selectedYear || ''} onChange={e => setSelectedYear(e.target.value)}>
          {taxYears.map(ty => <option key={ty.id} value={ty.id}>{ty.year}</option>)}
        </select>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3 className="card-title" style={{marginBottom: '20px'}}>Your Situation</h3>
          <p style={{color: 'var(--text-light)', marginBottom: '20px'}}>Help us find more deductions by telling us about your situation:</p>

          <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
            {[
              { key: 'isHomeowner', label: 'I own my home (mortgage interest, property tax)' },
              { key: 'worksFromHome', label: 'I work from home (home office deduction)' },
              { key: 'hasStudentLoans', label: 'I have student loans (interest deduction)' },
              { key: 'madeCharitableDonations', label: 'I made charitable donations' },
              { key: 'hasMedicalExpenses', label: 'I have significant medical expenses' },
              { key: 'paidForEducation', label: 'I paid for education (self or dependents)' }
            ].map(item => (
              <label key={item.key} style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer'}}>
                <input
                  type="checkbox"
                  checked={additionalInfo[item.key]}
                  onChange={e => setAdditionalInfo({...additionalInfo, [item.key]: e.target.checked})}
                />
                {item.label}
              </label>
            ))}
          </div>

          <button className="btn btn-primary" style={{width: '100%', marginTop: '24px'}} onClick={findDeductions} disabled={loading}>
            {loading ? 'Analyzing with AI...' : 'Find Missed Deductions'}
          </button>
        </div>

        <div className="card">
          <h3 className="card-title" style={{marginBottom: '20px'}}>Potential Deductions</h3>

          {!result ? (
            <div className="empty-state">
              <div className="empty-icon">🔍</div>
              <h3 className="empty-title">Ready to Search</h3>
              <p>Click "Find Missed Deductions" to discover tax savings</p>
            </div>
          ) : (
            <>
              {result.totalPotentialSavings > 0 && (
                <div style={{background: '#d1fae5', padding: '16px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center'}}>
                  <div style={{fontSize: '13px', color: '#065f46'}}>Potential Savings Found</div>
                  <div style={{fontSize: '28px', fontWeight: '700', color: '#065f46'}}>${result.totalPotentialSavings.toLocaleString()}</div>
                </div>
              )}

              {result.missedDeductions?.length > 0 ? (
                <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                  {result.missedDeductions.map((d, i) => (
                    <div key={i} style={{padding: '16px', background: 'var(--background)', borderRadius: '8px'}}>
                      <div style={{fontWeight: '600', marginBottom: '4px'}}>{d.category}</div>
                      <p style={{color: 'var(--text-light)', fontSize: '14px', marginBottom: '8px'}}>{d.description}</p>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <span style={{color: 'var(--success)', fontWeight: '600'}}>~${d.estimatedAmount?.toLocaleString()}</span>
                        <span className="badge badge-info">{d.irsReference}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{color: 'var(--text-light)'}}>Great job! No obvious missed deductions found.</p>
              )}

              {result.recommendations?.length > 0 && (
                <div style={{marginTop: '20px'}}>
                  <h4 style={{marginBottom: '12px'}}>Recommendations</h4>
                  <ul style={{paddingLeft: '20px'}}>
                    {result.recommendations.map((r, i) => (
                      <li key={i} style={{marginBottom: '8px', color: 'var(--text-light)'}}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Tax Interview Wizard Page
function InterviewPage() {
  const [taxYears, setTaxYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [interview, setInterview] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [showReview, setShowReview] = useState(false);

  const sections = [
    { id: 'personal_info', label: 'Personal Information', icon: '👤' },
    { id: 'income', label: 'Income', icon: '💰' },
    { id: 'deductions', label: 'Deductions', icon: '📝' },
    { id: 'credits', label: 'Credits', icon: '🎁' },
    { id: 'dependents', label: 'Dependents', icon: '👨‍👩‍👧' },
    { id: 'review', label: 'Review', icon: '✅' }
  ];

  useEffect(() => {
    api.get('/tax-years').then(res => {
      setTaxYears(res.data);
      if (res.data.length > 0) setSelectedYear(res.data[0].id);
    });
  }, []);

  useEffect(() => {
    if (selectedYear) {
      startInterview();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear]);

  const startInterview = async () => {
    try {
      const res = await api.post('/ai/interview/start', { taxYearId: selectedYear });
      setInterview(res.data);
      setShowReview(false);
      getNextQuestion(res.data.interviewId, res.data.currentSection);
    } catch (err) {
      console.error('Failed to start interview');
    }
  };

  const resetInterview = async () => {
    if (!window.confirm('Are you sure you want to reset and start over? All answers will be cleared.')) return;
    try {
      await api.post('/ai/interview/reset', { interviewId: interview?.interviewId, taxYearId: selectedYear });
      startInterview();
    } catch (err) {
      console.error('Failed to reset interview');
    }
  };

  const getNextQuestion = async (interviewId, section) => {
    if (section === 'review') {
      setShowReview(true);
      setCurrentQuestion(null);
      return;
    }
    setShowReview(false);
    setLoading(true);
    try {
      const res = await api.post('/ai/interview/next-question', {
        interviewId: interviewId || interview?.interviewId,
        section
      });
      setCurrentQuestion(res.data);
      setAnswer('');
    } catch (err) {
      console.error('Failed to get question');
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async () => {
    if (!answer && currentQuestion?.type !== 'boolean') return;

    try {
      const res = await api.post('/ai/interview/answer', {
        interviewId: interview.interviewId,
        field: currentQuestion.field,
        value: answer,
        section: interview.currentSection
      });
      // Update interview answers locally
      setInterview(prev => ({
        ...prev,
        answers: { ...prev.answers, [currentQuestion.field]: answer },
        progress: res.data.progress || prev.progress
      }));
      // Get next question
      getNextQuestion(interview.interviewId, interview.currentSection);
    } catch (err) {
      console.error('Failed to save answer');
    }
  };

  const completeSection = async (nextSection) => {
    try {
      const res = await api.post('/ai/interview/complete-section', {
        interviewId: interview.interviewId,
        section: interview.currentSection,
        nextSection
      });
      setInterview(prev => ({ ...prev, ...res.data }));
      if (nextSection) {
        setInterview(prev => ({ ...prev, currentSection: nextSection }));
        getNextQuestion(interview.interviewId, nextSection);
      }
    } catch (err) {
      console.error('Failed to complete section');
    }
  };

  const formatFieldName = (field) => {
    return field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatValue = (field, value) => {
    // Currency fields - only format these as money
    const currencyFields = [
      // Income fields
      'w2_wages_amount', 'w2_federal_withheld', 'w2_state_withheld',
      'self_employment_income', 'self_employment_expenses',
      'interest_income', 'dividend_income', 'qualified_dividend_income',
      'short_term_capital_gains', 'long_term_capital_gains', 'real_estate_gain',
      'rental_income', 'rental_expenses',
      'social_security_amount', 'retirement_distribution', 'taxable_retirement_distribution',
      'unemployment_amount', 'alimony_received', 'gambling_winnings', 'gambling_losses',
      'other_income_amount',
      // Deduction fields
      'mortgage_interest_amount', 'mortgage_points_amount',
      'property_tax_amount', 'state_income_tax_amount', 'sales_tax_amount',
      'cash_charity_amount', 'noncash_charity_amount',
      'medical_expenses_amount', 'health_insurance_premium_amount',
      'student_loan_interest_amount', 'educator_expenses',
      'traditional_ira_amount', 'hsa_contribution',
      'se_health_insurance_amount', 'alimony_paid',
      // Credit fields
      'childcare_amount', 'education_expenses',
      'solar_cost', 'energy_improvement_cost', 'ev_purchase_price',
      'foreign_tax_paid', 'retirement_contribution_amount'
    ];

    if (currencyFields.includes(field) && value && !isNaN(parseFloat(value))) {
      return `$${parseFloat(value).toLocaleString()}`;
    }

    // Boolean fields
    if (value === 'yes' || value === 'no') {
      return value.charAt(0).toUpperCase() + value.slice(1);
    }

    return value;
  };

  const groupAnswersBySection = () => {
    const answers = interview?.answers || {};
    const grouped = {
      'Personal Information': {},
      'Income': {},
      'Deductions': {},
      'Credits': {},
      'Dependents': {}
    };

    Object.entries(answers).forEach(([key, value]) => {
      // Income fields
      if (key.includes('w2') || key.includes('self_employment') || key.includes('investment') ||
          key.includes('capital') || key.includes('wages') || key.includes('1099') ||
          key.includes('interest') || key.includes('dividend') || key.includes('rental') ||
          key.includes('social_security') || key.includes('retirement_distribution') ||
          key.includes('unemployment') || key.includes('alimony_received') ||
          key.includes('gambling') || key.includes('other_income') || key.includes('real_estate') ||
          key.includes('home_office')) {
        grouped['Income'][key] = value;
      // Deduction fields
      } else if (key.includes('mortgage') || key.includes('property_tax') || key.includes('salt') ||
                 key.includes('state_income_tax') || key.includes('sales_tax') ||
                 key.includes('charit') || key.includes('medical') || key.includes('health_insurance') ||
                 key.includes('student_loan') || key.includes('educator') ||
                 key.includes('traditional_ira') || key.includes('hsa') ||
                 key.includes('se_health') || key.includes('alimony_paid')) {
        grouped['Deductions'][key] = value;
      // Credit fields
      } else if (key.includes('childcare') || key.includes('education') || key.includes('energy') ||
                 key.includes('solar') || key.includes('ev_') || key.includes('foreign_tax') ||
                 key.includes('retirement_contribution') || key.includes('marketplace') ||
                 key.includes('advance_ptc') || key.includes('eic') || key.includes('child_tax_credit')) {
        grouped['Credits'][key] = value;
      // Dependent fields
      } else if (key.includes('dependent') || key.includes('children') || key.includes('special_needs') ||
                 key.includes('disabled') || key.includes('college_student') || key.includes('num_') ||
                 key.includes('paid_half_home')) {
        grouped['Dependents'][key] = value;
      // Personal Information (default)
      } else {
        grouped['Personal Information'][key] = value;
      }
    });

    return grouped;
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Tax Interview Wizard</h1>
        <div style={{display: 'flex', gap: '12px', alignItems: 'center'}}>
          <select className="form-select" style={{width: '150px'}} value={selectedYear || ''} onChange={e => setSelectedYear(e.target.value)}>
            {taxYears.map(ty => <option key={ty.id} value={ty.id}>{ty.year}</option>)}
          </select>
          <button className="btn btn-secondary" onClick={resetInterview} style={{background: '#ef4444', color: 'white', border: 'none'}}>
            Reset Interview
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="card" style={{marginBottom: '20px'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px'}}>
          <span>Progress</span>
          <span style={{fontWeight: '600'}}>{interview?.progress || 0}%</span>
        </div>
        <div style={{height: '8px', background: 'var(--background)', borderRadius: '4px', overflow: 'hidden'}}>
          <div style={{width: `${interview?.progress || 0}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.3s'}}></div>
        </div>
      </div>

      <div className="grid grid-4">
        {/* Section Navigation */}
        <div className="card">
          <h3 className="card-title" style={{marginBottom: '16px'}}>Sections</h3>
          {sections.map(section => {
            const isCompleted = interview?.completedSections?.includes(section.id);
            const isCurrent = interview?.currentSection === section.id || (section.id === 'review' && showReview);
            return (
              <div
                key={section.id}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  marginBottom: '8px',
                  background: isCurrent ? 'var(--primary)' : isCompleted ? '#d1fae5' : 'var(--background)',
                  color: isCurrent ? 'white' : 'inherit',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onClick={() => {
                  setInterview(prev => ({ ...prev, currentSection: section.id }));
                  getNextQuestion(interview?.interviewId, section.id);
                }}
              >
                <span>{section.icon}</span>
                <span>{section.label}</span>
                {isCompleted && <span style={{marginLeft: 'auto'}}>✓</span>}
              </div>
            );
          })}
        </div>

        {/* Question Area or Review */}
        <div className="card" style={{gridColumn: 'span 3'}}>
          {loading ? (
            <div className="loading"><div className="spinner"></div></div>
          ) : showReview ? (
            /* Review Section */
            <div>
              <h3 style={{marginBottom: '24px', fontSize: '20px'}}>Review Your Information</h3>
              <p style={{color: 'var(--text-light)', marginBottom: '24px'}}>Please review all the information you've entered before submitting.</p>

              {Object.entries(groupAnswersBySection()).map(([sectionName, answers]) => (
                Object.keys(answers).length > 0 && (
                  <div key={sectionName} style={{marginBottom: '24px'}}>
                    <h4 style={{marginBottom: '12px', color: 'var(--primary)', borderBottom: '1px solid var(--border)', paddingBottom: '8px'}}>{sectionName}</h4>
                    <table className="table" style={{marginBottom: '0'}}>
                      <tbody>
                        {Object.entries(answers).map(([field, value]) => (
                          <tr key={field}>
                            <td style={{fontWeight: '500'}}>{formatFieldName(field)}</td>
                            <td style={{textAlign: 'right'}}>{formatValue(field, value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ))}

              <div style={{display: 'flex', gap: '12px', marginTop: '24px'}}>
                <button className="btn btn-secondary" onClick={() => {
                  setInterview(prev => ({ ...prev, currentSection: 'personal_info' }));
                  getNextQuestion(interview.interviewId, 'personal_info');
                }}>
                  Edit Answers
                </button>
                <button className="btn btn-success" onClick={async () => {
                    try {
                      await api.post('/ai/interview/submit', {
                        interviewId: interview.interviewId,
                        taxYearId: selectedYear,
                        answers: interview.answers
                      });
                      if (window.confirm('Success! Your tax data has been saved.\n\nWould you like to go to the Tax Calculator to see your results?')) {
                        window.location.href = '/calculations';
                      }
                    } catch (err) {
                      alert('Failed to save tax data: ' + (err.response?.data?.error || 'Unknown error'));
                    }
                  }}>
                  Submit Tax Information
                </button>
              </div>
            </div>
          ) : !currentQuestion ? (
            <div className="empty-state">
              <div className="empty-icon">🎯</div>
              <h3 className="empty-title">Let's Complete Your Tax Return</h3>
              <p>Answer questions step-by-step to file your taxes</p>
              <button className="btn btn-primary" style={{marginTop: '16px'}} onClick={() => startInterview()}>
                Start Interview
              </button>
            </div>
          ) : (
            <>
              <h3 style={{marginBottom: '24px', fontSize: '20px'}}>{currentQuestion.question}</h3>

              {currentQuestion.hint && (
                <p style={{color: 'var(--text-light)', marginBottom: '16px', fontSize: '14px'}}>{currentQuestion.hint}</p>
              )}

              {currentQuestion.type === 'boolean' ? (
                <div style={{display: 'flex', gap: '12px'}}>
                  <button className={`btn ${answer === 'yes' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setAnswer('yes')}>Yes</button>
                  <button className={`btn ${answer === 'no' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setAnswer('no')}>No</button>
                </div>
              ) : currentQuestion.type === 'select' ? (
                <select className="form-select" value={answer} onChange={e => setAnswer(e.target.value)}>
                  <option value="">Select an option...</option>
                  {currentQuestion.options?.map((opt, i) => (
                    <option key={i} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : currentQuestion.type === 'currency' || currentQuestion.type === 'number' ? (
                <div style={{position: 'relative'}}>
                  {currentQuestion.type === 'currency' && <span style={{position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)'}}>$</span>}
                  <input
                    type="number"
                    className="form-input"
                    style={currentQuestion.type === 'currency' ? {paddingLeft: '28px'} : {}}
                    value={answer}
                    onChange={e => setAnswer(e.target.value)}
                    placeholder={currentQuestion.type === 'currency' ? "0.00" : "Enter amount..."}
                  />
                </div>
              ) : (
                <input type="text" className="form-input" value={answer} onChange={e => setAnswer(e.target.value)} placeholder="Enter your answer..." />
              )}

              <div style={{display: 'flex', gap: '12px', marginTop: '24px', flexWrap: 'wrap'}}>
                <button className="btn btn-secondary" onClick={() => {
                  const prevIndex = sections.findIndex(s => s.id === interview.currentSection) - 1;
                  if (prevIndex >= 0) {
                    setInterview(prev => ({ ...prev, currentSection: sections[prevIndex].id }));
                    getNextQuestion(interview.interviewId, sections[prevIndex].id);
                  }
                }}>
                  Previous Section
                </button>
                <button className="btn btn-primary" onClick={submitAnswer} disabled={!answer && currentQuestion?.type !== 'info'}>
                  Next Question
                </button>
                <button className="btn btn-success" onClick={() => {
                  const nextIndex = sections.findIndex(s => s.id === interview.currentSection) + 1;
                  if (nextIndex < sections.length) {
                    completeSection(sections[nextIndex].id);
                  }
                }}>
                  Complete Section
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Schedule C (Self-Employment) Page
function ScheduleCPage() {
  const [taxYears, setTaxYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [businessData, setBusinessData] = useState({
    businessName: '',
    businessCode: '',
    accountingMethod: 'Cash',
    grossReceipts: '',
    returnsAllowances: '',
    costOfGoodsSold: '',
    otherIncome: '',
    homeOfficeSquareFeet: ''
  });
  const [expenses, setExpenses] = useState([]);
  const [newExpense, setNewExpense] = useState({ category: 'advertising', description: '', amount: '' });
  const [calculation, setCalculation] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/tax-years').then(res => {
      setTaxYears(res.data);
      if (res.data.length > 0) setSelectedYear(res.data[0].id);
    });
  }, []);

  const expenseCategories = [
    'advertising', 'car_truck', 'commissions', 'contract_labor', 'depreciation',
    'employee_benefits', 'insurance', 'interest_mortgage', 'interest_other',
    'legal_professional', 'office_expense', 'rent_vehicles', 'rent_other',
    'repairs', 'supplies', 'taxes_licenses', 'travel', 'meals', 'utilities', 'wages', 'other'
  ];

  const addExpense = () => {
    if (newExpense.description && newExpense.amount) {
      setExpenses([...expenses, { ...newExpense, amount: parseFloat(newExpense.amount) }]);
      setNewExpense({ category: 'advertising', description: '', amount: '' });
    }
  };

  const removeExpense = (index) => {
    setExpenses(expenses.filter((_, i) => i !== index));
  };

  const calculateScheduleC = async () => {
    setLoading(true);
    try {
      const res = await api.post('/advanced/schedule-c/calculate', {
        ...businessData,
        grossReceipts: parseFloat(businessData.grossReceipts) || 0,
        returnsAllowances: parseFloat(businessData.returnsAllowances) || 0,
        costOfGoodsSold: parseFloat(businessData.costOfGoodsSold) || 0,
        otherIncome: parseFloat(businessData.otherIncome) || 0,
        homeOfficeSquareFeet: parseFloat(businessData.homeOfficeSquareFeet) || 0,
        expenses
      });
      setCalculation(res.data);
    } catch (err) {
      alert('Calculation failed: ' + (err.response?.data?.error || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Schedule C - Self-Employment</h1>
        <select className="form-select" style={{width: '150px'}} value={selectedYear || ''} onChange={e => setSelectedYear(e.target.value)}>
          {taxYears.map(ty => <option key={ty.id} value={ty.id}>{ty.year}</option>)}
        </select>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3 className="card-title">Business Information</h3>
          <div className="form-group">
            <label className="form-label">Business Name</label>
            <input type="text" className="form-input" value={businessData.businessName}
              onChange={e => setBusinessData({...businessData, businessName: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Business Code (NAICS)</label>
            <input type="text" className="form-input" placeholder="e.g., 541990"
              value={businessData.businessCode}
              onChange={e => setBusinessData({...businessData, businessCode: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Accounting Method</label>
            <select className="form-select" value={businessData.accountingMethod}
              onChange={e => setBusinessData({...businessData, accountingMethod: e.target.value})}>
              <option value="Cash">Cash</option>
              <option value="Accrual">Accrual</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Home Office Square Feet (Simplified Method)</label>
            <input type="number" className="form-input" placeholder="Max 300 sq ft"
              value={businessData.homeOfficeSquareFeet}
              onChange={e => setBusinessData({...businessData, homeOfficeSquareFeet: e.target.value})} />
          </div>
        </div>

        <div className="card">
          <h3 className="card-title">Part I - Income</h3>
          <div className="form-group">
            <label className="form-label">Gross Receipts/Sales</label>
            <input type="number" className="form-input" value={businessData.grossReceipts}
              onChange={e => setBusinessData({...businessData, grossReceipts: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Returns and Allowances</label>
            <input type="number" className="form-input" value={businessData.returnsAllowances}
              onChange={e => setBusinessData({...businessData, returnsAllowances: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Cost of Goods Sold</label>
            <input type="number" className="form-input" value={businessData.costOfGoodsSold}
              onChange={e => setBusinessData({...businessData, costOfGoodsSold: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Other Income</label>
            <input type="number" className="form-input" value={businessData.otherIncome}
              onChange={e => setBusinessData({...businessData, otherIncome: e.target.value})} />
          </div>
        </div>
      </div>

      <div className="card" style={{marginTop: '20px'}}>
        <h3 className="card-title">Part II - Expenses</h3>
        <div className="grid grid-4" style={{marginBottom: '16px'}}>
          <select className="form-select" value={newExpense.category}
            onChange={e => setNewExpense({...newExpense, category: e.target.value})}>
            {expenseCategories.map(cat => (
              <option key={cat} value={cat}>{cat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
            ))}
          </select>
          <input type="text" className="form-input" placeholder="Description"
            value={newExpense.description}
            onChange={e => setNewExpense({...newExpense, description: e.target.value})} />
          <input type="number" className="form-input" placeholder="Amount"
            value={newExpense.amount}
            onChange={e => setNewExpense({...newExpense, amount: e.target.value})} />
          <button className="btn btn-primary" onClick={addExpense}>Add Expense</button>
        </div>

        {expenses.length > 0 && (
          <table className="table">
            <thead>
              <tr><th>Category</th><th>Description</th><th>Amount</th><th>Action</th></tr>
            </thead>
            <tbody>
              {expenses.map((exp, i) => (
                <tr key={i}>
                  <td>{exp.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</td>
                  <td>{exp.description}</td>
                  <td>${exp.amount.toLocaleString()}</td>
                  <td><button className="btn btn-secondary btn-sm" onClick={() => removeExpense(i)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <button className="btn btn-success" style={{marginTop: '16px'}} onClick={calculateScheduleC} disabled={loading}>
          {loading ? 'Calculating...' : 'Calculate Schedule C'}
        </button>
      </div>

      {calculation && (
        <div className="card" style={{marginTop: '20px'}}>
          <h3 className="card-title">Schedule C Results</h3>
          <div className="grid grid-3">
            <div className="stat-card">
              <div className="stat-label">Gross Profit</div>
              <div className="stat-value">${calculation.partI?.grossProfit?.toLocaleString() || 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Expenses</div>
              <div className="stat-value">${calculation.partII?.totalExpenses?.toLocaleString() || 0}</div>
            </div>
            <div className="stat-card" style={{background: calculation.isProfit ? '#d1fae5' : '#fee2e2'}}>
              <div className="stat-label">Net {calculation.isProfit ? 'Profit' : 'Loss'}</div>
              <div className="stat-value" style={{color: calculation.isProfit ? '#059669' : '#dc2626'}}>
                ${Math.abs(calculation.netProfitLoss || 0).toLocaleString()}
              </div>
            </div>
          </div>
          {calculation.selfEmploymentTax && (
            <div style={{marginTop: '20px', padding: '16px', background: 'var(--background)', borderRadius: '8px'}}>
              <h4>Self-Employment Tax</h4>
              <div className="grid grid-2" style={{marginTop: '12px'}}>
                <div><strong>SE Tax:</strong> ${calculation.selfEmploymentTax.selfEmploymentTax?.toLocaleString() || 0}</div>
                <div><strong>Deductible Portion:</strong> ${calculation.selfEmploymentTax.deductiblePortion?.toLocaleString() || 0}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Tax Planning Page
function TaxPlanningPage() {
  const [taxYears, setTaxYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeScenario, setActiveScenario] = useState(null);
  const [scenarioForm, setScenarioForm] = useState({
    name: '',
    type: 'retirement_contribution',
    parameters: {}
  });

  useEffect(() => {
    api.get('/tax-years').then(res => {
      setTaxYears(res.data);
      if (res.data.length > 0) setSelectedYear(res.data[0].id);
    });
  }, []);

  const scenarioTypes = [
    { value: 'retirement_contribution', label: 'Retirement Contribution Analysis' },
    { value: 'hsa_contribution', label: 'HSA Contribution Analysis' },
    { value: 'charitable_giving', label: 'Charitable Giving Strategy' },
    { value: 'income_timing', label: 'Income Timing Strategy' },
    { value: 'itemize_vs_standard', label: 'Itemize vs Standard Deduction' }
  ];

  const createScenario = async () => {
    setLoading(true);
    try {
      const res = await api.post('/advanced/tax-planning/scenario', {
        taxYearId: selectedYear,
        ...scenarioForm
      });
      setScenarios([...scenarios, res.data]);
      setActiveScenario(res.data);
      setScenarioForm({ name: '', type: 'retirement_contribution', parameters: {} });
    } catch (err) {
      alert('Failed to create scenario: ' + (err.response?.data?.error || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const analyzeRetirement = async () => {
    setLoading(true);
    try {
      const res = await api.post('/advanced/tax-planning/analyze-retirement', {
        taxYearId: selectedYear,
        income: parseFloat(scenarioForm.parameters.income) || 100000,
        filingStatus: scenarioForm.parameters.filingStatus || 'single',
        age: parseInt(scenarioForm.parameters.age) || 40
      });
      setActiveScenario(res.data);
    } catch (err) {
      alert('Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Tax Planning</h1>
        <select className="form-select" style={{width: '150px'}} value={selectedYear || ''} onChange={e => setSelectedYear(e.target.value)}>
          {taxYears.map(ty => <option key={ty.id} value={ty.id}>{ty.year}</option>)}
        </select>
      </div>

      <div className="grid grid-3">
        <div className="card">
          <h3 className="card-title">Create Scenario</h3>
          <div className="form-group">
            <label className="form-label">Scenario Name</label>
            <input type="text" className="form-input" value={scenarioForm.name}
              onChange={e => setScenarioForm({...scenarioForm, name: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Analysis Type</label>
            <select className="form-select" value={scenarioForm.type}
              onChange={e => setScenarioForm({...scenarioForm, type: e.target.value})}>
              {scenarioTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {scenarioForm.type === 'retirement_contribution' && (
            <>
              <div className="form-group">
                <label className="form-label">Annual Income</label>
                <input type="number" className="form-input"
                  value={scenarioForm.parameters.income || ''}
                  onChange={e => setScenarioForm({...scenarioForm, parameters: {...scenarioForm.parameters, income: e.target.value}})} />
              </div>
              <div className="form-group">
                <label className="form-label">Filing Status</label>
                <select className="form-select"
                  value={scenarioForm.parameters.filingStatus || 'single'}
                  onChange={e => setScenarioForm({...scenarioForm, parameters: {...scenarioForm.parameters, filingStatus: e.target.value}})}>
                  <option value="single">Single</option>
                  <option value="married_filing_jointly">Married Filing Jointly</option>
                  <option value="married_filing_separately">Married Filing Separately</option>
                  <option value="head_of_household">Head of Household</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Age</label>
                <input type="number" className="form-input"
                  value={scenarioForm.parameters.age || ''}
                  onChange={e => setScenarioForm({...scenarioForm, parameters: {...scenarioForm.parameters, age: e.target.value}})} />
              </div>
              <button className="btn btn-primary" onClick={analyzeRetirement} disabled={loading}>
                {loading ? 'Analyzing...' : 'Analyze Retirement Options'}
              </button>
            </>
          )}

          {scenarioForm.type !== 'retirement_contribution' && (
            <button className="btn btn-primary" onClick={createScenario} disabled={loading}>
              {loading ? 'Creating...' : 'Create Scenario'}
            </button>
          )}
        </div>

        <div className="card" style={{gridColumn: 'span 2'}}>
          <h3 className="card-title">Analysis Results</h3>
          {activeScenario ? (
            <div>
              {activeScenario.recommendations && (
                <div style={{marginBottom: '20px'}}>
                  <h4>Recommendations</h4>
                  {activeScenario.recommendations.map((rec, i) => (
                    <div key={i} style={{padding: '12px', background: 'var(--background)', borderRadius: '8px', marginBottom: '8px'}}>
                      <strong>{rec.type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</strong>
                      <p style={{margin: '8px 0'}}>{rec.description}</p>
                      <div style={{color: 'var(--success)', fontWeight: '600'}}>
                        Potential Savings: ${rec.taxSavings?.toLocaleString() || 0}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {activeScenario.summary && (
                <div style={{padding: '16px', background: '#d1fae5', borderRadius: '8px'}}>
                  <h4>Summary</h4>
                  <div className="grid grid-2" style={{marginTop: '12px'}}>
                    <div><strong>Total Max Savings:</strong> ${activeScenario.summary.maxPotentialSavings?.toLocaleString() || 0}</div>
                    <div><strong>Contributions Available:</strong> ${activeScenario.summary.totalContributionRoom?.toLocaleString() || 0}</div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">📈</div>
              <h3 className="empty-title">No Analysis Yet</h3>
              <p>Create a scenario to see tax planning recommendations</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// State Returns Page
function StateReturnsPage() {
  const [taxYears, setTaxYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [stateCode, setStateCode] = useState('CA');
  const [federalData, setFederalData] = useState({
    agi: '',
    wages: '',
    federalTax: '',
    itemizedDeductions: ''
  });
  const [stateReturn, setStateReturn] = useState(null);
  const [loading, setLoading] = useState(false);

  const states = [
    { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
    { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
    { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
    { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
    { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
    { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
    { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
    { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
    { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
    { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
    { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
    { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
    { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
    { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
    { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
    { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
    { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }, { code: 'DC', name: 'Washington DC' }
  ];

  const noIncomeTaxStates = ['AK', 'FL', 'NV', 'SD', 'TX', 'WA', 'WY', 'TN', 'NH'];

  useEffect(() => {
    api.get('/tax-years').then(res => {
      setTaxYears(res.data);
      if (res.data.length > 0) setSelectedYear(res.data[0].id);
    });
  }, []);

  const generateStateReturn = async () => {
    setLoading(true);
    try {
      const res = await api.post('/advanced/state-returns/generate', {
        stateCode,
        federalData: {
          agi: parseFloat(federalData.agi) || 0,
          wages: parseFloat(federalData.wages) || 0,
          federalTax: parseFloat(federalData.federalTax) || 0,
          itemizedDeductions: parseFloat(federalData.itemizedDeductions) || 0
        },
        filingStatus: 'single'
      });
      setStateReturn(res.data);
    } catch (err) {
      alert('Failed to generate state return: ' + (err.response?.data?.error || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">State Tax Returns</h1>
        <select className="form-select" style={{width: '150px'}} value={selectedYear || ''} onChange={e => setSelectedYear(e.target.value)}>
          {taxYears.map(ty => <option key={ty.id} value={ty.id}>{ty.year}</option>)}
        </select>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3 className="card-title">State Selection</h3>
          <div className="form-group">
            <label className="form-label">State</label>
            <select className="form-select" value={stateCode} onChange={e => setStateCode(e.target.value)}>
              {states.map(s => (
                <option key={s.code} value={s.code}>
                  {s.name} {noIncomeTaxStates.includes(s.code) ? '(No Income Tax)' : ''}
                </option>
              ))}
            </select>
          </div>

          {noIncomeTaxStates.includes(stateCode) ? (
            <div style={{padding: '20px', background: '#d1fae5', borderRadius: '8px', textAlign: 'center'}}>
              <div style={{fontSize: '32px', marginBottom: '8px'}}>🎉</div>
              <h4>No State Income Tax!</h4>
              <p style={{color: 'var(--text-light)'}}>
                {states.find(s => s.code === stateCode)?.name} does not have a state income tax.
              </p>
            </div>
          ) : (
            <>
              <h4 style={{marginTop: '20px', marginBottom: '12px'}}>Federal Data</h4>
              <div className="form-group">
                <label className="form-label">Federal AGI</label>
                <input type="number" className="form-input" value={federalData.agi}
                  onChange={e => setFederalData({...federalData, agi: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Wages</label>
                <input type="number" className="form-input" value={federalData.wages}
                  onChange={e => setFederalData({...federalData, wages: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Federal Tax</label>
                <input type="number" className="form-input" value={federalData.federalTax}
                  onChange={e => setFederalData({...federalData, federalTax: e.target.value})} />
              </div>
              <button className="btn btn-primary" onClick={generateStateReturn} disabled={loading}>
                {loading ? 'Generating...' : 'Generate State Return'}
              </button>
            </>
          )}
        </div>

        <div className="card">
          <h3 className="card-title">State Return Results</h3>
          {stateReturn ? (
            <div>
              <div className="grid grid-2" style={{marginBottom: '20px'}}>
                <div className="stat-card">
                  <div className="stat-label">State Taxable Income</div>
                  <div className="stat-value">${stateReturn.taxableIncome?.toLocaleString() || 0}</div>
                </div>
                <div className="stat-card" style={{background: stateReturn.totalTax > 0 ? '#fee2e2' : '#d1fae5'}}>
                  <div className="stat-label">State Tax Due</div>
                  <div className="stat-value" style={{color: stateReturn.totalTax > 0 ? '#dc2626' : '#059669'}}>
                    ${stateReturn.totalTax?.toLocaleString() || 0}
                  </div>
                </div>
              </div>
              <div style={{padding: '16px', background: 'var(--background)', borderRadius: '8px'}}>
                <h4>Form: {stateReturn.form}</h4>
                <p style={{marginTop: '8px', color: 'var(--text-light)'}}>{stateReturn.formTitle}</p>
                {stateReturn.effectiveRate && (
                  <div style={{marginTop: '12px'}}>
                    <strong>Effective Rate:</strong> {(stateReturn.effectiveRate * 100).toFixed(2)}%
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">🗺️</div>
              <h3 className="empty-title">No State Return Yet</h3>
              <p>Select a state and enter federal data to generate a state return</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// E-File Page
function EFilePage() {
  const [taxYears, setTaxYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [validation, setValidation] = useState(null);
  const [xmlPreview, setXmlPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get('/tax-years').then(res => {
      setTaxYears(res.data);
      if (res.data.length > 0) setSelectedYear(res.data[0].id);
    });
  }, []);

  const validateReturn = async () => {
    setLoading(true);
    try {
      const res = await api.post('/advanced/efile/validate', {
        taxYearId: selectedYear
      });
      setValidation(res.data);
    } catch (err) {
      alert('Validation failed');
    } finally {
      setLoading(false);
    }
  };

  const generateXML = async () => {
    setLoading(true);
    try {
      const res = await api.post('/advanced/efile/generate-xml', {
        taxYearId: selectedYear
      });
      setXmlPreview(res.data);
    } catch (err) {
      alert('XML generation failed');
    } finally {
      setLoading(false);
    }
  };

  const submitEFile = async () => {
    setSubmitting(true);
    try {
      const res = await api.post('/advanced/efile/submit', {
        taxYearId: selectedYear
      });
      alert('E-File submitted successfully! Submission ID: ' + res.data.submissionId);
    } catch (err) {
      alert('E-File submission failed: ' + (err.response?.data?.error || 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">E-File Tax Return</h1>
        <select className="form-select" style={{width: '150px'}} value={selectedYear || ''} onChange={e => setSelectedYear(e.target.value)}>
          {taxYears.map(ty => <option key={ty.id} value={ty.id}>{ty.year}</option>)}
        </select>
      </div>

      <div className="grid grid-3">
        <div className="card" style={{textAlign: 'center', padding: '30px'}}>
          <div style={{fontSize: '48px', marginBottom: '16px'}}>1️⃣</div>
          <h3>Step 1: Validate</h3>
          <p style={{color: 'var(--text-light)', marginBottom: '16px'}}>Check your return for errors before filing</p>
          <button className="btn btn-primary" onClick={validateReturn} disabled={loading}>
            {loading ? 'Validating...' : 'Validate Return'}
          </button>
        </div>

        <div className="card" style={{textAlign: 'center', padding: '30px'}}>
          <div style={{fontSize: '48px', marginBottom: '16px'}}>2️⃣</div>
          <h3>Step 2: Generate XML</h3>
          <p style={{color: 'var(--text-light)', marginBottom: '16px'}}>Generate IRS MeF format XML</p>
          <button className="btn btn-primary" onClick={generateXML} disabled={loading || !validation?.isValid}>
            {loading ? 'Generating...' : 'Generate XML'}
          </button>
        </div>

        <div className="card" style={{textAlign: 'center', padding: '30px'}}>
          <div style={{fontSize: '48px', marginBottom: '16px'}}>3️⃣</div>
          <h3>Step 3: Submit</h3>
          <p style={{color: 'var(--text-light)', marginBottom: '16px'}}>Submit to IRS electronically</p>
          <button className="btn btn-success" onClick={submitEFile} disabled={submitting || !xmlPreview}>
            {submitting ? 'Submitting...' : 'Submit E-File'}
          </button>
        </div>
      </div>

      {validation && (
        <div className="card" style={{marginTop: '20px'}}>
          <h3 className="card-title">Validation Results</h3>
          <div style={{padding: '16px', background: validation.isValid ? '#d1fae5' : '#fee2e2', borderRadius: '8px', marginBottom: '16px'}}>
            <strong>{validation.isValid ? '✓ Ready to E-File' : '✗ Issues Found'}</strong>
          </div>
          {validation.errors?.length > 0 && (
            <div style={{marginBottom: '16px'}}>
              <h4 style={{color: '#dc2626'}}>Errors (Must Fix)</h4>
              <ul>
                {validation.errors.map((err, i) => <li key={i} style={{color: '#dc2626'}}>{err}</li>)}
              </ul>
            </div>
          )}
          {validation.warnings?.length > 0 && (
            <div>
              <h4 style={{color: '#f59e0b'}}>Warnings</h4>
              <ul>
                {validation.warnings.map((warn, i) => <li key={i} style={{color: '#f59e0b'}}>{warn}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {xmlPreview && (
        <div className="card" style={{marginTop: '20px'}}>
          <h3 className="card-title">XML Preview</h3>
          <pre style={{background: '#1f2937', color: '#10b981', padding: '16px', borderRadius: '8px', overflow: 'auto', maxHeight: '300px', fontSize: '12px'}}>
            {xmlPreview.xml?.substring(0, 2000)}...
          </pre>
        </div>
      )}
    </div>
  );
}

// PDF Export Page
function PDFExportPage() {
  const [taxYears, setTaxYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedForm, setSelectedForm] = useState('1040');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  const forms = [
    { value: '1040', label: 'Form 1040 - Individual Tax Return' },
    { value: 'schedule-c', label: 'Schedule C - Business Income' },
    { value: 'summary', label: 'Tax Summary Report' }
  ];

  useEffect(() => {
    api.get('/tax-years').then(res => {
      setTaxYears(res.data);
      if (res.data.length > 0) setSelectedYear(res.data[0].id);
    });
  }, []);

  const generatePreview = async () => {
    setLoading(true);
    try {
      const res = await api.post('/advanced/pdf/generate', {
        taxYearId: selectedYear,
        formType: selectedForm
      });
      setPreview(res.data);
    } catch (err) {
      alert('PDF generation failed');
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = () => {
    if (preview?.html) {
      const blob = new Blob([preview.html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedForm}-${selectedYear}.html`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">PDF Export</h1>
        <select className="form-select" style={{width: '150px'}} value={selectedYear || ''} onChange={e => setSelectedYear(e.target.value)}>
          {taxYears.map(ty => <option key={ty.id} value={ty.id}>{ty.year}</option>)}
        </select>
      </div>

      <div className="card">
        <h3 className="card-title">Select Form to Export</h3>
        <div className="grid grid-3" style={{marginBottom: '20px'}}>
          {forms.map(form => (
            <div
              key={form.value}
              onClick={() => setSelectedForm(form.value)}
              style={{
                padding: '20px',
                border: `2px solid ${selectedForm === form.value ? 'var(--primary)' : 'var(--border)'}`,
                borderRadius: '8px',
                cursor: 'pointer',
                textAlign: 'center',
                background: selectedForm === form.value ? '#eff6ff' : 'white'
              }}
            >
              <div style={{fontSize: '32px', marginBottom: '8px'}}>📄</div>
              <strong>{form.label}</strong>
            </div>
          ))}
        </div>

        <div style={{display: 'flex', gap: '12px'}}>
          <button className="btn btn-primary" onClick={generatePreview} disabled={loading}>
            {loading ? 'Generating...' : 'Generate Preview'}
          </button>
          <button className="btn btn-success" onClick={downloadPDF} disabled={!preview}>
            Download
          </button>
        </div>
      </div>

      {preview && (
        <div className="card" style={{marginTop: '20px'}}>
          <h3 className="card-title">Preview</h3>
          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '20px',
              background: 'white',
              maxHeight: '600px',
              overflow: 'auto'
            }}
            dangerouslySetInnerHTML={{ __html: preview.html }}
          />
        </div>
      )}
    </div>
  );
}

// Main App
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="/dashboard" element={<ProtectedRoute><Layout><DashboardPage /></Layout></ProtectedRoute>} />
          <Route path="/interview" element={<ProtectedRoute><Layout><InterviewPage /></Layout></ProtectedRoute>} />
          <Route path="/ai-chat" element={<ProtectedRoute><Layout><AIChatPage /></Layout></ProtectedRoute>} />
          <Route path="/income" element={<ProtectedRoute><Layout><IncomePage /></Layout></ProtectedRoute>} />
          <Route path="/schedule-c" element={<ProtectedRoute><Layout><ScheduleCPage /></Layout></ProtectedRoute>} />
          <Route path="/deductions" element={<ProtectedRoute><Layout><DeductionsPage /></Layout></ProtectedRoute>} />
          <Route path="/credits" element={<ProtectedRoute><Layout><CreditsPage /></Layout></ProtectedRoute>} />
          <Route path="/dependents" element={<ProtectedRoute><Layout><DependentsPage /></Layout></ProtectedRoute>} />
          <Route path="/documents" element={<ProtectedRoute><Layout><DocumentsPage /></Layout></ProtectedRoute>} />
          <Route path="/scan-document" element={<ProtectedRoute><Layout><ScanDocumentPage /></Layout></ProtectedRoute>} />
          <Route path="/expenses" element={<ProtectedRoute><Layout><ExpensesPage /></Layout></ProtectedRoute>} />
          <Route path="/deduction-finder" element={<ProtectedRoute><Layout><DeductionFinderPage /></Layout></ProtectedRoute>} />
          <Route path="/calculations" element={<ProtectedRoute><Layout><CalculationsPage /></Layout></ProtectedRoute>} />
          <Route path="/tax-planning" element={<ProtectedRoute><Layout><TaxPlanningPage /></Layout></ProtectedRoute>} />
          <Route path="/state-returns" element={<ProtectedRoute><Layout><StateReturnsPage /></Layout></ProtectedRoute>} />
          <Route path="/advice" element={<ProtectedRoute><Layout><AdvicePage /></Layout></ProtectedRoute>} />
          <Route path="/forms" element={<ProtectedRoute><Layout><FormsPage /></Layout></ProtectedRoute>} />
          <Route path="/efile" element={<ProtectedRoute><Layout><EFilePage /></Layout></ProtectedRoute>} />
          <Route path="/pdf-export" element={<ProtectedRoute><Layout><PDFExportPage /></Layout></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Layout><ProfilePage /></Layout></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
