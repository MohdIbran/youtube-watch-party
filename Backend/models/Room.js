const mongoose = require("mongoose");

const participantSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["host", "moderator", "participant"],
      default: "participant",
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    isOnline: {
      type: Boolean,
      default: true,
    },
    socketId: {
      type: String,
      default: null,
    },
  },
  { _id: false }
);

const playbackRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["play", "pause", "seek", "change_video"],
      required: true,
    },
    payload: {
      currentTime: {
        type: Number,
        default: 0,
      },
      videoId: {
        type: String,
        default: null,
      },
      videoTitle: {
        type: String,
        default: null,
      },
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const roomSchema = new mongoose.Schema(
  {
    roomCode: {
      type: String,
      required: [true, "Room code is required"],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, "Room title is required"],
      trim: true,
      default: "Watch Party Room",
    },
    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    participants: [participantSchema],
    currentVideo: {
      videoId: {
        type: String,
        default: "dQw4w9WgXcQ", // Classic initial video
      },
      title: {
        type: String,
        default: "Welcome Video",
      },
      duration: {
        type: Number,
        default: 0,
      },
    },
    playbackState: {
      isPlaying: {
        type: Boolean,
        default: false,
      },
      currentTime: {
        type: Number,
        default: 0,
      },
      lastUpdatedAt: {
        type: Date,
        default: Date.now,
      },
    },
    requests: [playbackRequestSchema],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Calculates current real-time playback position based on elapsed time if playing.
 */
roomSchema.methods.calculateCurrentTime = function () {
  if (!this.playbackState.isPlaying) {
    return this.playbackState.currentTime;
  }
  const now = Date.now();
  const lastUpdated = new Date(this.playbackState.lastUpdatedAt).getTime();
  const elapsedSeconds = Math.max(0, (now - lastUpdated) / 1000);
  return Number((this.playbackState.currentTime + elapsedSeconds).toFixed(2));
};

/**
 * Returns the role of a given user ID in this room, or null if not a participant.
 */
roomSchema.methods.getUserRole = function (userId) {
  const userIdStr = userId.toString();
  const found = this.participants.find(
    (p) => p.user && p.user._id ? p.user._id.toString() === userIdStr : p.user.toString() === userIdStr
  );
  return found ? found.role : null;
};

/**
 * Checks if user has Host or Moderator permissions in this room.
 */
roomSchema.methods.canControlPlayback = function (userId) {
  const role = this.getUserRole(userId);
  return role === "host" || role === "moderator";
};

const Room = mongoose.model("Room", roomSchema);

module.exports = Room;
