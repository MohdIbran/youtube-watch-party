import api from './api';

const roomService = {
  /**
   * Create a new watch party room
   * @param {Object} roomData - { title, initialVideoId, initialVideoTitle }
   */
  async createRoom(roomData) {
    const response = await api.post('/api/rooms', roomData);
    return response.data;
  },

  /**
   * Retrieve room details and calculated sync state by room code
   * @param {string} roomCode
   */
  async getRoom(roomCode) {
    const response = await api.get(`/api/rooms/${roomCode.toUpperCase()}`);
    return response.data;
  },

  /**
   * Join an existing room
   * @param {string} roomCode
   */
  async joinRoom(roomCode) {
    const response = await api.post(`/api/rooms/${roomCode.toUpperCase()}/join`);
    return response.data;
  },

  /**
   * Leave a room
   * @param {string} roomCode
   * @param {boolean} permanent
   */
  async leaveRoom(roomCode, permanent = false) {
    const response = await api.post(`/api/rooms/${roomCode.toUpperCase()}/leave`, {
      permanent,
    });
    return response.data;
  },

  /**
   * Assign a role (host, moderator, participant) to a participant
   * @param {string} roomCode
   * @param {string} targetUserId
   * @param {string} newRole
   */
  async assignRole(roomCode, targetUserId, newRole) {
    const response = await api.patch(`/api/rooms/${roomCode.toUpperCase()}/role`, {
      targetUserId,
      newRole,
    });
    return response.data;
  },

  /**
   * Remove a participant from the room
   * @param {string} roomCode
   * @param {string} userId
   */
  async removeParticipant(roomCode, userId) {
    const response = await api.delete(
      `/api/rooms/${roomCode.toUpperCase()}/participants/${userId}`
    );
    return response.data;
  },

  /**
   * Submit a playback change request (play, pause, seek, change_video)
   * @param {string} roomCode
   * @param {Object} requestData - { type, payload }
   */
  async createPlaybackRequest(roomCode, requestData) {
    const response = await api.post(
      `/api/rooms/${roomCode.toUpperCase()}/requests`,
      requestData
    );
    return response.data;
  },

  /**
   * Approve or reject a playback change request
   * @param {string} roomCode
   * @param {string} requestId
   * @param {string} status - 'approved' | 'rejected'
   */
  async reviewPlaybackRequest(roomCode, requestId, status) {
    const response = await api.patch(
      `/api/rooms/${roomCode.toUpperCase()}/requests/${requestId}`,
      { status }
    );
    return response.data;
  },

  /**
   * Directly update the current YouTube video
   * @param {string} roomCode
   * @param {Object} videoData - { videoId, videoTitle }
   */
  async changeVideo(roomCode, videoData) {
    const response = await api.patch(
      `/api/rooms/${roomCode.toUpperCase()}/video`,
      videoData
    );
    return response.data;
  },

  /**
   * Retrieve recent chat messages for a room
   * @param {string} roomCode
   */
  async getMessages(roomCode) {
    const response = await api.get(
      `/api/rooms/${roomCode.toUpperCase()}/messages`
    );
    return response.data;
  },
};

export default roomService;
