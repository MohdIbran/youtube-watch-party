import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Play, Users, Shield, Zap, Sparkles, ArrowRight } from 'lucide-react';

const Home = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 24px' }}>
      {/* Hero Section */}
      <section style={{
        textAlign: 'center',
        padding: '60px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 16px',
          backgroundColor: 'rgba(255, 0, 51, 0.1)',
          color: 'var(--accent-red)',
          borderRadius: 'var(--radius-full)',
          fontSize: '0.85rem',
          fontWeight: 600,
          marginBottom: '20px',
          border: '1px solid rgba(255, 0, 51, 0.25)',
        }}>
          <Sparkles size={16} />
          <span>Real-time YouTube Synchronization</span>
        </div>

        <h1 style={{
          fontSize: 'clamp(2.5rem, 5vw, 4rem)',
          fontWeight: 900,
          letterSpacing: '-1.5px',
          lineHeight: 1.15,
          marginBottom: '20px',
          maxWidth: '840px',
        }}>
          Watch YouTube Together, <br />
          <span style={{
            background: 'linear-gradient(135deg, #ff0033 0%, #ff6b8b 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            In Perfect Harmony.
          </span>
        </h1>

        <p style={{
          fontSize: '1.15rem',
          color: 'var(--text-secondary)',
          maxWidth: '620px',
          marginBottom: '36px',
          lineHeight: 1.6,
        }}>
          Create a private room, invite friends with a code, and enjoy movies, music, and streams with synchronized play, pause, seek, and role-based controls.
        </p>

        {/* Hero Action Buttons */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {isAuthenticated ? (
            <>
              <Link to="/create-room" className="btn btn-primary" style={{ padding: '14px 28px', fontSize: '1.05rem' }}>
                <Play size={18} fill="#fff" />
                <span>Create Watch Party</span>
              </Link>
              <Link to="/join-room" className="btn btn-secondary" style={{ padding: '14px 28px', fontSize: '1.05rem' }}>
                <span>Join with Room Code</span>
                <ArrowRight size={18} />
              </Link>
            </>
          ) : (
            <>
              <Link to="/register" className="btn btn-primary" style={{ padding: '14px 28px', fontSize: '1.05rem' }}>
                <span>Get Started Free</span>
                <ArrowRight size={18} />
              </Link>
              <Link to="/login" className="btn btn-secondary" style={{ padding: '14px 28px', fontSize: '1.05rem' }}>
                <span>Sign In</span>
              </Link>
            </>
          )}
        </div>
      </section>

      {/* Features Grid */}
      <section style={{ marginTop: '40px', paddingTop: '40px', borderTop: '1px solid var(--border-color)' }}>
        <h2 style={{ textAlign: 'center', fontSize: '1.8rem', fontWeight: 800, marginBottom: '36px' }}>
          Built for Seamless Watch Parties
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '24px',
        }}>
          {/* Feature 1 */}
          <div className="card">
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
              <Zap size={22} />
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '8px' }}>
              Lockstep Synchronization
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.6 }}>
              Socket.IO powered instant video synchronization for play, pause, seek, and video changes with dynamic elapsed-time calculation.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="card">
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
              <Shield size={22} />
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '8px' }}>
              Host & Moderator Roles
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.6 }}>
              Strict role-based permissions verified on the backend. Only Hosts and assigned Moderators have direct playback authority.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="card">
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
            }}>
              <Users size={22} />
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '8px' }}>
              Participant Approval System
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.6 }}>
              Participants can suggest video swaps, skips, or pauses. Host and Moderators can approve or reject requests in real-time.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
