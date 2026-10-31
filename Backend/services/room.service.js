const Room = require("../models/Room");
const generateRoomCode = require("../utils/generateRoomCode");
const { extractYouTubeVideoId } = require("../utils/youtubeValidator");

/**
 * Standard population helper for rooms
 */
const populateRoomQuery = (query) => {
  return query
    .populate("host", "username email avatar")
    .populate("participants.user", "username email avatar")
    .populate("requests.user", "username email avatar")
    .populate("requests.reviewedBy", "username email avatar");
};

/**
 * Creates a new watch party room.
 */
const createRoom = async ({ title, hostId, initialVideoId, initialVideoTitle }) => {
  // Generate unique room code
  let roomCode;
  let isUnique = false;
  let attempts = 0;

  while (!isUnique && attempts < 10) {
    roomCode = generateRoomCode(6);
    const existing = await Room.findOne({ roomCode });
    if (!existing) {
      isUnique = true;
    }
    attempts++;
  }

  if (!isUnique) {
    throw new Error("Failed to generate unique room code. Please try again.");
  }

  // Validate initial video if provided
  let videoId = "dQw4w9WgXcQ"; // Default video
  if (initialVideoId) {
    const extracted = extractYouTubeVideoId(initialVideoId);
    if (!extracted) {
      throw new Error("Invalid YouTube video ID or URL.");
    }
    videoId = extracted;
  }

  const room = await Room.create({
    roomCode,
    title: title && title.trim() ? title.trim() : "Watch Party Room",
    host: hostId,
    participants: [
      {
        user: hostId,
        role: "host",
        isOnline: true,
      },
    ],
    currentVideo: {
      videoId,
      title: initialVideoTitle && initialVideoTitle.trim() ? initialVideoTitle.trim() : "Initial Video",
      duration: 0,
    },
    playbackState: {
      isPlaying: false,
      currentTime: 0,
      lastUpdatedAt: new Date(),
    },
  });

  return populateRoomQuery(Room.findById(room._id));
};

/**
 * Retrieves a room by its unique room code.
 */
const getRoomByCode = async (roomCode) => {
  if (!roomCode) {
    throw new Error("Room code is required.");
  }

  const room = await populateRoomQuery(
    Room.findOne({ roomCode: roomCode.toUpperCase().trim(), isActive: true })
  );

  if (!room) {
    const error = new Error("Room not found or no longer active.");
    error.statusCode = 404;
    throw error;
  }

  // Deduplicate participants in memory in case legacy duplicates exist
  if (room.participants && room.participants.length > 1) {
    const seen = new Set();
    const deduplicated = [];
    let hasDuplicates = false;

    for (const p of room.participants) {
      const uId = p.user && (p.user._id ? p.user._id.toString() : p.user.toString());
      if (uId) {
        if (seen.has(uId)) {
          hasDuplicates = true;
          continue;
        }
        seen.add(uId);
      }
      deduplicated.push(p);
    }

    if (hasDuplicates) {
      room.participants = deduplicated;
      await Room.updateOne(
        { _id: room._id },
        { $set: { participants: deduplicated } }
      );
    }
  }

  return room;
};

/**
 * Adds a user to a room or marks them online if already a participant.
 */
const joinRoom = async (roomCode, userId, socketId = null) => {
  const room = await getRoomByCode(roomCode);
  const userIdStr = userId.toString();

  // Find all entries for this user to update existing entry and prune any duplicates
  const matchingIndices = [];
  room.participants.forEach((p, idx) => {
    const pUserId = p.user && (p.user._id ? p.user._id.toString() : p.user.toString());
    if (pUserId === userIdStr) {
      matchingIndices.push(idx);
    }
  });

  if (matchingIndices.length > 0) {
    const primaryIndex = matchingIndices[0];
    const existingParticipant = room.participants[primaryIndex];
    existingParticipant.isOnline = true;
    if (socketId) existingParticipant.socketId = socketId;

    // Prune any duplicate entries for this user
    if (matchingIndices.length > 1) {
      for (let i = matchingIndices.length - 1; i > 0; i--) {
        room.participants.splice(matchingIndices[i], 1);
      }
    }
  } else {
    // Add new participant with default 'participant' role
    room.participants.push({
      user: userId,
      role: "participant",
      isOnline: true,
      socketId: socketId || null,
      joinedAt: new Date(),
    });
  }

  await room.save();
  return populateRoomQuery(Room.findById(room._id));
};

/**
 * Removes user or marks them offline when leaving a room.
 */
const leaveRoom = async (roomCode, userId, permanent = false) => {
  const room = await getRoomByCode(roomCode);
  const userIdStr = userId.toString();

  const matchingIndices = [];
  room.participants.forEach((p, idx) => {
    const pUserId = p.user && (p.user._id ? p.user._id.toString() : p.user.toString());
    if (pUserId === userIdStr) {
      matchingIndices.push(idx);
    }
  });

  if (matchingIndices.length === 0) {
    return room;
  }

  const primaryIndex = matchingIndices[0];
  const leavingRole = room.participants[primaryIndex].role;

  if (permanent) {
    for (let i = matchingIndices.length - 1; i >= 0; i--) {
      room.participants.splice(matchingIndices[i], 1);
    }
  } else {
    room.participants[primaryIndex].isOnline = false;
    room.participants[primaryIndex].socketId = null;
    for (let i = matchingIndices.length - 1; i > 0; i--) {
      room.participants.splice(matchingIndices[i], 1);
    }
  }

  // If host leaves permanently, pass host to a moderator or another participant
  if (leavingRole === "host" && permanent && room.participants.length > 0) {
    const moderator = room.participants.find((p) => p.role === "moderator");
    if (moderator) {
      moderator.role = "host";
      room.host = moderator.user._id || moderator.user;
    } else {
      room.participants[0].role = "host";
      room.host = room.participants[0].user._id || room.participants[0].user;
    }
  }

  await room.save();
  return populateRoomQuery(Room.findById(room._id));
};

/**
 * Assigns a new role (moderator, participant, or host) to a participant.
 */
const assignParticipantRole = async (roomCode, targetUserId, newRole, requesterId) => {
  const validRoles = ["host", "moderator", "participant"];
  if (!validRoles.includes(newRole)) {
    throw new Error(`Invalid role. Valid roles are: ${validRoles.join(", ")}`);
  }

  const room = await getRoomByCode(roomCode);
  const requesterRole = room.getUserRole(requesterId);

  // Only host can assign roles
  if (requesterRole !== "host") {
    const error = new Error("Only the room Host can assign roles.");
    error.statusCode = 403;
    throw error;
  }

  const targetUserIdStr = targetUserId.toString();
  const participant = room.participants.find(
    (p) => p.user && (p.user._id ? p.user._id.toString() === targetUserIdStr : p.user.toString() === targetUserIdStr)
  );

  if (!participant) {
    const error = new Error("Target user is not a participant in this room.");
    error.statusCode = 404;
    throw error;
  }

  if (newRole === "host") {
    // Transfer Host role: current host becomes moderator
    const currentHost = room.participants.find(
      (p) => p.user && (p.user._id ? p.user._id.toString() === requesterId.toString() : p.user.toString() === requesterId.toString())
    );
    if (currentHost) {
      currentHost.role = "moderator";
    }
    participant.role = "host";
    room.host = targetUserId;
  } else {
    participant.role = newRole;
  }

  await room.save();
  return populateRoomQuery(Room.findById(room._id));
};

/**
 * Removes a participant from the room.
 */
const removeParticipant = async (roomCode, targetUserId, requesterId) => {
  const room = await getRoomByCode(roomCode);
  const requesterRole = room.getUserRole(requesterId);

  if (requesterRole !== "host" && requesterRole !== "moderator") {
    const error = new Error("Only Host or Moderator can remove participants.");
    error.statusCode = 403;
    throw error;
  }

  const targetUserIdStr = targetUserId.toString();
  const targetRole = room.getUserRole(targetUserId);

  if (!targetRole) {
    const error = new Error("User is not a participant in this room.");
    error.statusCode = 404;
    throw error;
  }

  if (targetRole === "host") {
    const error = new Error("The room Host cannot be removed.");
    error.statusCode = 400;
    throw error;
  }

  if (requesterRole === "moderator" && targetRole === "moderator") {
    const error = new Error("Moderators cannot remove other moderators.");
    error.statusCode = 403;
    throw error;
  }

  room.participants = room.participants.filter(
    (p) => p.user && (p.user._id ? p.user._id.toString() !== targetUserIdStr : p.user.toString() !== targetUserIdStr)
  );

  await room.save();
  return populateRoomQuery(Room.findById(room._id));
};

/**
 * Updates room playback state (play, pause, seek, change_video).
 * Only Host and Moderator are allowed.
 */
const updatePlaybackState = async (roomCode, updateData, requesterId) => {
  const room = await getRoomByCode(roomCode);
  const canControl = room.canControlPlayback(requesterId);

  if (!canControl) {
    const error = new Error("Forbidden: Only Host and Moderator can control playback directly.");
    error.statusCode = 403;
    throw error;
  }

  const { action, currentTime, videoId, videoTitle, title } = updateData;
  const resolvedTitle = videoTitle || title;

  if (action === "play") {
    room.playbackState.isPlaying = true;
    if (typeof currentTime === "number" && !isNaN(currentTime) && currentTime >= 0) {
      room.playbackState.currentTime = currentTime;
    }
    room.playbackState.lastUpdatedAt = new Date();
  } else if (action === "pause") {
    room.playbackState.isPlaying = false;
    if (typeof currentTime === "number" && !isNaN(currentTime) && currentTime >= 0) {
      room.playbackState.currentTime = currentTime;
    }
    room.playbackState.lastUpdatedAt = new Date();
  } else if (action === "seek") {
    if (typeof currentTime !== "number" || isNaN(currentTime) || currentTime < 0) {
      throw new Error("Valid currentTime is required for seek action.");
    }
    room.playbackState.currentTime = currentTime;
    room.playbackState.lastUpdatedAt = new Date();
  } else if (action === "change_video") {
    const extractedId = extractYouTubeVideoId(videoId);
    if (!extractedId) {
      throw new Error("Invalid YouTube video ID or URL.");
    }
    room.currentVideo.videoId = extractedId;
    if (resolvedTitle) {
      room.currentVideo.title = resolvedTitle.trim();
    }
    room.playbackState.currentTime = 0;
    room.playbackState.isPlaying = true;
    room.playbackState.lastUpdatedAt = new Date();
  } else {
    throw new Error(`Unsupported action: ${action}`);
  }

  await room.save();
  return room;
};

/**
 * Creates a playback change request from a participant.
 */
const createPlaybackRequest = async (roomCode, userId, { type, payload = {} }) => {
  const validTypes = ["play", "pause", "seek", "change_video"];
  if (!validTypes.includes(type)) {
    throw new Error(`Invalid request type. Must be one of: ${validTypes.join(", ")}`);
  }

  if (type === "change_video") {
    const extracted = extractYouTubeVideoId(payload.videoId);
    if (!extracted) {
      throw new Error("A valid YouTube video ID or URL is required for video change requests.");
    }
    payload.videoId = extracted;
  }

  const room = await getRoomByCode(roomCode);
  const isParticipant = room.participants.some(
    (p) => p.user && (p.user._id ? p.user._id.toString() === userId.toString() : p.user.toString() === userId.toString())
  );

  if (!isParticipant) {
    const error = new Error("You must be a room participant to submit a request.");
    error.statusCode = 403;
    throw error;
  }

  const newRequest = {
    user: userId,
    type,
    payload: {
      currentTime: typeof payload.currentTime === "number" ? payload.currentTime : 0,
      videoId: payload.videoId || null,
      videoTitle: payload.videoTitle || payload.title || null,
    },
    status: "pending",
  };

  room.requests.push(newRequest);
  await room.save();

  const updatedRoom = await populateRoomQuery(Room.findById(room._id));
  const createdRequest = updatedRoom.requests[updatedRoom.requests.length - 1];

  return { room: updatedRoom, request: createdRequest };
};

/**
 * Approves or rejects a playback change request.
 * If approved, immediately applies the playback changes to the room.
 */
const reviewPlaybackRequest = async (roomCode, requestId, status, reviewerId) => {
  if (!["approved", "rejected"].includes(status)) {
    throw new Error("Status must be either 'approved' or 'rejected'.");
  }

  const room = await getRoomByCode(roomCode);
  const canControl = room.canControlPlayback(reviewerId);

  if (!canControl) {
    const error = new Error("Forbidden: Only Host or Moderator can review playback requests.");
    error.statusCode = 403;
    throw error;
  }

  const request = room.requests.id(requestId);
  if (!request) {
    const error = new Error("Request not found.");
    error.statusCode = 404;
    throw error;
  }

  if (request.status !== "pending") {
    const error = new Error(`Request has already been ${request.status}.`);
    error.statusCode = 400;
    throw error;
  }

  request.status = status;
  request.reviewedBy = reviewerId;
  request.reviewedAt = new Date();

  // If approved, apply change to room playback state
  if (status === "approved") {
    if (request.type === "play") {
      room.playbackState.isPlaying = true;
      if (typeof request.payload.currentTime === "number") {
        room.playbackState.currentTime = request.payload.currentTime;
      }
      room.playbackState.lastUpdatedAt = new Date();
    } else if (request.type === "pause") {
      room.playbackState.isPlaying = false;
      if (typeof request.payload.currentTime === "number") {
        room.playbackState.currentTime = request.payload.currentTime;
      }
      room.playbackState.lastUpdatedAt = new Date();
    } else if (request.type === "seek") {
      room.playbackState.currentTime = request.payload.currentTime || 0;
      room.playbackState.lastUpdatedAt = new Date();
    } else if (request.type === "change_video") {
      room.currentVideo.videoId = request.payload.videoId;
      const resolvedReqTitle = request.payload.videoTitle || request.payload.title;
      if (resolvedReqTitle) {
        room.currentVideo.title = resolvedReqTitle.trim();
      }
      room.playbackState.currentTime = 0;
      room.playbackState.isPlaying = true;
      room.playbackState.lastUpdatedAt = new Date();
    }
  }

  await room.save();
  const updatedRoom = await populateRoomQuery(Room.findById(room._id));
  const updatedRequest = updatedRoom.requests.id(requestId);

  return { room: updatedRoom, request: updatedRequest };
};

/**
 * Calculates and returns the current sync state for a room.
 */
const getSyncState = (room) => {
  const calculatedTime = room.calculateCurrentTime();
  return {
    roomCode: room.roomCode,
    currentVideo: room.currentVideo,
    playbackState: {
      isPlaying: room.playbackState.isPlaying,
      currentTime: calculatedTime,
      lastUpdatedAt: room.playbackState.lastUpdatedAt,
    },
    onlineCount: room.participants.filter((p) => p.isOnline).length,
    totalParticipants: room.participants.length,
  };
};

/**
 * Handles socket disconnection: marks participant offline unless they have another active socket.
 */
const handleDisconnect = async (socketId, remainingSocketId = null) => {
  const room = await Room.findOne({ "participants.socketId": socketId });
  if (!room) return null;

  const participant = room.participants.find((p) => p.socketId === socketId);
  if (participant) {
    if (remainingSocketId) {
      participant.socketId = remainingSocketId;
      participant.isOnline = true;
      await room.save();
      return null;
    }

    participant.isOnline = false;
    participant.socketId = null;
    await room.save();
    return {
      roomCode: room.roomCode,
      userId: participant.user?._id || participant.user,
    };
  }
  return null;
};

module.exports = {
  createRoom,
  getRoomByCode,
  joinRoom,
  leaveRoom,
  assignParticipantRole,
  removeParticipant,
  updatePlaybackState,
  createPlaybackRequest,
  reviewPlaybackRequest,
  getSyncState,
  handleDisconnect,
};
