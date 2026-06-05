import React, { useState } from 'react';
import { useAuth } from '../store/authStore';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 24, padding: 48, width: '100%', maxWidth: 420, boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }} className="fade-in">
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
          <div style={{ width: 44, height: 44, background: '#3B82F6', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: 2, color: '#0F172A' }}>AIRRIDE</div>
            <div style={{ fontSize: 11, color: '#94A3B8', letterSpacing: 1, textTransform: 'uppercase' }}>Admin Portal</div>
          </div>
        </div>

        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8, color: '#0F172A' }}>Welcome back</h1>
        <p style={{ color: '#475569', fontSize: 14, marginBottom: 32 }}>Sign in to the dispatch dashboard</p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: '#0F172A' }}>Email</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              placeholder="admin@airride.in"
              style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none', background: '#F8FAFC', transition: 'border-color 0.2s' }}
              onFocus={e => e.target.style.borderColor = '#3B82F6'}
              onBlur={e => e.target.style.borderColor = '#E2E8F0'}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: '#0F172A' }}>Password</label>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              placeholder="••••••••"
              style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none', background: '#F8FAFC' }}
              onFocus={e => e.target.style.borderColor = '#3B82F6'}
              onBlur={e => e.target.style.borderColor = '#E2E8F0'}
            />
          </div>

          {error && <div style={{ background: '#FEE2E2', color: '#991B1B', padding: '12px 16px', borderRadius: 10, fontSize: 13, marginBottom: 16 }}>{error}</div>}

          <button
            type="submit" disabled={loading}
            style={{ width: '100%', padding: '15px 24px', background: loading ? '#93C5FD' : '#3B82F6', color: 'white', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600, transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            {loading ? <><div className="spinner" style={{ borderTopColor: 'white', width: 18, height: 18 }} /> Signing in...</> : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
