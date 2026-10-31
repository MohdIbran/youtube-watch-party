import React from 'react';
import { Play, Pause, RotateCcw, RotateCw, Hand, Lock } from 'lucide-react';
import { formatTime } from '../utils/youtube';

const PlaybackControls = ({
  isPlaying,
  currentTime,
  duration,
  canControlPlayback,
  onPlay,
  onPause,
  onSeek,
  onRequestChange,
}) => {
  const handleSliderChange = (e) => {
    if (!canControlPlayback) return;
    const newTime = parseFloat(e.target.value);
    onSeek(newTime);
  };

  const handleSkip = (seconds) => {
    if (!canControlPlayback) return;
    const target = Math.max(0, Math.min(duration, currentTime + seconds));
    onSeek(target);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="card" style={{ padding: '16px 20px', marginTop: '16px' }}>
      {/* Progress Bar & Timestamps */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', minWidth: '45px', textAlign: 'right', fontFamily: 'monospace' }}>
          {formatTime(currentTime)}
        </span>

        <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input
            type="range"
            min="0"
            max={duration || 100}
            step="0.5"
            value={currentTime || 0}
            onChange={handleSliderChange}
            disabled={!canControlPlayback}
            style={{
              width: '100%',
              cursor: canControlPlayback ? 'pointer' : 'not-allowed',
              accentColor: 'var(--accent-red)',
              height: '6px',
              padding: 0,
              background: `linear-gradient(to right, var(--accent-red) ${progressPercent}%, var(--bg-tertiary) ${progressPercent}%)`,
              borderRadius: 'var(--radius-full)',
              border: 'none',
            }}
          />
        </div>

        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', minWidth: '45px', fontFamily: 'monospace' }}>
          {formatTime(duration)}
        </span>
      </div>

      {/* Main Control Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        {/* Playback Controls (Host / Moderator) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {canControlPlayback ? (
            <>
              <button
                onClick={() => handleSkip(-10)}
                className="btn btn-secondary"
                title="Rewind 10 seconds"
                style={{ padding: '8px 12px' }}
              >
                <RotateCcw size={16} />
                <span style={{ fontSize: '0.78rem' }}>10s</span>
              </button>

              <button
                onClick={isPlaying ? onPause : onPlay}
                className="btn btn-primary"
                style={{ padding: '10px 18px', borderRadius: 'var(--radius-md)' }}
              >
                {isPlaying ? (
                  <>
                    <Pause size={18} fill="#fff" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play size={18} fill="#fff" />
                    <span>Play</span>
                  </>
                )}
              </button>

              <button
                onClick={() => handleSkip(10)}
                className="btn btn-secondary"
                title="Forward 10 seconds"
                style={{ padding: '8px 12px' }}
              >
                <RotateCw size={16} />
                <span style={{ fontSize: '0.78rem' }}>10s</span>
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              <Lock size={16} />
              <span>Playback is managed by the Host and Moderators.</span>
            </div>
          )}
        </div>

        {/* Participant Request Button */}
        {!canControlPlayback && (
          <button
            onClick={onRequestChange}
            className="btn btn-secondary"
            style={{
              padding: '8px 16px',
              fontSize: '0.88rem',
              borderColor: 'rgba(245, 158, 11, 0.4)',
              color: '#f59e0b',
            }}
          >
            <Hand size={16} />
            <span>Request Playback Change</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default PlaybackControls;
