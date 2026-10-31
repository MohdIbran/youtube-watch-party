import React from 'react';
import { Users, Shield, UserMinus, Crown } from 'lucide-react';

const ParticipantList = ({
  participants = [],
  currentUserId,
  currentUserRole,
  onAssignRole,
  onRemoveParticipant,
}) => {
  const isHost = currentUserRole === 'host';
  const isModerator = currentUserRole === 'moderator';

  // Ensure each participant is rendered only once
  const uniqueParticipants = [];
  const seenIds = new Set();
  const seenNames = new Set();

  for (const p of participants) {
    if (!p) continue;
    const userObj = p.user || {};
    const userId = (userObj._id || userObj.id || (typeof p.user === 'string' ? p.user : null))?.toString();
    const username = (userObj.username || '')?.toLowerCase();

    if (userId && seenIds.has(userId)) continue;
    if (username && seenNames.has(username)) continue;

    if (userId) seenIds.add(userId);
    if (username) seenNames.add(username);
    uniqueParticipants.push(p);
  }

  const onlineCount = uniqueParticipants.filter((p) => p.isOnline).length;

  return (
    <div className="card" style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={18} color="var(--accent-red)" />
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Participants</h2>
        </div>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          <strong style={{ color: 'var(--status-online)' }}>{onlineCount}</strong> / {uniqueParticipants.length} online
        </span>
      </div>

      {/* Participants List */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '420px', paddingRight: '4px' }}>
        {uniqueParticipants.map((p, index) => {
          const userObj = p.user || {};
          const userId = userObj._id || userObj.id || p.user;
          const isSelf = userId?.toString() === currentUserId?.toString();
          const pRole = p.role || 'participant';
          const participantKey = userId ? userId.toString() : (userObj.username ? `p-${userObj.username}` : `p-${index}`);

          return (
            <div
              key={participantKey}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 10px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: isSelf ? 'rgba(255, 0, 51, 0.05)' : 'var(--bg-tertiary)',
                border: isSelf ? '1px solid rgba(255, 0, 51, 0.2)' : '1px solid transparent',
              }}
            >
              {/* Left: Avatar + Username + Status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <div style={{ position: 'relative' }}>
                  <img
                    src={userObj.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${userObj.username || 'user'}`}
                    alt={userObj.username}
                    style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#fff' }}
                  />
                  <span
                    className={`status-dot ${p.isOnline ? 'status-online' : 'status-offline'}`}
                    style={{
                      position: 'absolute',
                      bottom: '-1px',
                      right: '-1px',
                      border: '2px solid var(--bg-secondary)',
                    }}
                    title={p.isOnline ? 'Online' : 'Offline'}
                  />
                </div>

                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      color: isSelf ? 'var(--text-primary)' : 'var(--text-secondary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {userObj.username || 'User'}
                    </span>
                    {isSelf && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>(You)</span>
                    )}
                  </div>
                  <div style={{ marginTop: '2px' }}>
                    <span className={`badge badge-${pRole}`} style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                      {pRole === 'host' && <Crown size={10} style={{ marginRight: '3px' }} />}
                      {pRole}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: Moderation Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                {/* Host can promote/demote */}
                {isHost && !isSelf && pRole !== 'host' && (
                  <button
                    onClick={() => onAssignRole(userId, pRole === 'moderator' ? 'participant' : 'moderator')}
                    className="btn btn-secondary"
                    title={pRole === 'moderator' ? 'Demote to Participant' : 'Promote to Moderator'}
                    style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  >
                    <Shield size={13} color={pRole === 'moderator' ? '#3b82f6' : 'var(--text-muted)'} />
                    <span>{pRole === 'moderator' ? 'Demote' : 'Make Mod'}</span>
                  </button>
                )}

                {/* Host or Moderator can kick */}
                {!isSelf && pRole !== 'host' && (isHost || (isModerator && pRole === 'participant')) && (
                  <button
                    onClick={() => onRemoveParticipant(userId)}
                    className="btn btn-danger"
                    title="Remove from room"
                    style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  >
                    <UserMinus size={13} />
                    <span>Kick</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ParticipantList;
