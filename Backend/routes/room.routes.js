const express = require("express");
const router = express.Router();
const {
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
} = require("../controllers/room.controller");
const { protect } = require("../middleware/auth.middleware");

// All room routes require authentication
router.use(protect);

// Room creation & joining
router.post("/", createRoom);
router.post("/join", joinRoom);
router.get("/:roomCode", getRoom);
router.get("/:roomCode/messages", getRoomMessages);
router.post("/:roomCode/join", joinRoom);
router.post("/:roomCode/leave", leaveRoom);

// Roles and participants
router.patch("/:roomCode/role", assignRole);
router.delete("/:roomCode/participants/:userId", removeParticipant);

// Playback & requests
router.post("/:roomCode/requests", createPlaybackRequest);
router.patch("/:roomCode/requests/:requestId", reviewPlaybackRequest);
router.patch("/:roomCode/video", changeVideo);

module.exports = router;
