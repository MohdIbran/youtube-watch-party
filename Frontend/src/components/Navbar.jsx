import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Tv, Plus, LogIn, LogOut, User, Compass } from 'lucide-react';

const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header style={{
      backgroundColor: 'var(--bg-glass)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border-color)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
      }}>
        {/* Brand Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            backgroundColor: 'var(--accent-red)',
            color: '#fff',
            padding: '6px 10px',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 10px var(--accent-red-glow)',
          }}>
            <Tv size={20} strokeWidth={2.5} />
          </div>
          <span style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.5px' }}>
            Watch<span style={{ color: 'var(--accent-red)' }}>Party</span>
          </span>
        </Link>

        {/* Right Actions */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isAuthenticated ? (
            <>
              <Link to="/dashboard" className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '0.88rem' }}>
                <Compass size={16} />
                <span>Dashboard</span>
              </Link>
              <Link to="/create-room" className="btn btn-primary" style={{ padding: '8px 14px', fontSize: '0.88rem' }}>
                <Plus size={16} />
                <span>Create Room</span>
              </Link>

              {/* User Profile Chip */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 10px 4px 4px',
                backgroundColor: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--border-color)',
              }}>
                <img
                  src={user?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.username || 'user'}`}
                  alt={user?.username}
                  style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#fff' }}
                />
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {user?.username}
                </span>
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="btn btn-secondary"
                title="Log Out"
                style={{ padding: '8px 12px', fontSize: '0.88rem' }}
              >
                <LogOut size={16} color="var(--text-muted)" />
                <span style={{ color: 'var(--text-secondary)' }}>Logout</span>
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.88rem' }}>
                <LogIn size={16} />
                <span>Login</span>
              </Link>
              <Link to="/register" className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.88rem' }}>
                <User size={16} />
                <span>Register</span>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Navbar;
