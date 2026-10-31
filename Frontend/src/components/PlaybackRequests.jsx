import React, { useState } from 'react';
import { Hand, Check, X, Play, Pause, FastForward, Film, AlertCircle } from 'lucide-react';
import { formatTime, extractYouTubeId } from '../utils/youtube';

const PlaybackRequests = ({
  requests = [],
  canControlPlayback,
  onApprove,
  onReject,
  onSubmitRequest,
  showModal,
  onCloseModal,
}) => {
  const [reqType, setReqType] = useState('seek');
  const [seekSeconds, setSeekSeconds] = useState(30);
  const [videoUrl, setVideoUrl] = useState('');
  const [modalError, setModalError] = useState('');

  const pendingRequests = requests.filter((r) => r.status === 'pending');

  const handleModalSubmit = (e) => {
    e.preventDefault();
    setModalError('');

    let payload = {};
    if (reqType === 'seek') {
      const parsed = parseFloat(seekSeconds);
      if (isNaN(parsed) || parsed < 0) {
        setModalError('Please enter a valid positive number for seconds.');
        return;
      }
      payload.currentTime = parsed;
    } else if (reqType === 'change_video') {
      const vidId = extractYouTubeId(videoUrl);
      if (!vidId) {
        setModalError('Please enter a valid YouTube video URL or 11-char ID.');
        return;
      }
      payload.videoId = vidId;
      payload.title = 'YouTube Video';
      payload.videoTitle = 'YouTube Video';
    }

    onSubmitRequest({
      type: reqType,
      payload,
    });
    onCloseModal();
  };

  const getRequestIcon = (type) => {
    switch (type) {
      case 'play':
        return <Play size={14} color="#10b981" />;
      case 'pause':
        return <Pause size={14} color="#ef4444" />;
      case 'seek':
        return <FastForward size={14} color="#3b82f6" />;
      case 'change_video':
        return <Film size={14} color="#a855f7" />;
      default:
        return <Hand size={14} />;
    }
  };

  return (
    <>
      <div className="card" style={{ padding: '20px', marginTop: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Hand size={18} color="#f59e0b" />
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Playback Requests</h3>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {pendingRequests.length} pending
          </span>
        </div>

        {/* Requests List */}
        {requests.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '220px', overflowY: 'auto' }}>
            {requests.slice(-8).reverse().map((req, index) => {
              const userObj = req.user || {};
              const isPending = req.status === 'pending';
              const reqKey = req._id ? req._id.toString() : `req-${index}`;

              return (
                <div
                  key={reqKey}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-tertiary)',
                    border: isPending ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid transparent',
                  }}
                >
                  {/* Left: Info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <div style={{
                      padding: '6px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      display: 'flex',
                    }}>
                      {getRequestIcon(req.type)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                        <span>{userObj.username || 'User'}</span>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> requested </span>
                        <strong style={{ color: 'var(--text-primary)' }}>{req.type.replace('_', ' ')}</strong>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {req.type === 'seek' && `to ${formatTime(req.payload?.currentTime)}`}
                        {req.type === 'change_video' && `video: ${req.payload?.videoId}`}
                        {req.type === 'play' && 'to resume playback'}
                        {req.type === 'pause' && 'to pause video'}
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions or Status */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {isPending ? (
                      canControlPlayback ? (
                        <>
                          <button
                            onClick={() => onApprove(req._id)}
                            className="btn btn-success"
                            title="Approve request"
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          >
                            <Check size={14} />
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => onReject(req._id)}
                            className="btn btn-danger"
                            title="Reject request"
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          >
                            <X size={14} />
                            <span>Reject</span>
                          </button>
                        </>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--status-pending)', fontWeight: 600 }}>
                          Pending Review
                        </span>
                      )
                    ) : (
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: req.status === 'approved' ? 'var(--status-approved)' : 'var(--status-rejected)',
                      }}>
                        {req.status}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
            No playback change requests yet.
          </p>
        )}
      </div>

      {/* Request Modal for Participants */}
      {showModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px',
        }}>
          <div className="card animate-fade-in" style={{ maxWidth: '440px', width: '100%', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Hand size={20} color="#f59e0b" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Request Playback Change</h3>
              </div>
              <button onClick={onCloseModal} style={{ color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '18px' }}>
              As a participant, your request will be reviewed by the Host or Moderator before taking effect.
            </p>

            {modalError && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 12px',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                borderRadius: 'var(--radius-md)',
                color: '#ef4444',
                fontSize: '0.85rem',
                marginBottom: '16px',
              }}>
                <AlertCircle size={16} />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleModalSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Action Type
                </label>
                <select
                  value={reqType}
                  onChange={(e) => setReqType(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="seek">Seek to Time (Seconds)</option>
                  <option value="play">Resume Video (Play)</option>
                  <option value="pause">Pause Video</option>
                  <option value="change_video">Suggest New YouTube Video</option>
                </select>
              </div>

              {reqType === 'seek' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                    Target Time in Seconds
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={seekSeconds}
                    onChange={(e) => setSeekSeconds(e.target.value)}
                    placeholder="e.g. 45"
                    required
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Target: {formatTime(parseFloat(seekSeconds) || 0)}
                  </span>
                </div>
              )}

              {reqType === 'change_video' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                    YouTube Video URL or ID
                  </label>
                  <input
                    type="text"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    required
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button type="button" onClick={onCloseModal} className="btn btn-secondary" style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default PlaybackRequests;
