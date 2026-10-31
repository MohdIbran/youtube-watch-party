import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';

/**
 * Official YouTube IFrame Player API wrapper with infinite-loop prevention
 * and real-time playback synchronization.
 */
const YouTubePlayer = forwardRef(({
  videoId,
  canControlPlayback,
  onLocalPlay,
  onLocalPause,
  onPlayerReady,
  onTimeUpdate,
}, ref) => {
  const playerContainerRef = useRef(null);
  const playerRef = useRef(null);

  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // Track the current loaded video ID to avoid redundant reloads
  const loadedVideoIdRef = useRef(videoId || 'dQw4w9WgXcQ');
  const initialVideoIdRef = useRef(videoId || 'dQw4w9WgXcQ');

  // Keep latest role control in ref so onStateChange always has the latest value without rebuilding player
  const canControlPlaybackRef = useRef(canControlPlayback);
  useEffect(() => {
    canControlPlaybackRef.current = canControlPlayback;
  }, [canControlPlayback]);

  // Store latest callbacks in ref to avoid stale closures in player event listeners
  const callbacksRef = useRef({ onLocalPlay, onLocalPause, onPlayerReady });
  useEffect(() => {
    callbacksRef.current = { onLocalPlay, onLocalPause, onPlayerReady };
  }, [onLocalPlay, onLocalPause, onPlayerReady]);

  // Flag to differentiate between remote socket updates and local user actions
  const isRemoteUpdateRef = useRef(false);
  const remoteTimerRef = useRef(null);

  // Helper to mark incoming commands as remote
  const markAsRemoteUpdate = () => {
    isRemoteUpdateRef.current = true;
    if (remoteTimerRef.current) clearTimeout(remoteTimerRef.current);
    remoteTimerRef.current = setTimeout(() => {
      isRemoteUpdateRef.current = false;
    }, 1200);
  };

  // Expose player methods to parent component (WatchRoom)
  useImperativeHandle(ref, () => ({
    playVideo: () => {
      if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
        markAsRemoteUpdate();
        playerRef.current.playVideo();
      }
    },
    pauseVideo: () => {
      if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
        markAsRemoteUpdate();
        playerRef.current.pauseVideo();
      }
    },
    seekTo: (seconds) => {
      if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
        markAsRemoteUpdate();
        playerRef.current.seekTo(seconds, true);
      }
    },
    loadVideoById: (newVideoId, startSeconds = 0) => {
      if (!newVideoId) return;
      loadedVideoIdRef.current = newVideoId;
      setLoadError(null);
      if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
        markAsRemoteUpdate();
        try {
          playerRef.current.loadVideoById({
            videoId: newVideoId,
            startSeconds: startSeconds || 0,
          });
        } catch {
          playerRef.current.loadVideoById(newVideoId, startSeconds || 0);
        }
      }
    },
    getCurrentTime: () => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        return playerRef.current.getCurrentTime() || 0;
      }
      return 0;
    },
    getDuration: () => {
      if (playerRef.current && typeof playerRef.current.getDuration === 'function') {
        return playerRef.current.getDuration() || 0;
      }
      return 0;
    },
    getPlayerState: () => {
      if (playerRef.current && typeof playerRef.current.getPlayerState === 'function') {
        return playerRef.current.getPlayerState();
      }
      return -1;
    },
  }));

  // Handle videoId prop updates: call loadVideoById without recreating the player
  useEffect(() => {
    if (!videoId) return;
    if (loadedVideoIdRef.current === videoId) return;
    loadedVideoIdRef.current = videoId;
    setLoadError(null);

    if (isReady && playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
      markAsRemoteUpdate();
      try {
        playerRef.current.loadVideoById({
          videoId,
          startSeconds: 0,
        });
      } catch {
        playerRef.current.loadVideoById(videoId, 0);
      }
    }
  }, [videoId, isReady]);

  // Initialize YouTube IFrame API script and create player once on mount
  useEffect(() => {
    let isMounted = true;

    const loadIframeAPI = () => {
      if (!window.YT) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        if (firstScriptTag && firstScriptTag.parentNode) {
          firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        } else {
          document.head.appendChild(tag);
        }
      }
    };

    const initPlayer = () => {
      if (!isMounted || !window.YT || !window.YT.Player || !playerContainerRef.current) return;

      try {
        playerRef.current = new window.YT.Player(playerContainerRef.current, {
          videoId: loadedVideoIdRef.current || videoId || 'dQw4w9WgXcQ',
          playerVars: {
            autoplay: 0,
            controls: canControlPlayback ? 1 : 0,
            disablekb: canControlPlayback ? 0 : 1, // Disable keyboard shortcuts for participants
            rel: 0,
            modestbranding: 1,
            enablejsapi: 1,
            origin: window.location.origin,
            playsinline: 1,
          },
          events: {
            onReady: (event) => {
              if (!isMounted) return;
              setIsReady(true);
              setLoadError(null);
              // If videoId was updated while API script was loading
              if (loadedVideoIdRef.current && loadedVideoIdRef.current !== initialVideoIdRef.current) {
                markAsRemoteUpdate();
                try {
                  event.target.loadVideoById({
                    videoId: loadedVideoIdRef.current,
                    startSeconds: 0,
                  });
                } catch {
                  event.target.loadVideoById(loadedVideoIdRef.current, 0);
                }
              }
              if (callbacksRef.current.onPlayerReady) {
                callbacksRef.current.onPlayerReady(event.target);
              }
            },
            onStateChange: (event) => {
              if (!isMounted) return;

              // If this state change was caused by a remote socket event, ignore it to prevent loops!
              if (isRemoteUpdateRef.current) {
                return;
              }

              const currentTime = event.target.getCurrentTime();

              // Host / Moderator local actions trigger socket broadcasts
              if (canControlPlaybackRef.current) {
                if (event.data === window.YT.PlayerState.PLAYING) {
                  if (callbacksRef.current.onLocalPlay) {
                    callbacksRef.current.onLocalPlay(currentTime);
                  }
                } else if (event.data === window.YT.PlayerState.PAUSED) {
                  if (callbacksRef.current.onLocalPause) {
                    callbacksRef.current.onLocalPause(currentTime);
                  }
                }
              }
            },
            onError: (err) => {
              console.warn('[YouTube Player] Error:', err.data);
              setLoadError(`Playback error (${err.data}). The video may be restricted.`);
            },
          },
        });
      } catch (e) {
        console.error('[YouTube Player] Init Exception:', e);
        setLoadError('Failed to initialize YouTube player.');
      }
    };

    loadIframeAPI();

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevCallback) prevCallback();
        initPlayer();
      };
    }

    return () => {
      isMounted = false;
      if (remoteTimerRef.current) clearTimeout(remoteTimerRef.current);
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore destroy errors
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Periodic time update ticker (every 500ms)
  useEffect(() => {
    const interval = setInterval(() => {
      if (playerRef.current && isReady && onTimeUpdate) {
        try {
          const time = playerRef.current.getCurrentTime() || 0;
          const duration = playerRef.current.getDuration() || 0;
          onTimeUpdate(time, duration);
        } catch {
          // player might not be ready yet
        }
      }
    }, 500);

    return () => clearInterval(interval);
  }, [isReady, onTimeUpdate]);

  return (
    <div style={{ position: 'relative', width: '100%', borderRadius: 'var(--radius-lg)', overflow: 'hidden', backgroundColor: '#000' }}>
      {/* 16:9 Aspect Ratio Container */}
      <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, width: '100%' }}>
        <div
          ref={playerContainerRef}
          data-video-id={videoId}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
          }}
        />

        {/* Watch-Only Overlay for Participants: Prevents direct player clicks */}
        {!canControlPlayback && isReady && (
          <div
            title="Watch-only mode: direct player control is disabled for participants"
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 10,
              cursor: 'not-allowed',
              backgroundColor: 'transparent',
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          />
        )}

        {!isReady && !loadError && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            backgroundColor: 'rgba(15, 15, 19, 0.95)',
            color: 'var(--text-secondary)',
          }}>
            <Loader2 className="animate-spin" size={36} color="var(--accent-red)" />
            <span style={{ fontSize: '0.9rem' }}>Loading YouTube Player...</span>
          </div>
        )}

        {loadError && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            backgroundColor: 'rgba(15, 15, 19, 0.95)',
            color: '#ef4444',
            padding: '20px',
            textAlign: 'center',
          }}>
            <AlertCircle size={36} />
            <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>{loadError}</span>
          </div>
        )}
      </div>
    </div>
  );
});

export default YouTubePlayer;
