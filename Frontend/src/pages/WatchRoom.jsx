import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import roomService from '../services/roomService';
import YouTubePlayer from '../components/YouTubePlayer';
import PlaybackControls from '../components/PlaybackControls';
import ParticipantList from '../components/ParticipantList';
import PlaybackRequests from '../components/PlaybackRequests';
import ChatSection from '../components/ChatSection';
import { extractYouTubeId } from '../utils/youtube';
import {
  Copy,
  Check,
  LogOut,
  Radio,
  AlertCircle,
  Loader2,
  Crown,
  Shield,
  User,
  Film,
  X,
  CheckCircle,
} from 'lucide-react';

// Helper to safely extract user ID across populated object, socket payload, or string ID
const getUserId = (userOrParticipant) => {
  if (!userOrParticipant) return null;
  const target = userOrParticipant.user !== undefined ? userOrParticipant.user : userOrParticipant;
  if (!target) return null;
  if (typeof target === 'string') return target;
  if (target._id) return target._id.toString();
  if (target.id) return target.id.toString();
  if (typeof target.toString === 'function' && target.toString() !== '[object Object]') {
    return target.toString();
  }
  return null;
};

// Helper to safely extract username across populated object, socket payload, or user object
const getUsername = (userOrParticipant) => {
  if (!userOrParticipant) return null;
  const target = userOrParticipant.user !== undefined ? userOrParticipant.user : userOrParticipant;
  if (!target || typeof target !== 'object') return null;
  return target.username || null;
};

// Deduplicate participant list by ID and username
const deduplicateParticipants = (list = []) => {
  const seenIds = new Set();
  const seenUsernames = new Set();
  const result = [];

  for (const p of list) {
    if (!p) continue;
    const uid = getUserId(p);
    const uname = getUsername(p);

    if (uid && seenIds.has(uid)) continue;
    if (uname && seenUsernames.has(uname.toLowerCase())) continue;

    if (uid) seenIds.add(uid);
    if (uname) seenUsernames.add(uname.toLowerCase());
    result.push(p);
  }
  return result;
};

const WatchRoom = () => {
  const { roomCode: rawCode } = useParams();
  const roomCode = rawCode ? rawCode.toUpperCase().trim() : '';

  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const navigate = useNavigate();

  // Room & Playback State
  const [room, setRoom] = useState(null);
  const [currentVideo, setCurrentVideo] = useState({
    videoId: 'dQw4w9WgXcQ',
    title: 'Welcome Video',
    duration: 0,
  });
  const [playbackState, setPlaybackState] = useState({
    isPlaying: false,
    currentTime: 0,
  });
  const [participants, setParticipants] = useState([]);
  const [requests, setRequests] = useState([]);
  const [myRole, setMyRole] = useState('participant');

  // Real-Time Chat State
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(true);

  // UI State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState(null);
  const [copied, setCopied] = useState(false);
  const [videoInput, setVideoInput] = useState('');
  const [showChangeVideoModal, setShowChangeVideoModal] = useState(false);
  const [videoInputError, setVideoInputError] = useState('');
  const [videoInputSuccess, setVideoInputSuccess] = useState('');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [duration, setDuration] = useState(0);

  // Player ref & User ref for reliable non-stale callbacks
  const playerRef = useRef(null);
  const toastTimeoutRef = useRef(null);
  const userRef = useRef(user);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const myUserId = getUserId(user);
  const myUsername = getUsername(user) || user?.username;

  const getMyUserId = useCallback(() => getUserId(userRef.current), []);
  const getMyUsername = useCallback(() => getUsername(userRef.current) || userRef.current?.username, []);

  const canControlPlayback = myRole === 'host' || myRole === 'moderator';

  // Helper to show transient toast alerts
  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  }, []);

  // 1. Initial Room Data Fetching via REST
  useEffect(() => {
    let isMounted = true;

    const fetchRoom = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await roomService.getRoom(roomCode);
        if (!isMounted) return;

        if (res.success && res.data) {
          const roomData = res.data.room;
          const syncData = res.data.syncState;

          setRoom(roomData);
          setCurrentVideo(roomData.currentVideo);
          setPlaybackState(syncData.playbackState || roomData.playbackState);
          setParticipants(deduplicateParticipants(roomData.participants || []));
          setRequests(roomData.requests || []);

          // Find current user's role
          const found = roomData.participants.find(
            (p) => (p.user?._id || p.user?.id || p.user)?.toString() === user?._id?.toString()
          );
          if (found) {
            setMyRole(found.role);
          }
        }

        // Fetch recent chat history
        try {
          setMessagesLoading(true);
          const msgRes = await roomService.getMessages(roomCode);
          if (isMounted && msgRes.success && Array.isArray(msgRes.data?.messages)) {
            setMessages(msgRes.data.messages);
          }
        } catch (msgErr) {
          console.warn('Could not load chat messages:', msgErr.message);
        } finally {
          if (isMounted) setMessagesLoading(false);
        }
      } catch (err) {
        if (!isMounted) return;
        setError(err.response?.data?.message || err.message || 'Room not found.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchRoom();

    return () => {
      isMounted = false;
    };
  }, [roomCode, user?._id]);

  // 2. Socket.IO Room Joining & Event Listeners
  useEffect(() => {
    if (!socket || !roomCode) return;

    // Join room function used on initial connect and on socket reconnects
    const joinRoomSocket = () => {
      socket.emit('join_room', { roomCode }, (res) => {
        if (res && res.success && res.data) {
          if (res.data.role) setMyRole(res.data.role);
          if (res.data.room?.participants) {
            setParticipants(deduplicateParticipants(res.data.room.participants));
          }
          if (res.data.syncState) {
            const sync = res.data.syncState;
            setCurrentVideo(sync.currentVideo);
            setPlaybackState(sync.playbackState);
          }
        }
      });
    };

    if (socket.connected) {
      joinRoomSocket();
    }
    socket.on('connect', joinRoomSocket);

    // Event: sync_state
    const handleSyncState = (data) => {
      if (!data) return;
      if (data.currentVideo) {
        setCurrentVideo((prev) => {
          if (data.currentVideo.videoId && data.currentVideo.videoId !== prev.videoId) {
            if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
              playerRef.current.loadVideoById(data.currentVideo.videoId, data.playbackState?.currentTime || 0);
            }
          }
          return {
            ...prev,
            ...data.currentVideo,
            title: data.currentVideo.title || data.currentVideo.videoTitle || prev.title,
          };
        });
      }
      if (data.playbackState) {
        setPlaybackState(data.playbackState);
        // Sync player position if drift is more than 2.5 seconds
        if (playerRef.current) {
          const localTime = playerRef.current.getCurrentTime();
          const targetTime = data.playbackState.currentTime;
          if (Math.abs(localTime - targetTime) > 2.5) {
            playerRef.current.seekTo(targetTime);
          }
          if (data.playbackState.isPlaying) {
            playerRef.current.playVideo();
          } else {
            playerRef.current.pauseVideo();
          }
        }
      }
      if (data.myRole) setMyRole(data.myRole);
    };

    // Event: user_joined
    const handleUserJoined = (data) => {
      if (!data || !data.user) return;
      const newUserId = getUserId(data.user);
      const newUsername = getUsername(data.user) || data.user.username;
      const myId = getMyUserId();
      const myUsername = getMyUsername();

      // Do not show joined toast to self
      const isSelf = Boolean(
        (newUserId && myId && newUserId === myId) ||
        (newUsername && myUsername && newUsername.toLowerCase() === myUsername.toLowerCase())
      );

      if (!isSelf) {
        showToast(`${newUsername || 'A user'} joined the party`);
      }

      setParticipants((prev) => {
        let matched = false;
        const updated = prev.map((p) => {
          const pId = getUserId(p);
          const pName = getUsername(p);
          const isMatch = (pId && newUserId && pId === newUserId) ||
                          (pName && newUsername && pName.toLowerCase() === newUsername.toLowerCase());
          if (isMatch) {
            matched = true;
            return {
              ...p,
              isOnline: true,
              role: data.role || p.role,
              user: typeof p.user === 'object' ? { ...p.user, ...data.user } : data.user,
            };
          }
          return p;
        });

        if (matched) {
          return deduplicateParticipants(updated);
        }

        return deduplicateParticipants([
          ...updated,
          { user: data.user, role: data.role || 'participant', isOnline: true },
        ]);
      });
    };

    // Event: user_left
    const handleUserLeft = (data) => {
      if (!data) return;
      const targetUserId = (data.userId || data.user?._id || data.user?.id)?.toString();
      const targetUsername = data.username || data.user?.username;
      const myId = getMyUserId();
      const myUsername = getMyUsername();

      // Do NOT show leave toast to the user who left
      const isSelf = Boolean(
        (targetUserId && myId && targetUserId === myId) ||
        (targetUsername && myUsername && targetUsername.toLowerCase() === myUsername.toLowerCase())
      );

      if (!isSelf) {
        showToast(`${targetUsername || 'A user'} left the party`);
      }

      setParticipants((prev) =>
        prev.map((p) => {
          const pId = getUserId(p);
          const pName = getUsername(p);
          const isMatch = (pId && targetUserId && pId === targetUserId) ||
                          (pName && targetUsername && pName.toLowerCase() === targetUsername.toLowerCase());
          if (isMatch) {
            return { ...p, isOnline: false };
          }
          return p;
        })
      );
    };

    // Event: error (from backend socket rejection)
    const handleSocketError = (err) => {
      const msg = err?.message || 'Permission denied or socket error.';
      showToast(msg);
    };

    // Event: play
    const handlePlay = (data) => {
      setPlaybackState((prev) => ({ ...prev, isPlaying: true, currentTime: data.currentTime }));
      if (playerRef.current) {
        if (typeof data.currentTime === 'number') {
          playerRef.current.seekTo(data.currentTime);
        }
        playerRef.current.playVideo();
      }
      if (data.updatedBy) showToast(`${data.updatedBy} resumed video`);
    };

    // Event: pause
    const handlePause = (data) => {
      setPlaybackState((prev) => ({ ...prev, isPlaying: false, currentTime: data.currentTime }));
      if (playerRef.current) {
        if (typeof data.currentTime === 'number') {
          playerRef.current.seekTo(data.currentTime);
        }
        playerRef.current.pauseVideo();
      }
      if (data.updatedBy) showToast(`${data.updatedBy} paused video`);
    };

    // Event: seek
    const handleSeek = (data) => {
      setPlaybackState((prev) => ({ ...prev, currentTime: data.currentTime }));
      if (playerRef.current) {
        playerRef.current.seekTo(data.currentTime);
      }
      if (data.updatedBy) showToast(`${data.updatedBy} seeked to ${Math.round(data.currentTime)}s`);
    };

    // Event: change_video
    const handleChangeVideoEvent = (data) => {
      if (!data || !data.videoId) return;
      const newVideoId = data.videoId;
      const newTitle = data.title || data.videoTitle || 'YouTube Video';
      setCurrentVideo({
        videoId: newVideoId,
        title: newTitle,
        duration: 0,
      });
      setPlaybackState((prev) => ({
        ...prev,
        isPlaying: data.isPlaying !== undefined ? data.isPlaying : true,
        currentTime: 0,
      }));
      if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
        playerRef.current.loadVideoById(newVideoId, 0);
      }
      showToast(`${data.updatedBy || 'Host'} loaded a new video`);
    };

    // Event: role_assigned
    const handleRoleAssigned = (data) => {
      const myId = getMyUserId();
      const myName = getMyUsername();
      const targetId = getUserId(data.targetUserId) || (typeof data.targetUserId === 'string' ? data.targetUserId : null);
      const targetName = data.targetUsername || getUsername(data.targetUserId);

      const isTargetMe = Boolean(
        (targetId && myId && targetId === myId) ||
        (targetName && myName && targetName.toLowerCase() === myName.toLowerCase())
      );

      if (isTargetMe) {
        setMyRole(data.newRole);
        showToast(`Your role was updated to ${data.newRole.toUpperCase()}!`);
      } else {
        showToast(`User role updated to ${data.newRole}`);
      }

      if (data.participants) {
        setParticipants(deduplicateParticipants(data.participants));
        const myP = data.participants.find((p) => {
          const pId = getUserId(p);
          const pName = getUsername(p);
          return (pId && myId && pId === myId) ||
                 (pName && myName && pName.toLowerCase() === myName.toLowerCase());
        });
        if (myP && myP.role) {
          setMyRole(myP.role);
        }
      }
    };

    // Event: participant_removed
    const handleParticipantRemoved = (data) => {
      if (data.participants) {
        setParticipants(deduplicateParticipants(data.participants));
      } else if (data.removedUserId) {
        setParticipants((prev) => prev.filter((p) => getUserId(p) !== data.removedUserId.toString()));
      }

      const myId = getMyUserId();
      const removedId = (data.removedUserId || data.targetUserId)?.toString();
      const removedName = data.removedUsername || data.targetUsername || 'Participant';

      if (removedId && myId && removedId === myId) {
        navigate('/dashboard', { state: { kicked: true } });
      } else {
        showToast(`${removedName} was removed from the party`);
      }
    };

    // Event: receive_message (Real-Time Group Chat)
    const handleReceiveMessage = (data) => {
      if (!data || !data.message) return;
      const newMsg = data.message;
      setMessages((prev) => {
        if (newMsg._id && prev.some((m) => m._id === newMsg._id)) {
          return prev;
        }
        return [...prev, newMsg];
      });
    };

    // Event: kicked (direct message to this user)
    const handleKicked = (data) => {
      navigate('/dashboard', {
        state: {
          kickedMessage: data.message || 'You have been removed from the room by the host/moderator.',
        },
      });
    };

    // Event: request_playback_change
    const handlePlaybackChangeRequested = (data) => {
      if (data.request) {
        setRequests((prev) => [...prev, data.request]);
        showToast(`New playback request from ${data.request.user?.username || 'participant'}`);
      }
    };

    // Event: approve_request
    const handleApproveRequestEvent = (data) => {
      setRequests((prev) =>
        prev.map((r) => (r._id === data.requestId ? { ...r, status: 'approved' } : r))
      );
      showToast('Playback request approved');
    };

    // Event: reject_request
    const handleRejectRequestEvent = (data) => {
      setRequests((prev) =>
        prev.map((r) => (r._id === data.requestId ? { ...r, status: 'rejected' } : r))
      );
      showToast('Playback request rejected');
    };

    // Attach listeners
    socket.on('sync_state', handleSyncState);
    socket.on('user_joined', handleUserJoined);
    socket.on('user_left', handleUserLeft);
    socket.on('play', handlePlay);
    socket.on('pause', handlePause);
    socket.on('seek', handleSeek);
    socket.on('change_video', handleChangeVideoEvent);
    socket.on('role_assigned', handleRoleAssigned);
    socket.on('participant_removed', handleParticipantRemoved);
    socket.on('kicked', handleKicked);
    socket.on('request_playback_change', handlePlaybackChangeRequested);
    socket.on('approve_request', handleApproveRequestEvent);
    socket.on('reject_request', handleRejectRequestEvent);
    socket.on('receive_message', handleReceiveMessage);
    socket.on('error', handleSocketError);

    return () => {
      socket.off('connect', joinRoomSocket);
      socket.emit('leave_room', { roomCode });
      socket.off('sync_state', handleSyncState);
      socket.off('user_joined', handleUserJoined);
      socket.off('user_left', handleUserLeft);
      socket.off('play', handlePlay);
      socket.off('pause', handlePause);
      socket.off('seek', handleSeek);
      socket.off('change_video', handleChangeVideoEvent);
      socket.off('role_assigned', handleRoleAssigned);
      socket.off('participant_removed', handleParticipantRemoved);
      socket.off('kicked', handleKicked);
      socket.off('request_playback_change', handlePlaybackChangeRequested);
      socket.off('approve_request', handleApproveRequestEvent);
      socket.off('reject_request', handleRejectRequestEvent);
      socket.off('receive_message', handleReceiveMessage);
      socket.off('error', handleSocketError);
    };
  }, [socket, roomCode]);

  // 3. User Playback Control Handlers
  const handleLocalPlay = (currentTime) => {
    if (!canControlPlayback || !socket) return;
    socket.emit('play', { roomCode, currentTime: currentTime || playbackState.currentTime });
  };

  const handleLocalPause = (currentTime) => {
    if (!canControlPlayback || !socket) return;
    socket.emit('pause', { roomCode, currentTime: currentTime || playbackState.currentTime });
  };

  const handleLocalSeek = (targetTime) => {
    if (!canControlPlayback || !socket) return;
    socket.emit('seek', { roomCode, currentTime: targetTime });
  };

  const handleChangeVideoSubmit = (e) => {
    e.preventDefault();
    setVideoInputError('');
    setVideoInputSuccess('');

    if (!canControlPlayback || !socket) {
      setVideoInputError('Forbidden: Only Host and Moderator can change the video.');
      return;
    }

    const trimmed = (videoInput || '').trim();
    if (!trimmed) {
      setVideoInputError('Please enter a YouTube video URL or 11-character video ID.');
      return;
    }

    const extractedId = extractYouTubeId(trimmed);
    if (!extractedId) {
      setVideoInputError('Invalid YouTube video URL or ID. Please check and try again.');
      return;
    }

    socket.emit(
      'change_video',
      {
        roomCode,
        videoId: extractedId,
        title: 'YouTube Video',
        videoTitle: 'YouTube Video',
      },
      (res) => {
        if (res && res.success === false) {
          setVideoInputError(res.message || 'Failed to change video.');
        } else {
          if (res?.data?.currentVideo) {
            const vid = res.data.currentVideo;
            const newVideoId = vid.videoId || extractedId;
            const newTitle = vid.title || vid.videoTitle || 'YouTube Video';
            setCurrentVideo({
              videoId: newVideoId,
              title: newTitle,
              duration: 0,
            });
            setPlaybackState((prev) => ({
              ...prev,
              isPlaying: true,
              currentTime: 0,
            }));
            if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
              playerRef.current.loadVideoById(newVideoId, 0);
            }
          }
          setVideoInputSuccess('Video updated successfully!');
          setVideoInput('');
          setTimeout(() => {
            setShowChangeVideoModal(false);
            setVideoInputSuccess('');
          }, 1200);
        }
      }
    );
  };

  // 4. Role & Moderation Handlers
  const handleAssignRole = (targetUserId, newRole) => {
    if (!socket) return;
    console.log('[Frontend] handleAssignRole:', { roomCode, targetUserId, newRole });
    socket.emit('assign_role', { roomCode, targetUserId, newRole }, (res) => {
      console.log('[Frontend] assign_role response:', res);
    });
  };

  const handleRemoveParticipant = (targetUserId) => {
    if (!socket) return;
    if (window.confirm('Are you sure you want to remove this participant?')) {
      socket.emit('remove_participant', { roomCode, targetUserId });
    }
  };

  // 5. Request System Handlers
  const handleApproveRequest = (requestId) => {
    if (!socket) return;
    socket.emit('approve_request', { roomCode, requestId });
  };

  const handleRejectRequest = (requestId) => {
    if (!socket) return;
    socket.emit('reject_request', { roomCode, requestId });
  };

  const handleSubmitRequest = (requestData) => {
    if (!socket) return;
    socket.emit('request_playback_change', {
      roomCode,
      ...requestData,
    });
    showToast('Your playback request has been submitted to the Host');
  };

  // 6. Real-Time Chat Handler
  const handleSendMessage = useCallback(
    (messageText) => {
      return new Promise((resolve, reject) => {
        if (!socket) {
          return reject(new Error('Socket is not connected.'));
        }
        socket.emit(
          'send_message',
          { roomCode, message: messageText },
          (res) => {
            if (res && res.success === false) {
              reject(new Error(res.message || 'Failed to send message.'));
            } else {
              if (res?.data?.message) {
                const newMsg = res.data.message;
                setMessages((prev) => {
                  if (newMsg._id && prev.some((m) => m._id === newMsg._id)) {
                    return prev;
                  }
                  return [...prev, newMsg];
                });
              }
              resolve(res);
            }
          }
        );
      });
    },
    [socket, roomCode]
  );

  // 7. Utility Handlers
  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeaveRoom = async () => {
    try {
      await roomService.leaveRoom(roomCode);
    } catch {
      // ignore error
    }
    navigate('/dashboard');
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        color: 'var(--text-secondary)',
      }}>
        <Loader2 className="animate-spin" size={40} color="var(--accent-red)" />
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Connecting to Watch Party...</h2>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Room Code: {roomCode}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: '480px', margin: '80px auto', padding: '0 20px', textAlign: 'center' }}>
        <div className="card">
          <AlertCircle size={44} color="#ef4444" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '8px' }}>
            Cannot Join Room
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginBottom: '24px' }}>
            {error}
          </p>
          <button onClick={() => navigate('/dashboard')} className="btn btn-primary" style={{ width: '100%' }}>
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px 20px' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '80px',
          right: '24px',
          zIndex: 9999,
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border-color)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 18px',
          fontSize: '0.9rem',
          fontWeight: 600,
          color: 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          animation: 'fadeIn 0.25s ease forwards',
        }}>
          <Radio size={16} color="var(--accent-red)" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Room Header Bar */}
      <div className="card" style={{
        padding: '16px 20px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
      }}>
        {/* Left: Title & Code */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 800, letterSpacing: '-0.3px', marginBottom: '4px' }}>
              {room?.title || 'YouTube Watch Party'}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Room Code:</span>
              <span style={{
                fontFamily: 'monospace',
                fontWeight: 800,
                color: 'var(--accent-red)',
                backgroundColor: 'rgba(255, 0, 51, 0.1)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                letterSpacing: '1px',
              }}>
                {roomCode}
              </span>
            </div>
          </div>

          {/* Copy Link Button */}
          <button
            onClick={handleCopyLink}
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
          >
            {copied ? <Check size={14} color="var(--status-online)" /> : <Copy size={14} />}
            <span>{copied ? 'Link Copied!' : 'Invite Link'}</span>
          </button>
        </div>

        {/* Right: Status & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* My Role Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Your Role:</span>
            <span className={`badge badge-${myRole}`}>
              {myRole === 'host' && <Crown size={12} style={{ marginRight: '4px' }} />}
              {myRole === 'moderator' && <Shield size={12} style={{ marginRight: '4px' }} />}
              {myRole === 'participant' && <User size={12} style={{ marginRight: '4px' }} />}
              {myRole}
            </span>
          </div>

          {/* Connection Status */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--bg-tertiary)',
            fontSize: '0.78rem',
            color: isConnected ? 'var(--status-online)' : 'var(--text-muted)',
          }}>
            <span className={`status-dot ${isConnected ? 'status-online' : 'status-offline'}`} />
            <span>{isConnected ? 'Live Sync' : 'Connecting'}</span>
          </div>

          {/* Change Video Button (Dedicated for Host / Moderator) */}
          {canControlPlayback && (
            <button
              onClick={() => {
                setShowChangeVideoModal((prev) => !prev);
                setVideoInputError('');
                setVideoInputSuccess('');
              }}
              className="btn btn-secondary"
              style={{
                padding: '8px 14px',
                fontSize: '0.85rem',
                borderColor: showChangeVideoModal ? 'var(--accent-red)' : undefined,
                color: showChangeVideoModal ? 'var(--accent-red)' : undefined,
              }}
            >
              <Film size={16} />
              <span>Change Video</span>
            </button>
          )}

          {/* Leave Room Button */}
          <button
            onClick={handleLeaveRoom}
            className="btn btn-danger"
            style={{ padding: '8px 14px', fontSize: '0.85rem' }}
          >
            <LogOut size={16} />
            <span>Leave</span>
          </button>
        </div>
      </div>

      {/* Dedicated Change Video UI (Visible only to Host and Moderator) */}
      {canControlPlayback && showChangeVideoModal && (
        <div
          className="card"
          style={{
            padding: '18px 22px',
            marginBottom: '20px',
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid rgba(255, 0, 51, 0.3)',
            animation: 'fadeIn 0.2s ease forwards',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Film size={18} color="var(--accent-red)" />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Change Room YouTube Video</h3>
            </div>
            <button
              onClick={() => {
                setShowChangeVideoModal(false);
                setVideoInputError('');
                setVideoInputSuccess('');
              }}
              className="btn btn-ghost"
              style={{ padding: '4px', color: 'var(--text-muted)' }}
            >
              <X size={18} />
            </button>
          </div>

          <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
            Enter a YouTube video URL or 11-character video ID to change the video for all participants in real time.
          </p>

          <form onSubmit={handleChangeVideoSubmit}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '260px', position: 'relative' }}>
                <input
                  type="text"
                  value={videoInput}
                  onChange={(e) => {
                    setVideoInput(e.target.value);
                    if (videoInputError) setVideoInputError('');
                  }}
                  placeholder="https://www.youtube.com/watch?v=... or Video ID (e.g., dQw4w9WgXcQ)"
                  className="input-field"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    fontSize: '0.9rem',
                    borderRadius: 'var(--radius-md)',
                    border: videoInputError ? '1px solid #ef4444' : '1px solid var(--border-color)',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowChangeVideoModal(false);
                    setVideoInputError('');
                    setVideoInputSuccess('');
                  }}
                  className="btn btn-secondary"
                  style={{ padding: '9px 16px', fontSize: '0.88rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!videoInput.trim()}
                  className="btn btn-primary"
                  style={{ padding: '9px 18px', fontSize: '0.88rem' }}
                >
                  Change Video
                </button>
              </div>
            </div>

            {/* Friendly Inline Error Message */}
            {videoInputError && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginTop: '10px',
                color: '#ef4444',
                fontSize: '0.82rem',
                fontWeight: 600,
              }}>
                <AlertCircle size={15} />
                <span>{videoInputError}</span>
              </div>
            )}

            {/* Friendly Inline Success Message */}
            {videoInputSuccess && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginTop: '10px',
                color: '#10b981',
                fontSize: '0.82rem',
                fontWeight: 600,
              }}>
                <CheckCircle size={15} />
                <span>{videoInputSuccess}</span>
              </div>
            )}
          </form>
        </div>
      )}

      {/* Main Watch Layout (Video Player + Controls on Left, Sidebar on Right) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 2.5fr) minmax(320px, 1fr)',
        gap: '24px',
        alignItems: 'start',
      }}>
        {/* Left Column: Player & Playback Controls */}
        <div>
          {/* YouTube IFrame Player */}
          <YouTubePlayer
            ref={playerRef}
            videoId={currentVideo?.videoId || 'dQw4w9WgXcQ'}
            canControlPlayback={canControlPlayback}
            onLocalPlay={handleLocalPlay}
            onLocalPause={handleLocalPause}
            onLocalSeek={handleLocalSeek}
            onTimeUpdate={(currentTime, totalDuration) => {
              setPlaybackState((prev) => ({ ...prev, currentTime }));
              if (totalDuration > 0 && duration !== totalDuration) {
                setDuration(totalDuration);
              }
            }}
          />

          {/* Video Title & Info */}
          <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {currentVideo?.title || 'YouTube Video'}
            </h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
              ID: {currentVideo?.videoId}
            </span>
          </div>

          {/* Role-Based Controls */}
          <PlaybackControls
            isPlaying={playbackState.isPlaying}
            currentTime={playbackState.currentTime}
            duration={duration}
            canControlPlayback={canControlPlayback}
            onPlay={() => handleLocalPlay()}
            onPause={() => handleLocalPause()}
            onSeek={handleLocalSeek}
            onRequestChange={() => setShowRequestModal(true)}
          />
        </div>

        {/* Right Column: Chat, Participants & Requests */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <ChatSection
            messages={messages}
            loading={messagesLoading}
            currentUserId={myUserId}
            currentUsername={myUsername}
            onSendMessage={handleSendMessage}
            roomCode={roomCode}
          />

          <ParticipantList
            participants={participants}
            currentUserId={myUserId}
            currentUserRole={myRole}
            onAssignRole={handleAssignRole}
            onRemoveParticipant={handleRemoveParticipant}
          />

          <PlaybackRequests
            requests={requests}
            canControlPlayback={canControlPlayback}
            onApprove={handleApproveRequest}
            onReject={handleRejectRequest}
            onSubmitRequest={handleSubmitRequest}
            showModal={showRequestModal}
            onCloseModal={() => setShowRequestModal(false)}
          />
        </div>
      </div>
    </div>
  );
};

export default WatchRoom;
