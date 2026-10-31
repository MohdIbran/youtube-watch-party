require("dotenv").config();
const { io } = require("socket.io-client");

const ROOM_CODE = process.env.WATCH_PARTY_ROOM || "ANWS8X";

const USERS = {
  host: {
    token: process.env.HOST_TOKEN,
    id: process.env.HOST_USER_ID,
  },
  moderator: {
    token: process.env.MODERATOR_TOKEN,
    id: process.env.MODERATOR_USER_ID,
  },
  participant: {
    token: process.env.PARTICIPANT_TOKEN,
    id: process.env.PARTICIPANT_USER_ID,
  },
};

const sockets = {};
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function connectUser(name) {
  return new Promise((resolve, reject) => {
    const user = USERS[name];

    if (!user.token) {
      return reject(new Error(`${name} token missing in .env`));
    }

    const socket = io("http://127.0.0.1:3000", {
  transports: ["websocket"],
  auth: { token: user.token },
  reconnection: false,
  timeout: 10000,
});
    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error(`${name} connection timeout`));
    }, 10000);

    socket.once("connect", () => {
      clearTimeout(timer);
      sockets[name] = socket;
      console.log(`Connected: ${name} (${socket.id})`);
      resolve(socket);
    });

    socket.once("connect_error", (error) => {
      clearTimeout(timer);
      reject(new Error(`${name}: ${error.message}`));
    });
  });
}

function emitAck(socket, event, data) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${event} acknowledgement timeout`));
    }, 8000);

    socket.emit(event, data, (response) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}

async function test(name, callback) {
  try {
    await callback();
    passed++;
    console.log(`✅ PASSED: ${name}`);
  } catch (error) {
    failed++;
    console.log(`❌ FAILED: ${name}`);
    console.log(`   Reason: ${error.message}`);
  }
}

async function joinUser(name) {
  const response = await emitAck(sockets[name], "join_room", {
    roomCode: ROOM_CODE,
  });

  assert(response?.success, response?.message || "Join room failed");
  return response;
}

async function runTests() {
  console.log("\n========== WATCH PARTY SOCKET TESTS ==========\n");

  // 1. Check configuration
  await test("Test configuration", async () => {
    for (const name of ["host", "moderator", "participant"]) {
      assert(USERS[name].token, `${name} token missing`);
    }

    for (const name of ["host", "moderator", "participant"]) {
      assert(USERS[name].id, `${name} user ID missing`);
    }

    assert(
      USERS.host.id !== USERS.moderator.id &&
      USERS.host.id !== USERS.participant.id &&
      USERS.moderator.id !== USERS.participant.id,
      "Host, Moderator and Participant IDs must be different"
    );
  });

  // 2. Connect all three users
  await test("Connect Host, Moderator and Participant", async () => {
    await connectUser("host");
    await connectUser("moderator");
    await connectUser("participant");
  });

  // 3. Join room
  await test("All three users join room", async () => {
    const results = await Promise.all([
      joinUser("host"),
      joinUser("moderator"),
      joinUser("participant"),
    ]);

    results.forEach((result) => {
      assert(result.success, "A user could not join");
    });
  });

  // 4. Play
  await test("Host PLAY event", async () => {
    const response = await emitAck(sockets.host, "play", {
      roomCode: ROOM_CODE,
      currentTime: 10,
    });

    assert(response.success, response.message || "Play failed");
    assert(
      response.data.syncState.playbackState.isPlaying === true,
      "Playback is not marked as playing"
    );
  });

  // 5. Pause
  await test("Moderator PAUSE event", async () => {
    const response = await emitAck(sockets.moderator, "pause", {
      roomCode: ROOM_CODE,
      currentTime: 10,
    });

    assert(response.success, response.message || "Pause failed");
    assert(
      response.data.syncState.playbackState.isPlaying === false,
      "Playback is not marked as paused"
    );
  });

  // 6. Seek
  await test("Host SEEK event", async () => {
    const response = await emitAck(sockets.host, "seek", {
      roomCode: ROOM_CODE,
      currentTime: 50,
    });

    assert(response.success, response.message || "Seek failed");
    assert(
      response.data.syncState.playbackState.currentTime === 50,
      "Seek position is incorrect"
    );
  });

  // 7. Change video
  await test("Moderator CHANGE VIDEO event", async () => {
    const response = await emitAck(sockets.moderator, "change_video", {
      roomCode: ROOM_CODE,
      videoId: "M7lc1UVf-VE",
      title: "YouTube API Test Video",
    });

    assert(response.success, response.message || "Change video failed");
    assert(
      response.data.currentVideo.videoId === "M7lc1UVf-VE",
      "Video ID was not updated"
    );
  });

  // 8. Participant direct change video must be rejected
  await test("Participant cannot directly change video", async () => {
    const response = await emitAck(sockets.participant, "change_video", {
      roomCode: ROOM_CODE,
      videoId: "dQw4w9WgXcQ",
      title: "Unauthorized Video",
    });

    assert(
      response.success === false,
      "Participant was incorrectly allowed to change video"
    );
  });

  // 9. Participant requests a video change
  let approvedRequestId;

  await test("Participant creates playback request", async () => {
    const response = await emitAck(
      sockets.participant,
      "request_playback_change",
      {
        roomCode: ROOM_CODE,
        type: "change_video",
        payload: {
          videoId: "dQw4w9WgXcQ",
          videoTitle: "Requested Video",
        },
      }
    );

    assert(response.success, response.message || "Request failed");

    approvedRequestId = response.data.request._id;
    assert(approvedRequestId, "Request ID missing");
  });

  // 10. Moderator approves request
  await test("Moderator approves playback request", async () => {
    const response = await emitAck(sockets.moderator, "approve_request", {
      roomCode: ROOM_CODE,
      requestId: approvedRequestId,
    });

    assert(response.success, response.message || "Approval failed");
    assert(
      response.data.request.status === "approved",
      "Request was not approved"
    );
  });

  // 11. Create another request for rejection
  let rejectedRequestId;

  await test("Participant creates second playback request", async () => {
    const response = await emitAck(
      sockets.participant,
      "request_playback_change",
      {
        roomCode: ROOM_CODE,
        type: "change_video",
        payload: {
          videoId: "M7lc1UVf-VE",
          videoTitle: "Rejected Test Video",
        },
      }
    );

    assert(response.success, response.message || "Request failed");

    rejectedRequestId = response.data.request._id;
    assert(rejectedRequestId, "Request ID missing");
  });

  // 12. Moderator rejects request
  await test("Moderator rejects playback request", async () => {
    const response = await emitAck(sockets.moderator, "reject_request", {
      roomCode: ROOM_CODE,
      requestId: rejectedRequestId,
    });

    assert(response.success, response.message || "Rejection failed");
    assert(
      response.data.request.status === "rejected",
      "Request was not rejected"
    );
  });

  // 13. Host assigns moderator role
  await test("Host assigns Moderator role to Participant", async () => {
    const response = await emitAck(sockets.host, "assign_role", {
      roomCode: ROOM_CODE,
      targetUserId: USERS.participant.id,
      newRole: "moderator",
    });

    assert(response.success, response.message || "Role assignment failed");
  });

  // 14. Restore participant role
  await test("Host restores Participant role", async () => {
    const response = await emitAck(sockets.host, "assign_role", {
      roomCode: ROOM_CODE,
      targetUserId: USERS.participant.id,
      newRole: "participant",
    });

    assert(response.success, response.message || "Role restore failed");
  });

  // 15. Sync state
  await test("Participant receives room sync state", async () => {
    const response = await emitAck(sockets.participant, "sync_state", {
      roomCode: ROOM_CODE,
    });

    assert(response.success, response.message || "Sync state failed");
    assert(response.data.syncState, "Sync state data missing");
  });

  // 16. Participant leaves
  await test("Participant leaves room", async () => {
    const response = await emitAck(sockets.participant, "leave_room", {
      roomCode: ROOM_CODE,
    });

    assert(response.success, response.message || "Leave room failed");
  });

  // 17. Participant joins again
  await test("Participant rejoins room", async () => {
    const response = await joinUser("participant");
    assert(response.success, "Rejoin failed");
  });

  // 18. Host removes participant
  await test("Host removes Participant", async () => {
    const response = await emitAck(sockets.host, "remove_participant", {
      roomCode: ROOM_CODE,
      targetUserId: USERS.participant.id,
    });

    assert(response.success, response.message || "Remove participant failed");
  });

  // 19. Disconnect
  await test("Disconnect all socket connections", async () => {
    for (const socket of Object.values(sockets)) {
      if (socket.connected) socket.disconnect();
    }

    assert(
      Object.values(sockets).every((socket) => !socket.connected),
      "Some sockets are still connected"
    );
  });

  console.log("\n============== TEST SUMMARY ==============");
  console.log(`✅ PASSED: ${passed}`);
  console.log(`❌ FAILED: ${failed}`);
  console.log(`TOTAL: ${passed + failed}`);
  console.log("===========================================\n");

  process.exitCode = failed > 0 ? 1 : 0;
}

runTests()
  .catch((error) => {
    console.error("\nTest runner error:", error.message);
    process.exitCode = 1;
  })
  .finally(() => {
    for (const socket of Object.values(sockets)) {
      if (socket.connected) socket.disconnect();
    }
  });
