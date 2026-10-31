import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import roomService from '../services/roomService';
import { Tv, Sparkles, Copy, Check, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

const CreateRoom = () => {
  const [formData, setFormData] = useState({
    title: 'My Watch Party',
    initialVideoId: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    initialVideoTitle: 'Rick Astley - Never Gonna Give You Up',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdRoom, setCreatedRoom] = useState(null);
  const [copied, setCopied] = useState(false);

  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
    if (error) setError('');
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError('Please provide a room title.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await roomService.createRoom(formData);
      if (res.success && res.data && res.data.room) {
        const room = res.data.room;
        setCreatedRoom(room);

        // Store into local recent rooms history
        try {
          const stored = localStorage.getItem('recent_rooms');
          const list = stored ? JSON.parse(stored) : [];
          const updated = [
            { code: room.roomCode, title: room.title, joinedAt: new Date().toISOString() },
            ...list.filter((r) => r.code !== room.roomCode),
          ].slice(0, 10);
          localStorage.setItem('recent_rooms', JSON.stringify(updated));
        } catch {
          // ignore localStorage error
        }
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to create room.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (!createdRoom) return;
    const shareUrl = `${window.location.origin}/room/${createdRoom.roomCode}`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      minHeight: 'calc(100vh - 80px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
    }}>
      <div className="card animate-fade-in" style={{ maxWidth: '480px', width: '100%' }}>
        {!createdRoom ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 0, 51, 0.1)',
                color: 'var(--accent-red)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '12px',
              }}>
                <Tv size={26} />
              </div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '6px' }}>
                Create a Watch Party
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Set up your room, invite friends, and enjoy synchronized playback.
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

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  Room Title
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="e.g. Anime Night, Lo-fi Chill"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  Initial YouTube Video URL or ID (Optional)
                </label>
                <input
                  type="text"
                  name="initialVideoId"
                  value={formData.initialVideoId}
                  onChange={handleChange}
                  placeholder="https://www.youtube.com/watch?v=..."
                />
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Supports full URLs (watch?v=, youtu.be/) or direct 11-char IDs.
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  Video Label / Title (Optional)
                </label>
                <input
                  type="text"
                  name="initialVideoTitle"
                  value={formData.initialVideoTitle}
                  onChange={handleChange}
                  placeholder="e.g. Welcome Video"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px', marginTop: '10px' }}
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    <span>Creating Room...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    <span>Generate Room</span>
                  </>
                )}
              </button>
            </form>
          </>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              color: 'var(--status-online)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
            }}>
              <Check size={32} />
            </div>

            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '6px' }}>
              Room Ready!
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px' }}>
              Your watch party "{createdRoom.title}" has been created.
            </p>

            {/* Room Code Display */}
            <div style={{
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px',
              marginBottom: '20px',
            }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>
                Unique Room Code
              </span>
              <div style={{
                fontSize: '2.5rem',
                fontWeight: 900,
                letterSpacing: '4px',
                color: 'var(--accent-red)',
                margin: '8px 0',
                fontFamily: 'monospace',
              }}>
                {createdRoom.roomCode}
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Share this 6-character code with your friends to join.
              </p>
            </div>

            {/* Copy Link Action */}
            <button
              onClick={handleCopyLink}
              className="btn btn-secondary"
              style={{ width: '100%', padding: '12px', marginBottom: '12px' }}
            >
              {copied ? (
                <>
                  <Check size={18} color="var(--status-online)" />
                  <span style={{ color: 'var(--status-online)' }}>Invite Link Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={18} />
                  <span>Copy Invite Link</span>
                </>
              )}
            </button>

            {/* Enter Room Action */}
            <button
              onClick={() => navigate(`/room/${createdRoom.roomCode}`)}
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px' }}
            >
              <span>Enter Watch Room</span>
              <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateRoom;
