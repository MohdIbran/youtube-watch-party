const roomService = require("../services/room.service");
const chatService = require("../services/chat.service");
const Room = require("../models/Room");
const { extractYouTubeVideoId } = require("../utils/youtubeValidator");

// Global map to hold delayed disconnect timers: `${roomCode}:${userId}` -> { timeout, socketId, roomCode, user }
const pendingDisconnects = new Map();

/**
 * Registers all Watch Party room socket events.
 * 
 * @param {import("socket.io").Server} io - Socket.io server instance
 * @param {import("socket.io").Socket} socket - Authenticated socket connection
 */
const registerRoomHandlers = (io, socket) => {
  const user = socket.user;

  /**
   * Helper to acknowledge callbacks safely and emit socket error event if unauthorized/failed
   */
  const ackCallback = (callback, error, data = null) => {
    if (error) {
      const message = error.message || String(error);
      const statusCode = error.statusCode || 400;
      socket.emit("error", {
        success: false,
        message,
        statusCode,
      });
    }
    if (typeof callback === "function") {
      if (error) {
        callback({
          success: false,
          message: error.message || String(error),
          statusCode: error.statusCode || 400,
        });
      } else {
        callback({ success: true, data });
      }
    }
  };

  // 1. JOIN ROOM
  socket.on("join_room", async (data, callback) => {
    try {
      const roomCode = typeof data === "string" ? data : data?.roomCode;
      if (!roomCode) {
        throw new Error("roomCode is required to join a room.");
      }

      const normalizedCode = roomCode.toUpperCase().trim();
      const disconnectKey = `${normalizedCode}:${user.id}`;

      // Check if user had a pending disconnect timer (e.g. temporary refresh/reconnect)
      const hadPendingDisconnect = pendingDisconnects.has(disconnectKey);
      if (hadPendingDisconnect) {
        clearTimeout(pendingDisconnects.get(disconnectKey).timeout);
        pendingDisconnects.delete(disconnectKey);
      }

      const room = await roomService.joinRoom(normalizedCode, user.id, socket.id);

      socket.join(normalizedCode);
      socket.currentRoom = normalizedCode;

      const participant = room.participants.find(
        (p) => p.user && (p.user._id ? p.user._id.toString() === user.id.toString() : p.user.toString() === user.id.toString())
      );
      const role = participant ? participant.role : "participant";
      const syncState = roomService.getSyncState(room);

      // Send initial sync state to the newly joined user
      socket.emit("sync_state", {
        ...syncState,
        myRole: role,
      });

      // Broadcast user_joined only if this was NOT a rapid refresh/reconnection
      if (!hadPendingDisconnect) {
        socket.to(normalizedCode).emit("user_joined", {
          user: {
            _id: user.id,
            id: user.id,
            username: user.username,
            email: user.email,
          },
          role,
          onlineCount: syncState.onlineCount,
          message: `${user.username} joined the party`,
        });

        // Record system message in chat history and broadcast to room if this is a participant joining
        if (room.participants && room.participants.length > 1) {
          try {
            const sysMsg = await chatService.saveMessage({
              roomCode: normalizedCode,
              userId: null,
              username: "System",
              message: `${user.username} joined the party`,
              type: "system",
            });
            io.to(normalizedCode).emit("receive_message", { message: sysMsg });
          } catch (msgErr) {
            console.error("Failed to save join system message:", msgErr.message);
          }
        }
      }

      ackCallback(callback, null, { room, syncState, role });
    } catch (error) {
      ackCallback(callback, error);
    }
  });

  // 2. LEAVE ROOM
  socket.on("leave_room", async (data, callback) => {
    try {
      const roomCode = (typeof data === "string" ? data : data?.roomCode) || socket.currentRoom;
      if (!roomCode) {
        throw new Error("roomCode is required.");
      }

      const normalizedCode = roomCode.toUpperCase().trim();
      const disconnectKey = `${normalizedCode}:${user.id}`;

      // Clear any pending disconnect timers
      if (pendingDisconnects.has(disconnectKey)) {
        clearTimeout(pendingDisconnects.get(disconnectKey).timeout);
        pendingDisconnects.delete(disconnectKey);
      }

      const room = await roomService.leaveRoom(normalizedCode, user.id);

      socket.leave(normalizedCode);
      if (socket.currentRoom === normalizedCode) {
        socket.currentRoom = null;
      }

      // Explicit leave emits user_left immediately
      io.to(normalizedCode).emit("user_left", {
        userId: user.id,
        username: user.username,
        onlineCount: room.participants.filter((p) => p.isOnline).length,
        message: `${user.username} left the party`,
      });

      // Record system message in chat history and broadcast to room
      try {
        const sysMsg = await chatService.saveMessage({
          roomCode: normalizedCode,
          userId: null,
          username: "System",
          message: `${user.username} left the party`,
          type: "system",
        });
        io.to(normalizedCode).emit("receive_message", { message: sysMsg });
      } catch (msgErr) {
        console.error("Failed to save leave system message:", msgErr.message);
      }

      ackCallback(callback, null, { message: "Left room successfully." });
    } catch (error) {
      ackCallback(callback, error);
    }
  });

  // 3. PLAY
  socket.on("play", async (data, callback) => {
    try {
      const roomCode = (data?.roomCode || socket.currentRoom)?.toUpperCase().trim();
      if (!roomCode) throw new Error("roomCode is required.");

      const room = await roomService.updatePlaybackState(
        roomCode,
        {
          action: "play",
          currentTime: data?.currentTime,
        },
        user.id
      );

      const syncState = roomService.getSyncState(room);

      // Broadcast play event and sync_state to room
      io.to(roomCode).emit("play", {
        currentTime: syncState.playbackState.currentTime,
        isPlaying: true,
        updatedBy: user.username,
      });
      io.to(roomCode).emit("sync_state", syncState);

      ackCallback(callback, null, { syncState });
    } catch (error) {
      ackCallback(callback, error);
    }
  });

  // 4. PAUSE
  socket.on("pause", async (data, callback) => {
    try {
      const roomCode = (data?.roomCode || socket.currentRoom)?.toUpperCase().trim();
      if (!roomCode) throw new Error("roomCode is required.");

      const room = await roomService.updatePlaybackState(
        roomCode,
        {
          action: "pause",
          currentTime: data?.currentTime,
        },
        user.id
      );

      const syncState = roomService.getSyncState(room);

      io.to(roomCode).emit("pause", {
        currentTime: syncState.playbackState.currentTime,
        isPlaying: false,
        updatedBy: user.username,
      });
      io.to(roomCode).emit("sync_state", syncState);

      ackCallback(callback, null, { syncState });
    } catch (error) {
      ackCallback(callback, error);
    }
  });

  // 5. SEEK
  socket.on("seek", async (data, callback) => {
    try {
      const roomCode = (data?.roomCode || socket.currentRoom)?.toUpperCase().trim();
      if (!roomCode) throw new Error("roomCode is required.");
      if (typeof data?.currentTime !== "number") {
        throw new Error("currentTime (number) is required for seek.");
      }

      const room = await roomService.updatePlaybackState(
        roomCode,
        {
          action: "seek",
          currentTime: data.currentTime,
        },
        user.id
      );

      const syncState = roomService.getSyncState(room);

      io.to(roomCode).emit("seek", {
        currentTime: data.currentTime,
        updatedBy: user.username,
      });
      io.to(roomCode).emit("sync_state", syncState);

      ackCallback(callback, null, { syncState });
    } catch (error) {
      ackCallback(callback, error);
    }
  });

  // 6. CHANGE VIDEO
  socket.on("change_video", async (data, callback) => {
    try {
      const roomCode = (data?.roomCode || socket.currentRoom)?.toUpperCase().trim();
      if (!roomCode) throw new Error("roomCode is required.");
      if (!data?.videoId) throw new Error("videoId is required.");

      const room = await roomService.updatePlaybackState(
        roomCode,
        {
          action: "change_video",
          videoId: data.videoId,
          videoTitle: data.videoTitle || data.title,
        },
        user.id
      );

      const syncState = roomService.getSyncState(room);

      io.to(roomCode).emit("change_video", {
        videoId: room.currentVideo.videoId,
        title: room.currentVideo.title,
        videoTitle: room.currentVideo.title,
        currentTime: 0,
        isPlaying: true,
        updatedBy: user.username,
      });
      io.to(roomCode).emit("sync_state", syncState);

      ackCallback(callback, null, { currentVideo: room.currentVideo, syncState });
    } catch (error) {
      ackCallback(callback, error);
    }
  });

  // 7. SYNC STATE
  socket.on("sync_state", async (data, callback) => {
    try {
      const roomCode = (data?.roomCode || socket.currentRoom)?.toUpperCase().trim();
      if (!roomCode) throw new Error("roomCode is required.");

      const room = await roomService.getRoomByCode(roomCode);
      const syncState = roomService.getSyncState(room);

      socket.emit("sync_state", syncState);
      ackCallback(callback, null, { syncState });
    } catch (error) {
      ackCallback(callback, error);
    }
  });

  // 8. ASSIGN ROLE
  socket.on("assign_role", async (data, callback) => {
    try {
      console.log("[Backend Socket] Received assign_role:", data, "from user:", user.id);
      const roomCode = (data?.roomCode || socket.currentRoom)?.toUpperCase().trim();
      const { targetUserId, newRole } = data || {};
      if (!roomCode || !targetUserId || !newRole) {
        throw new Error("roomCode, targetUserId, and newRole are required.");
      }

      const room = await roomService.assignParticipantRole(
        roomCode,
        targetUserId,
        newRole,
        user.id
      );

      const participant = room.participants.find(
        (p) => p.user && (p.user._id ? p.user._id.toString() === targetUserId.toString() : p.user.toString() === targetUserId.toString())
      );

      console.log("[Backend Socket] Emitting role_assigned for:", targetUserId, "newRole:", newRole);

      io.to(roomCode).emit("role_assigned", {
        targetUserId,
        targetUsername: participant?.user?.username,
        newRole,
        assignedBy: user.id,
        participants: room.participants,
      });

      ackCallback(callback, null, { room });
    } catch (error) {
      console.error("[Backend Socket] Error in assign_role:", error.message);
      ackCallback(callback, error);
    }
  });

  // 9. REMOVE PARTICIPANT
  socket.on("remove_participant", async (data, callback) => {
    try {
      const roomCode = (data?.roomCode || socket.currentRoom)?.toUpperCase().trim();
      const { targetUserId } = data || {};
      if (!roomCode || !targetUserId) {
        throw new Error("roomCode and targetUserId are required.");
      }

      // Retrieve target participant username prior to removal
      const currentRoomData = await roomService.getRoomByCode(roomCode);
      const targetParticipant = currentRoomData.participants.find(
        (p) => p.user && (p.user._id ? p.user._id.toString() === targetUserId.toString() : p.user.toString() === targetUserId.toString())
      );
      const targetUsername = targetParticipant?.user?.username || "Participant";

      const room = await roomService.removeParticipant(
        roomCode,
        targetUserId,
        user.id
      );

      // Notify the removed user specifically and kick from socket room
      const allSockets = await io.in(roomCode).fetchSockets();
      for (const s of allSockets) {
        if (s.user && s.user.id.toString() === targetUserId.toString()) {
          s.emit("kicked", {
            roomCode,
            message: "You have been removed from this room by the host/moderator.",
          });
          s.leave(roomCode);
          s.currentRoom = null;
        }
      }

      io.to(roomCode).emit("participant_removed", {
        removedUserId: targetUserId,
        removedUsername: targetUsername,
        removedBy: user.id,
        removedByUsername: user.username,
        message: `${targetUsername} was removed from the party`,
        participants: room.participants,
      });

      // Record system message in chat history and broadcast to remaining room members
      try {
        const sysMsg = await chatService.saveMessage({
          roomCode,
          userId: null,
          username: "System",
          message: `${targetUsername} was removed from the party`,
          type: "system",
        });
        io.to(roomCode).emit("receive_message", { message: sysMsg });
      } catch (msgErr) {
        console.error("Failed to save kick system message:", msgErr.message);
      }

      ackCallback(callback, null, { room });
    } catch (error) {
      ackCallback(callback, error);
    }
  });

  // 10. REQUEST PLAYBACK CHANGE (Participant Approval System)
  socket.on("request_playback_change", async (data, callback) => {
    try {
      const roomCode = (data?.roomCode || socket.currentRoom)?.toUpperCase().trim();
      const { type, payload } = data || {};
      if (!roomCode || !type) {
        throw new Error("roomCode and request type are required.");
      }

      const result = await roomService.createPlaybackRequest(roomCode, user.id, {
        type,
        payload,
      });

      // Broadcast request to all room members (or host & moderators)
      io.to(roomCode).emit("request_playback_change", {
        request: result.request,
      });

      ackCallback(callback, null, { request: result.request });
    } catch (error) {
      ackCallback(callback, error);
    }
  });

  // 11. APPROVE REQUEST
  socket.on("approve_request", async (data, callback) => {
    try {
      const roomCode = (data?.roomCode || socket.currentRoom)?.toUpperCase().trim();
      const { requestId } = data || {};
      if (!roomCode || !requestId) {
        throw new Error("roomCode and requestId are required.");
      }

      const result = await roomService.reviewPlaybackRequest(
        roomCode,
        requestId,
        "approved",
        user.id
      );

      const syncState = roomService.getSyncState(result.room);

      // Broadcast approval event
      io.to(roomCode).emit("approve_request", {
        requestId,
        request: result.request,
        syncState,
      });

      // Broadcast specific action event that was approved
      if (result.request.type === "play") {
        io.to(roomCode).emit("play", {
          currentTime: syncState.playbackState.currentTime,
          isPlaying: true,
          approvedRequest: requestId,
        });
      } else if (result.request.type === "pause") {
        io.to(roomCode).emit("pause", {
          currentTime: syncState.playbackState.currentTime,
          isPlaying: false,
          approvedRequest: requestId,
        });
      } else if (result.request.type === "seek") {
        io.to(roomCode).emit("seek", {
          currentTime: result.request.payload.currentTime,
          approvedRequest: requestId,
        });
      } else if (result.request.type === "change_video") {
        io.to(roomCode).emit("change_video", {
          videoId: result.room.currentVideo.videoId,
          title: result.room.currentVideo.title,
          videoTitle: result.room.currentVideo.title,
          currentTime: 0,
          isPlaying: true,
          approvedRequest: requestId,
        });
      }

      // Synchronize all room participants
      io.to(roomCode).emit("sync_state", syncState);

      ackCallback(callback, null, { request: result.request, syncState });
    } catch (error) {
      ackCallback(callback, error);
    }
  });

  // 12. REJECT REQUEST
  socket.on("reject_request", async (data, callback) => {
    try {
      const roomCode = (data?.roomCode || socket.currentRoom)?.toUpperCase().trim();
      const { requestId } = data || {};
      if (!roomCode || !requestId) {
        throw new Error("roomCode and requestId are required.");
      }

      const result = await roomService.reviewPlaybackRequest(
        roomCode,
        requestId,
        "rejected",
        user.id
      );

      io.to(roomCode).emit("reject_request", {
        requestId,
        request: result.request,
      });

      ackCallback(callback, null, { request: result.request });
    } catch (error) {
      ackCallback(callback, error);
    }
  });

  // 13. DISCONNECT
  socket.on("disconnect", async () => {
    try {
      const roomCode = socket.currentRoom;
      if (!roomCode) {
        await roomService.handleDisconnect(socket.id, null);
        return;
      }

      // Check if user still has other active sockets in this room (multi-tab / session)
      const socketsInRoom = await io.in(roomCode).fetchSockets();
      const otherSocket = socketsInRoom.find(
        (s) => s.id !== socket.id && s.user && s.user.id.toString() === user.id.toString()
      );

      if (otherSocket) {
        // Still active in another socket/tab -> silently update socket reference
        await roomService.handleDisconnect(socket.id, otherSocket.id);
        return;
      }

      // If no other socket is active, set a debounce grace period (2500ms)
      // to handle quick page refreshes and reconnections without emitting false "user_left" toasts
      const disconnectKey = `${roomCode}:${user.id}`;
      if (pendingDisconnects.has(disconnectKey)) {
        clearTimeout(pendingDisconnects.get(disconnectKey).timeout);
      }

      const timeout = setTimeout(async () => {
        pendingDisconnects.delete(disconnectKey);
        try {
          const result = await roomService.handleDisconnect(socket.id, null);
          if (result) {
            const currentRoom = await roomService.getRoomByCode(roomCode);
            const onlineCount = currentRoom?.participants
              ? currentRoom.participants.filter((p) => p.isOnline).length
              : 0;

            io.to(roomCode).emit("user_left", {
              userId: user.id,
              username: user.username,
              socketId: socket.id,
              onlineCount,
              message: `${user.username} left the party`,
            });

            // Record system message in chat history and broadcast
            try {
              const sysMsg = await chatService.saveMessage({
                roomCode,
                userId: null,
                username: "System",
                message: `${user.username} left the party`,
                type: "system",
              });
              io.to(roomCode).emit("receive_message", { message: sysMsg });
            } catch (msgErr) {
              console.error("Delayed disconnect system message error:", msgErr.message);
            }
          }
        } catch (err) {
          console.error("Delayed disconnect handling error:", err.message);
        }
      }, 2500);

      pendingDisconnects.set(disconnectKey, {
        timeout,
        socketId: socket.id,
        roomCode,
        user,
      });
    } catch (err) {
      console.error("Error handling socket disconnect:", err.message);
    }
  });

  // 14. SEND MESSAGE (Real-Time Group Chat)
  socket.on("send_message", async (data, callback) => {
    try {
      const roomCode = (data?.roomCode || socket.currentRoom)?.toUpperCase().trim();
      if (!roomCode) {
        throw new Error("roomCode is required to send a message.");
      }

      const rawMessage = typeof data === "string" ? data : data?.message;
      if (!rawMessage || typeof rawMessage !== "string" || !rawMessage.trim()) {
        throw new Error("Message cannot be empty.");
      }

      const trimmed = rawMessage.trim();
      if (trimmed.length > 500) {
        throw new Error("Message exceeds the maximum limit of 500 characters.");
      }

      const savedMessage = await chatService.saveMessage({
        roomCode,
        userId: user.id,
        username: user.username,
        message: trimmed,
        type: "user",
      });

      // Broadcast receive_message to all room members
      io.to(roomCode).emit("receive_message", {
        message: savedMessage,
      });

      ackCallback(callback, null, { message: savedMessage });
    } catch (error) {
      ackCallback(callback, error);
    }
  });

  // 15. GET MESSAGES (Fetch Recent History via Socket)
  socket.on("get_messages", async (data, callback) => {
    try {
      const roomCode = (data?.roomCode || socket.currentRoom)?.toUpperCase().trim();
      if (!roomCode) {
        throw new Error("roomCode is required to fetch messages.");
      }

      // Validate room membership
      const room = await roomService.getRoomByCode(roomCode);
      const isMember = room.participants.some((p) => {
        const pId = p.user && (p.user._id ? p.user._id.toString() : p.user.toString());
        return pId === user.id.toString();
      });

      if (!isMember) {
        const error = new Error("Forbidden: You must be a member of this room to view chat messages.");
        error.statusCode = 403;
        throw error;
      }

      const messages = await chatService.getRecentMessages(roomCode, data?.limit || 50);
      ackCallback(callback, null, { messages });
    } catch (error) {
      ackCallback(callback, error);
    }
  });
};

module.exports = registerRoomHandlers;
