import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Loader2,
  Info,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

// Helper to decode HTML entities for safe JSX rendering
const decodeEntities = (encodedString) => {
  if (!encodedString || typeof encodedString !== 'string') return '';
  try {
    const parser = new DOMParser();
    const dom = parser.parseFromString(
      '<!doctype html><body>' + encodedString,
      'text/html'
    );
    return dom.body.textContent || encodedString;
  } catch {
    return encodedString;
  }
};

// Helper to format ISO timestamp into a user-friendly time string (e.g., 3:45 PM)
const formatTime = (dateInput) => {
  if (!dateInput) return '';
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

const MAX_MESSAGE_LENGTH = 500;

const ChatSection = ({
  messages = [],
  loading = false,
  currentUserId,
  currentUsername,
  onSendMessage,
  roomCode,
}) => {
  const [inputText, setInputText] = useState('');
  const [sendError, setSendError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom whenever new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    setSendError('');

    const trimmed = inputText.trim();
    if (!trimmed) {
      return;
    }

    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      setSendError(`Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters.`);
      return;
    }

    setIsSending(true);
    try {
      await onSendMessage(trimmed);
      setInputText('');
    } catch (err) {
      setSendError(err.message || 'Failed to send message.');
    } finally {
      setIsSending(false);
      // Keep focus on input for fast rapid chatting
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const remainingChars = MAX_MESSAGE_LENGTH - inputText.length;

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '460px',
        maxHeight: '460px',
        padding: '0',
        overflow: 'hidden',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        backgroundColor: 'var(--bg-secondary)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-elevated)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MessageSquare size={18} color="var(--accent-red)" />
          <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Group Chat
          </h2>
        </div>
        <span
          style={{
            fontSize: '0.78rem',
            color: 'var(--text-muted)',
            fontFamily: 'monospace',
          }}
        >
          Room: {roomCode}
        </span>
      </div>

      {/* Message List Area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          backgroundColor: 'var(--bg-primary)',
        }}
      >
        {/* Loading State */}
        {loading ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              color: 'var(--text-muted)',
              padding: '24px 0',
            }}
          >
            <Loader2 className="animate-spin" size={28} color="var(--accent-red)" />
            <span style={{ fontSize: '0.85rem' }}>Loading messages...</span>
          </div>
        ) : messages.length === 0 ? (
          /* Empty Chat State */
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              color: 'var(--text-muted)',
              textAlign: 'center',
              padding: '20px',
            }}
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 0, 51, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '4px',
              }}
            >
              <Sparkles size={22} color="var(--accent-red)" />
            </div>
            <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              No messages yet
            </strong>
            <p style={{ fontSize: '0.82rem', margin: 0, maxWidth: '220px' }}>
              Say hello and start the party conversation with everyone in the room!
            </p>
          </div>
        ) : (
          /* Render Messages */
          messages.map((msg, index) => {
            const isSystem = msg.type === 'system';
            const msgUserId =
              msg.sender?._id || msg.sender?.id || msg.sender || (msg.user?._id || msg.user);
            const isMe =
              !isSystem &&
              Boolean(
                (msgUserId && currentUserId && msgUserId.toString() === currentUserId.toString()) ||
                (msg.username && currentUsername && msg.username.toLowerCase() === currentUsername.toLowerCase())
              );

            const key = msg._id || `msg-${index}-${msg.timestamp || index}`;

            if (isSystem) {
              return (
                <div
                  key={key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    margin: '4px 0',
                    fontSize: '0.78rem',
                    color: 'var(--text-muted)',
                    textAlign: 'center',
                  }}
                >
                  <span
                    style={{
                      padding: '3px 12px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <Info size={12} color="var(--accent-red)" />
                    <span>{decodeEntities(msg.message)}</span>
                  </span>
                </div>
              );
            }

            return (
              <div
                key={key}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isMe ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  alignSelf: isMe ? 'flex-end' : 'flex-start',
                }}
              >
                {/* Sender Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginBottom: '3px',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    paddingLeft: isMe ? 0 : '4px',
                    paddingRight: isMe ? '4px' : 0,
                  }}
                >
                  <span
                    style={{
                      fontWeight: 700,
                      color: isMe ? 'var(--accent-red)' : 'var(--text-secondary)',
                    }}
                  >
                    {isMe ? 'You' : msg.username || 'User'}
                  </span>
                  <span>•</span>
                  <span>{formatTime(msg.timestamp || msg.createdAt)}</span>
                </div>

                {/* Message Bubble */}
                <div
                  style={{
                    padding: '9px 14px',
                    borderRadius: isMe
                      ? '16px 16px 3px 16px'
                      : '16px 16px 16px 3px',
                    backgroundColor: isMe
                      ? 'var(--accent-red)'
                      : 'var(--bg-elevated)',
                    color: isMe ? '#ffffff' : 'var(--text-primary)',
                    border: isMe ? 'none' : '1px solid var(--border-color)',
                    fontSize: '0.88rem',
                    lineHeight: '1.4',
                    wordBreak: 'break-word',
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)',
                  }}
                >
                  {decodeEntities(msg.message)}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div
        style={{
          padding: '12px 14px',
          borderTop: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-elevated)',
        }}
      >
        {sendError && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '8px',
              fontSize: '0.78rem',
              color: '#ef4444',
            }}
          >
            <AlertCircle size={14} />
            <span>{sendError}</span>
          </div>
        )}

        <form onSubmit={handleSend} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                if (sendError) setSendError('');
              }}
              onKeyDown={handleKeyDown}
              maxLength={MAX_MESSAGE_LENGTH}
              placeholder="Type a message... (Press Enter to send)"
              className="input-field"
              style={{
                width: '100%',
                padding: '9px 12px',
                fontSize: '0.88rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
              }}
            />
            {inputText.length > 400 && (
              <span
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '0.7rem',
                  color: remainingChars < 20 ? '#ef4444' : 'var(--text-muted)',
                }}
              >
                {remainingChars}
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={!inputText.trim() || isSending}
            className="btn btn-primary"
            style={{
              padding: '9px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem',
              flexShrink: 0,
            }}
          >
            {isSending ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <Send size={16} />
            )}
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatSection;
