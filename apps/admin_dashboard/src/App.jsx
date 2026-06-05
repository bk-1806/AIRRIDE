import React from 'react';
import { AuthProvider, useAuth } from './store/authStore';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import './index.css';

function AppContent() {
  const { admin, logout, loading } = useAuth();
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--primary)' }}>
      <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3, borderColor: 'rgba(255,255,255,0.2)', borderTopColor: '#3B82F6' }} />
    </div>
  );
  if (!admin) return <LoginPage />;
  return <Dashboard admin={admin} onLogout={logout} />;
}

export default function App() {
  return <AuthProvider><AppContent /></AuthProvider>;
}
