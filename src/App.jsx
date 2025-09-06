import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';

import LoginPage from './components/LoginPage.jsx';
import Dashboard from './Dashboard.jsx'; // Your main page (SchoolForm + Table + Upload)
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

// ===== Auth Context Wrapper =====
function Protected({ children, allowedRoles = ['SPECTROPY_ADMIN'] }) {
  const raw = sessionStorage.getItem('sp_user');
  let user = null;

  try {
    user = raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error('Invalid user session:', e);
    sessionStorage.removeItem('sp_user');
  }

  const hasValidRole = user && allowedRoles.includes(user.role);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!hasValidRole) {
    // Optional: show unauthorized page or redirect
    return <Navigate to="/login" replace />;
  }

  return children;
}

// ===== Login Handler Component =====
function AppRoutes() {
  const navigate = useNavigate();

  const handleLogin = (user) => {
    const { role } = user;

    // Validate role
    if (!role) {
      alert('Invalid login: Missing role');
      return;
    }

    // Only allow known roles (extend later if needed)
    if (role !== 'SPECTROPY_ADMIN') {
      alert('Access denied: You do not have permission to view this page.');
      return;
    }

    // Save to session
    try {
      sessionStorage.setItem('sp_user', JSON.stringify(user));
      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error('Failed to save session:', err);
      alert('Login failed due to browser settings (private mode?)');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('sp_user');
    navigate('/login', { replace: true });
  };

  // Optional: Expose logout to Dashboard via context or props if needed
  // For now, you can add a Logout button inside Dashboard conditionally

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header (shown on all pages) */}
      <header style={{
        padding: '12px 20px',
        backgroundColor: '#1a56db',
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '18px',
        fontWeight: 'bold',
      }}>
        <span>SPECTROPY School Portal</span>
        {sessionStorage.getItem('sp_user') && (
          <button
            onClick={handleLogout}
            style={{
              background: '#ef4444',
              color: 'white',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            🔐 Logout
          </button>
        )}
      </header>

      {/* Page Content */}
      <main style={{ flex: 1, padding: '20px', backgroundColor: '#f7fafc' }}>
        <Routes>
          {/* Redirect root to login */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Login Page */}
          <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />

          {/* Admin Dashboard (Protected) */}
          <Route
            path="/dashboard"
            element={
              <Protected allowedRoles={['SPECTROPY_ADMIN']}>
                <Dashboard />
              </Protected>
            }
          />

          {/* Catch-all: invalid routes */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer style={{
        textAlign: 'center',
        padding: '10px',
        fontSize: '12px',
        color: '#666',
        backgroundColor: '#f1f5f9',
      }}>
        © {new Date().getFullYear()} SPECTROPY. All rights reserved.
      </footer>
    </div>
  );
}

// ===== Main App =====
export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}