import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import roomService from '../services/roomService';
import { LogIn, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

const JoinRoom = () => {
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();

  const handleJoin = async (e) => {
    e.preventDefault();
    const cleanCode = roomCode.trim().toUpperCase();
    if (!cleanCode) {
      setError('Please enter a room code.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await roomService.joinRoom(cleanCode);
      if (res.success) {
        // Save to recent rooms
        try {
          const stored = localStorage.getItem('recent_rooms');
          const list = stored ? JSON.parse(stored) : [];
          const updated = [
            {
              code: cleanCode,
              title: res.data?.room?.title || 'Watch Party',
              joinedAt: new Date().toISOString(),
            },
            ...list.filter((r) => r.code !== cleanCode),
          ].slice(0, 10);
          localStorage.setItem('recent_rooms', JSON.stringify(updated));
        } catch {
          // ignore localStorage error
        }

        navigate(`/room/${cleanCode}`);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Room not found or no longer active.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: 'calc(100vh - 80px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
    }}>
      <div className="card animate-fade-in" style={{ maxWidth: '420px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            color: '#3b82f6',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '12px',
          }}>
            <LogIn size={26} />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '6px' }}>
            Join a Watch Party
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Enter the 6-character room code to join the party.
          </p>
        </div>

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 14px',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: '#ef4444',
            fontSize: '0.88rem',
            marginBottom: '20px',
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
              Room Code
            </label>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => {
                setRoomCode(e.target.value.toUpperCase());
                if (error) setError('');
              }}
              placeholder="e.g. WP9F2K"
              maxLength={8}
              required
              style={{
                textAlign: 'center',
                fontSize: '1.4rem',
                fontWeight: 800,
                letterSpacing: '3px',
                padding: '12px',
                fontFamily: 'monospace',
                textTransform: 'uppercase',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !roomCode.trim()}
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', marginTop: '6px' }}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                <span>Joining Room...</span>
              </>
            ) : (
              <>
                <span>Join Room</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default JoinRoom;
