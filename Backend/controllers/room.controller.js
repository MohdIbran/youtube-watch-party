const roomService = require("../services/room.service");
const chatService = require("../services/chat.service");

/**
 * @desc    Create a new watch party room
 * @route   POST /api/rooms
 * @access  Private
 */
const createRoom = async (req, res) => {
  try {
    const { title, initialVideoId, initialVideoTitle } = req.body;
    const hostId = req.user._id;

    const room = await roomService.createRoom({
      title,
      hostId,
      initialVideoId,
      initialVideoTitle,
    });

    return res.status(201).json({
      success: true,
      message: "Room created successfully.",
      data: {
        room,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Failed to create room.",
    });
  }
};

/**
 * @desc    Get room details by room code
 * @route   GET /api/rooms/:roomCode
 * @access  Private (or authenticated)
 */
const getRoom = async (req, res) => {
  try {
    const { roomCode } = req.params;
    const room = await roomService.getRoomByCode(roomCode);
    const syncState = roomService.getSyncState(room);

    return res.status(200).json({
      success: true,
      data: {
        room,
        syncState,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 404).json({
      success: false,
      message: error.message || "Room not found.",
    });
  }
};

/**
 * @desc    Join an existing room
 * @route   POST /api/rooms/:roomCode/join (also supports body roomCode via POST /api/rooms/join)
 * @access  Private
 */
const joinRoom = async (req, res) => {
  try {
    const roomCode = req.params.roomCode || req.body.roomCode;
    if (!roomCode) {
      return res.status(400).json({
        success: false,
        message: "Room code is required.",
      });
    }

    const userId = req.user._id;
    const room = await roomService.joinRoom(roomCode, userId);

    const io = req.app.get("io");
    if (io) {
      const userParticipant = room.participants.find(
        (p) => p.user && p.user._id && p.user._id.toString() === userId.toString()
      );
      io.to(roomCode.toUpperCase()).emit("user_joined", {
        user: req.user.toJSON(),
        role: userParticipant ? userParticipant.role : "participant",
        onlineCount: room.participants.filter((p) => p.isOnline).length,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Joined room successfully.",
      data: {
        room,
        syncState: roomService.getSyncState(room),
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Failed to join room.",
    });
  }
};

/**
 * @desc    Leave a room
 * @route   POST /api/rooms/:roomCode/leave
 * @access  Private
 */
const leaveRoom = async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { permanent } = req.body; // true if permanently leaving
    const userId = req.user._id;

    const room = await roomService.leaveRoom(roomCode, userId, Boolean(permanent));

    const io = req.app.get("io");
    if (io) {
      io.to(roomCode.toUpperCase()).emit("user_left", {
        userId,
        username: req.user.username,
        onlineCount: room.participants.filter((p) => p.isOnline).length,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Left room successfully.",
      data: {
        room,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Failed to leave room.",
    });
  }
};

/**
 * @desc    Assign participant role (moderator/participant/host)
 * @route   PATCH /api/rooms/:roomCode/role
 * @access  Private (Host only)
 */
const assignRole = async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { targetUserId, newRole } = req.body;
    const requesterId = req.user._id;

    if (!targetUserId || !newRole) {
      return res.status(400).json({
        success: false,
        message: "Please provide targetUserId and newRole.",
      });
    }

    const room = await roomService.assignParticipantRole(
      roomCode,
      targetUserId,
      newRole,
      requesterId
    );

    const io = req.app.get("io");
    if (io) {
      io.to(roomCode.toUpperCase()).emit("role_assigned", {
        targetUserId,
        newRole,
        assignedBy: requesterId,
        participants: room.participants,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Role updated to ${newRole} successfully.`,
      data: {
        room,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Failed to assign role.",
    });
  }
};

/**
 * @desc    Remove participant from room
 * @route   DELETE /api/rooms/:roomCode/participants/:userId
 * @access  Private (Host or Moderator)
 */
const removeParticipant = async (req, res) => {
  try {
    const { roomCode, userId } = req.params;
    const requesterId = req.user._id;

    const room = await roomService.removeParticipant(
      roomCode,
      userId,
      requesterId
    );

    const io = req.app.get("io");
    if (io) {
      io.to(roomCode.toUpperCase()).emit("participant_removed", {
        removedUserId: userId,
        removedBy: requesterId,
        participants: room.participants,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Participant removed successfully.",
      data: {
        room,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Failed to remove participant.",
    });
  }
};

/**
 * @desc    Request a playback change (play, pause, seek, change_video)
 * @route   POST /api/rooms/:roomCode/requests
 * @access  Private (Any participant)
 */
const createPlaybackRequest = async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { type, payload } = req.body;
    const userId = req.user._id;

    const result = await roomService.createPlaybackRequest(roomCode, userId, {
      type,
      payload,
    });

    const io = req.app.get("io");
    if (io) {
      io.to(roomCode.toUpperCase()).emit("request_playback_change", {
        request: result.request,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Playback change request submitted.",
      data: {
        request: result.request,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Failed to create playback request.",
    });
  }
};

/**
 * @desc    Approve or reject a playback change request
 * @route   PATCH /api/rooms/:roomCode/requests/:requestId
 * @access  Private (Host or Moderator only)
 */
const reviewPlaybackRequest = async (req, res) => {
  try {
    const { roomCode, requestId } = req.params;
    const { status } = req.body; // 'approved' or 'rejected'
    const reviewerId = req.user._id;

    if (!status || !["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be 'approved' or 'rejected'.",
      });
    }

    const result = await roomService.reviewPlaybackRequest(
      roomCode,
      requestId,
      status,
      reviewerId
    );

    const io = req.app.get("io");
    if (io) {
      const eventName = status === "approved" ? "approve_request" : "reject_request";
      io.to(roomCode.toUpperCase()).emit(eventName, {
        requestId,
        request: result.request,
        syncState: roomService.getSyncState(result.room),
      });

      // Also broadcast sync_state if approved
      if (status === "approved") {
        if (result.request.type === "change_video") {
          io.to(roomCode.toUpperCase()).emit("change_video", {
            videoId: result.room.currentVideo.videoId,
            title: result.room.currentVideo.title,
            videoTitle: result.room.currentVideo.title,
            currentTime: 0,
            isPlaying: true,
            approvedRequest: requestId,
          });
        }
        io.to(roomCode.toUpperCase()).emit("sync_state", roomService.getSyncState(result.room));
      }
    }

    return res.status(200).json({
      success: true,
      message: `Request ${status} successfully.`,
      data: {
        request: result.request,
        room: result.room,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Failed to review request.",
    });
  }
};

/**
 * @desc    Directly change video (Host or Moderator)
 * @route   PATCH /api/rooms/:roomCode/video
 * @access  Private (Host or Moderator)
 */
const changeVideo = async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { videoId, videoTitle, title } = req.body;
    const requesterId = req.user._id;

    const room = await roomService.updatePlaybackState(
      roomCode,
      {
        action: "change_video",
        videoId,
        videoTitle: videoTitle || title,
      },
      requesterId
    );

    const io = req.app.get("io");
    if (io) {
      io.to(roomCode.toUpperCase()).emit("change_video", {
        videoId: room.currentVideo.videoId,
        title: room.currentVideo.title,
        videoTitle: room.currentVideo.title,
        currentTime: 0,
        isPlaying: true,
      });
      io.to(roomCode.toUpperCase()).emit("sync_state", roomService.getSyncState(room));
    }

    return res.status(200).json({
      success: true,
      message: "Video updated successfully.",
      data: {
        currentVideo: room.currentVideo,
        syncState: roomService.getSyncState(room),
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Failed to update video.",
    });
  }
};

/**
 * @desc    Get recent chat messages for a room
 * @route   GET /api/rooms/:roomCode/messages
 * @access  Private
 */
const getRoomMessages = async (req, res) => {
  try {
    const { roomCode } = req.params;
    const userId = req.user._id;

    // Validate that user is a member of the room
    const room = await roomService.getRoomByCode(roomCode);
    const isMember = room.participants.some((p) => {
      const pId = p.user && (p.user._id ? p.user._id.toString() : p.user.toString());
      return pId === userId.toString();
    });

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You must be a member of this room to view chat messages.",
      });
    }

    const messages = await chatService.getRecentMessages(roomCode);

    return res.status(200).json({
      success: true,
      data: {
        messages,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Failed to fetch messages.",
    });
  }
};

module.exports = {
  createRoom,
  getRoom,
  joinRoom,
  leaveRoom,
  assignRole,
  removeParticipant,
  createPlaybackRequest,
  reviewPlaybackRequest,
  changeVideo,
  getRoomMessages,
};
