import React, { useState, useEffect } from 'react';
import { bookingsAPI, driversAPI, analyticsAPI } from '../services/api';
import { io } from 'socket.io-client';

const STATUS_LABELS = {
  pending: 'Pending',
  admin_assigned: 'Assigned',
  driver_accepted: 'Driver Accepted',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export default function Dashboard({ onLogout, admin }) {
  const [view, setView] = useState('bookings');
  const [bookings, setBookings] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [assignModal, setAssignModal] = useState(null);
  const [assignDriverId, setAssignDriverId] = useState('');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    fetchData();
    const socket = io(import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000');
    socket.emit('join_admin_room');
    socket.on('booking_updated', ({ booking }) => {
      setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, ...booking } : b));
    });
    return () => socket.disconnect();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [bRes, dRes, aRes] = await Promise.all([
        bookingsAPI.getAll({ limit: 100 }),
        driversAPI.getAll({}),
        analyticsAPI.get(),
      ]);
      setBookings(bRes.data.bookings);
      setDrivers(dRes.data.drivers);
      setAnalytics(aRes.data.analytics);
    } catch (err) {
      console.error('Failed to fetch data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!assignDriverId || !assignModal) return;
    setAssigning(true);
    try {
      await bookingsAPI.assignDriver(assignModal.id, { driverId: assignDriverId });
      await fetchData();
      setAssignModal(null);
      setAssignDriverId('');
    } catch (err) {
      alert('Failed to assign driver: ' + (err.response?.data?.message || err.message));
    } finally {
      setAssigning(false);
    }
  };

  const filtered = bookings.filter(b =>
    !filter || b.status === filter || b.booking_ref?.toLowerCase().includes(filter.toLowerCase()) || b.customer_name?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Sidebar */}
      <aside style={{ width: 220, background: 'var(--primary)', padding: '24px 0', display: 'flex', flexDirection: 'column', position: 'fixed', height: '100vh', top: 0, left: 0, zIndex: 10 }}>
        <div style={{ padding: '0 20px 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, background: '#3B82F6', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>
            </div>
            <div>
              <div style={{ color: 'white', fontWeight: 800, fontSize: 15, letterSpacing: 1.5 }}>AIRRIDE</div>
              <div style={{ color: '#94A3B8', fontSize: 10, letterSpacing: 0.5 }}>ADMIN</div>
            </div>
          </div>
        </div>

        {[
          { id: 'bookings', icon: '📋', label: 'Bookings' },
          { id: 'drivers', icon: '🚗', label: 'Drivers' },
          { id: 'users', icon: '👤', label: 'Customers' },
          { id: 'analytics', icon: '📊', label: 'Analytics' },
        ].map(item => (
          <button key={item.id} onClick={() => setView(item.id)} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px',
            background: view === item.id ? 'rgba(59,130,246,0.15)' : 'transparent',
            border: 'none', borderLeft: view === item.id ? '3px solid #3B82F6' : '3px solid transparent',
            color: view === item.id ? 'white' : '#94A3B8', fontSize: 14, fontWeight: 500, width: '100%', textAlign: 'left',
            cursor: 'pointer', transition: 'all 0.2s',
          }}>
            <span style={{ fontSize: 18 }}>{item.icon}</span>
            {item.label}
          </button>
        ))}

        <div style={{ marginTop: 'auto', padding: '0 20px 24px' }}>
          <div style={{ color: '#475569', fontSize: 12, marginBottom: 8 }}>Logged in as</div>
          <div style={{ color: '#CBD5E1', fontSize: 13, fontWeight: 500, marginBottom: 12, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{admin?.email}</div>
          <button onClick={onLogout} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#F87171', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, width: '100%', cursor: 'pointer' }}>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ marginLeft: 220, flex: 1, padding: 32 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{view === 'bookings' ? 'Bookings' : view === 'drivers' ? 'Drivers' : view === 'analytics' ? 'Analytics' : 'Customers'}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 2 }}>AIRRIDE Dispatch Centre</p>
          </div>
          <button onClick={fetchData} style={{ background: 'var(--accent)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600 }}>↻ Refresh</button>
        </div>

        {/* Analytics cards */}
        {analytics && view === 'analytics' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
            {[
              { label: 'Total Bookings', value: analytics.totalBookings, color: '#3B82F6', icon: '📋' },
              { label: 'Active Bookings', value: analytics.activeBookings, color: '#F59E0B', icon: '⏳' },
              { label: 'Total Drivers', value: analytics.totalDrivers, color: '#10B981', icon: '🚗' },
              { label: 'Online Drivers', value: analytics.onlineDrivers, color: '#10B981', icon: '🟢' },
              { label: 'Total Revenue', value: `₹${analytics.totalRevenue?.toLocaleString('en-IN')}`, color: '#8B5CF6', icon: '💰' },
            ].map((stat, i) => (
              <div key={i} className="fade-in" style={{ background: 'var(--card)', borderRadius: 16, padding: 20, border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>{stat.icon}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Bookings view */}
        {view === 'bookings' && (
          <>
            {/* Filters */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <input
                placeholder="Search by ref, customer..."
                value={filter} onChange={e => setFilter(e.target.value)}
                style={{ padding: '10px 16px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 14, outline: 'none', minWidth: 240, background: 'white' }}
              />
              {['', 'pending', 'admin_assigned', 'in_progress', 'completed', 'cancelled'].map(s => (
                <button key={s} onClick={() => setFilter(s)} style={{
                  padding: '8px 16px', borderRadius: 100, border: '1.5px solid', fontSize: 13, fontWeight: 500,
                  background: filter === s ? 'var(--accent)' : 'white',
                  borderColor: filter === s ? 'var(--accent)' : 'var(--border)',
                  color: filter === s ? 'white' : 'var(--text-secondary)',
                }}>
                  {s === '' ? 'All' : STATUS_LABELS[s]}
                </button>
              ))}
            </div>

            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} /></div>
            ) : (
              <div style={{ background: 'var(--card)', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg)' }}>
                      {['Ref', 'Customer', 'Vehicle', 'Pickup', 'Scheduled', 'Fare', 'Status', 'Driver', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--border)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((b, i) => (
                      <tr key={b.id} className="fade-in" style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'} onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                        <td style={{ padding: '14px 16px' }}><code style={{ fontSize: 12, background: 'var(--bg)', padding: '3px 8px', borderRadius: 6, fontFamily: 'monospace', color: 'var(--accent)', fontWeight: 700 }}>{b.booking_ref}</code></td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 500, fontSize: 14 }}>{b.customer_name || '—'}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{b.customer_phone}</div>
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: 14 }}>{b.vehicle_type}</td>
                        <td style={{ padding: '14px 16px', maxWidth: 200 }}>
                          <div style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.pickup_address}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>→ {b.destination_address}</div>
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: 13, whiteSpace: 'nowrap' }}>
                          {b.scheduled_at ? new Date(b.scheduled_at).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 700, fontSize: 15 }}>₹{b.total_fare ?? 0}</td>
                        <td style={{ padding: '14px 16px' }}><span className={`badge badge-${b.status}`}>{STATUS_LABELS[b.status] || b.status}</span></td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{b.driver_name || <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>}</div>
                          {b.license_plate && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{b.license_plate}</div>}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          {['pending', 'admin_assigned'].includes(b.status) && (
                            <button onClick={() => setAssignModal(b)} style={{ padding: '7px 14px', background: 'var(--accent-light)', border: '1px solid var(--accent)', color: 'var(--accent)', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
                              Assign Driver
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filtered.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                    <div style={{ fontWeight: 600 }}>No bookings found</div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Drivers view */}
        {view === 'drivers' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {drivers.map((d, i) => (
              <div key={d.id} className="fade-in" style={{ background: 'var(--card)', borderRadius: 16, padding: 20, border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 48, height: 48, background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 18 }}>{d.full_name?.[0] ?? 'D'}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{d.full_name}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{d.phone_number}</div>
                  </div>
                  <div style={{ marginLeft: 'auto' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.is_online ? '#10B981' : '#CBD5E1', boxShadow: d.is_online ? '0 0 0 3px #D1FAE5' : 'none' }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5 }}>Trips</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>{d.total_trips}</div>
                  </div>
                  <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5 }}>Rating</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#F59E0B', marginTop: 2 }}>⭐ {d.rating}</div>
                  </div>
                </div>
                {d.vehicle && <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-secondary)' }}>🚗 {d.vehicle} • {d.license_plate}</div>}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Assign Driver Modal */}
      {assignModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}>
          <div style={{ background: 'white', borderRadius: 20, padding: 32, width: '100%', maxWidth: 460 }} className="fade-in">
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Assign Driver</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>Booking: <strong>{assignModal.booking_ref}</strong></p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Select Driver</label>
              <select value={assignDriverId} onChange={e => setAssignDriverId(e.target.value)}
                style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1.5px solid var(--border)', fontSize: 14, outline: 'none', background: 'var(--bg)' }}>
                <option value="">Choose a driver...</option>
                {drivers.filter(d => d.is_active).map(d => (
                  <option key={d.id} value={d.id}>{d.full_name} — {d.phone_number} ({d.is_online ? '🟢 Online' : '⚫ Offline'})</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => { setAssignModal(null); setAssignDriverId(''); }} style={{ flex: 1, padding: '13px 24px', background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 12, fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Cancel</button>
              <button onClick={handleAssign} disabled={!assignDriverId || assigning} style={{ flex: 2, padding: '13px 24px', background: assignDriverId ? 'var(--accent)' : '#93C5FD', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, color: 'white' }}>
                {assigning ? 'Assigning...' : 'Assign Driver'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
