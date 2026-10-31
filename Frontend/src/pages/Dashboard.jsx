import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Plus, LogIn, ArrowRight, Clock, Tv, Copy, Check, Trash2, AlertCircle } from 'lucide-react';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const kickedMessage = location.state?.kickedMessage;
  const [quickCode, setQuickCode] = useState('');
  const [recentRooms, setRecentRooms] = useState(() => {
    try {
      const stored = localStorage.getItem('recent_rooms');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [copiedCode, setCopiedCode] = useState(null);

  const handleQuickJoin = (e) => {
    e.preventDefault();
    if (quickCode.trim()) {
      navigate(`/room/${quickCode.trim().toUpperCase()}`);
    }
  };

  const handleCopyCode = (code, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleClearHistory = () => {
    localStorage.removeItem('recent_rooms');
    setRecentRooms([]);
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 24px' }}>
      {kickedMessage && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '14px 18px',
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 'var(--radius-md)',
          color: '#ef4444',
          fontSize: '0.92rem',
          fontWeight: 600,
          marginBottom: '24px',
        }}>
          <AlertCircle size={20} />
          <span>{kickedMessage}</span>
        </div>
      )}

      {/* Welcome Banner */}
      <div className="card animate-fade-in" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '20px',
        marginBottom: '32px',
        background: 'linear-gradient(135deg, rgba(255, 0, 51, 0.08) 0%, rgba(24, 24, 32, 0.9) 100%)',
        borderColor: 'rgba(255, 0, 51, 0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <img
            src={user?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.username || 'user'}`}
            alt={user?.username}
            style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#fff', border: '2px solid var(--accent-red)' }}
          />
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '4px' }}>
              Welcome back, {user?.username}!
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              {user?.email}
            </p>
          </div>
        </div>

        <Link to="/create-room" className="btn btn-primary" style={{ padding: '12px 22px' }}>
          <Plus size={18} />
          <span>New Watch Party</span>
        </Link>
      </div>

      {/* Main Grid Actions */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '24px',
        marginBottom: '40px',
      }}>
        {/* Create Room Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(255, 0, 51, 0.1)',
              color: 'var(--accent-red)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
            }}>
              <Plus size={24} />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>
              Host a Watch Party
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px', lineHeight: 1.5 }}>
              Create a custom room, get a unique 6-character room code, and control video playback as the Host.
            </p>
          </div>
          <Link to="/create-room" className="btn btn-primary" style={{ width: '100%' }}>
            <span>Create Room</span>
            <ArrowRight size={16} />
          </Link>
        </div>

        {/* Join Room Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              color: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
            }}>
              <LogIn size={24} />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>
              Join With Code
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '16px', lineHeight: 1.5 }}>
              Enter a 6-character room code provided by a friend to join their watch party instantly.
            </p>
          </div>

          <form onSubmit={handleQuickJoin} style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              value={quickCode}
              onChange={(e) => setQuickCode(e.target.value.toUpperCase())}
              placeholder="e.g. WP9F2K"
              maxLength={8}
              style={{ textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}
              required
            />
            <button type="submit" className="btn btn-secondary" style={{ flexShrink: 0 }}>
              <span>Join</span>
            </button>
          </form>
        </div>
      </div>

      {/* Recent Rooms Section */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={18} color="var(--text-muted)" />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>
              Recent Watch Rooms
            </h2>
          </div>
          {recentRooms.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="btn btn-secondary"
              style={{ padding: '4px 10px', fontSize: '0.8rem', color: 'var(--text-muted)' }}
              title="Clear history"
            >
              <Trash2 size={14} />
              <span>Clear History</span>
            </button>
          )}
        </div>

        {recentRooms.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '16px',
          }}>
            {recentRooms.map((room) => (
              <div
                key={room.code}
                onClick={() => navigate(`/room/${room.code}`)}
                className="card"
                style={{
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '18px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{
                      fontWeight: 800,
                      fontSize: '1.1rem',
                      color: 'var(--accent-red)',
                      letterSpacing: '1px',
                    }}>
                      {room.code}
                    </span>
                    <button
                      onClick={(e) => handleCopyCode(room.code, e)}
                      title="Copy room code"
                      style={{ color: copiedCode === room.code ? 'var(--status-online)' : 'var(--text-muted)' }}
                    >
                      {copiedCode === room.code ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                  <h3 style={{ fontSize: '0.98rem', fontWeight: 600, marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {room.title || 'Watch Party Room'}
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {room.joinedAt ? new Date(room.joinedAt).toLocaleDateString() : 'Recent'}
                  </p>
                </div>

                <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--accent-red)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>Enter Room</span>
                    <ArrowRight size={14} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            <Tv size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            <p style={{ fontSize: '0.95rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>
              No recent watch parties yet.
            </p>
            <p style={{ fontSize: '0.85rem' }}>
              Create or join your first room to get started!
            </p>
          </div>
        )}
      </section>
    </div>
  );
};

export default Dashboard;
