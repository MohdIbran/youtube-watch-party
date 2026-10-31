const http = require("http");
const { io: Client } = require("socket.io-client");
const dns = require("node:dns");
dns.setServers(["1.1.1.1", "8.8.8.8"]);
require("dotenv").config();

const app = require("../app");
const ConnectDB = require("../config/db");
const setupSocket = require("../sockets/socket");
const { Server } = require("socket.io");

const TEST_PORT = 3456;
const BASE_URL = `http://localhost:${TEST_PORT}`;

// Helper for making HTTP JSON requests
const httpRequest = (method, path, body = null, token = null) => {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const headers = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const req = http.request(
      url,
      {
        method,
        headers,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode, data: parsed });
        });
      }
    );

    req.on("error", reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
};

const runAllTests = async () => {
  console.log("\n========================================================");
  console.log("   STARTING WATCH PARTY END-TO-END TEST SUITE");
  console.log("========================================================\n");

  await ConnectDB();

  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: "*" } });
  app.set("io", io);
  setupSocket(io);

  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  console.log(`[Test Server] Listening on ${BASE_URL}`);

  let passed = 0;
  let failed = 0;

  const assert = (condition, testName) => {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}`);
      failed++;
    }
  };

  const timestamp = Date.now();
  let hostToken, modToken, partToken;
  let hostUser, modUser, partUser;
  let roomCode;

  try {
    // -----------------------------------------------------------
    // 1. HEALTH CHECK
    // -----------------------------------------------------------
    console.log("\n--- Testing Health Check & Public Endpoints ---");
    const healthRes = await httpRequest("GET", "/health");
    assert(healthRes.status === 200 && healthRes.data.status === "healthy", "GET /health returns 200 OK");

    // -----------------------------------------------------------
    // 2. USER REGISTRATION & AUTH
    // -----------------------------------------------------------
    console.log("\n--- Testing Authentication Endpoints ---");
    
    // Register Host
    const regHostRes = await httpRequest("POST", "/api/auth/register", {
      username: `host_${timestamp}`,
      email: `host_${timestamp}@example.com`,
      password: "password123",
    });
    assert(regHostRes.status === 201 && regHostRes.data.data.token, "POST /api/auth/register for Host user");
    hostToken = regHostRes.data.data.token;
    hostUser = regHostRes.data.data.user;

    // Register Participant
    const regPartRes = await httpRequest("POST", "/api/auth/register", {
      username: `part_${timestamp}`,
      email: `part_${timestamp}@example.com`,
      password: "password123",
    });
    assert(regPartRes.status === 201 && regPartRes.data.data.token, "POST /api/auth/register for Participant user");
    partToken = regPartRes.data.data.token;
    partUser = regPartRes.data.data.user;

    // Register Moderator
    const regModRes = await httpRequest("POST", "/api/auth/register", {
      username: `mod_${timestamp}`,
      email: `mod_${timestamp}@example.com`,
      password: "password123",
    });
    assert(regModRes.status === 201 && regModRes.data.data.token, "POST /api/auth/register for Moderator user");
    modToken = regModRes.data.data.token;
    modUser = regModRes.data.data.user;

    // Test Login
    const loginRes = await httpRequest("POST", "/api/auth/login", {
      email: `host_${timestamp}@example.com`,
      password: "password123",
    });
    assert(loginRes.status === 200 && loginRes.data.data.token, "POST /api/auth/login validates credentials");

    // Test GET /api/auth/me
    const meRes = await httpRequest("GET", "/api/auth/me", null, hostToken);
    assert(meRes.status === 200 && meRes.data.data.user.username === hostUser.username, "GET /api/auth/me returns profile");

    // -----------------------------------------------------------
    // 3. ROOM MANAGEMENT REST APIS
    // -----------------------------------------------------------
    console.log("\n--- Testing Room Management REST Endpoints ---");
    
    // Create Room
    const createRoomRes = await httpRequest("POST", "/api/rooms", {
      title: "Movie Night 2026",
      initialVideoId: "dQw4w9WgXcQ",
      initialVideoTitle: "Rick Astley - Never Gonna Give You Up",
    }, hostToken);
    assert(createRoomRes.status === 201 && createRoomRes.data.data.room.roomCode, "POST /api/rooms creates room with unique code");
    roomCode = createRoomRes.data.data.room.roomCode;
    console.log(`    Room Code created: ${roomCode}`);

    // Get Room Details
    const getRoomRes = await httpRequest("GET", `/api/rooms/${roomCode}`, null, hostToken);
    assert(getRoomRes.status === 200 && getRoomRes.data.data.room.roomCode === roomCode, "GET /api/rooms/:roomCode returns room details & sync state");

    // Participant joins room via REST
    const joinPartRes = await httpRequest("POST", `/api/rooms/${roomCode}/join`, {}, partToken);
    assert(joinPartRes.status === 200, "POST /api/rooms/:roomCode/join lets participant join");

    // Moderator candidate joins room via REST
    const joinModRes = await httpRequest("POST", `/api/rooms/${roomCode}/join`, {}, modToken);
    assert(joinModRes.status === 200, "POST /api/rooms/:roomCode/join lets 2nd participant join");

    // Host promotes 2nd participant to Moderator
    const assignRoleRes = await httpRequest("PATCH", `/api/rooms/${roomCode}/role`, {
      targetUserId: modUser._id,
      newRole: "moderator",
    }, hostToken);
    assert(assignRoleRes.status === 200, "PATCH /api/rooms/:roomCode/role allows Host to assign Moderator role");

    // Participant attempts to assign role (Should be forbidden 403)
    const unauthorizedRoleRes = await httpRequest("PATCH", `/api/rooms/${roomCode}/role`, {
      targetUserId: hostUser._id,
      newRole: "participant",
    }, partToken);
    assert(unauthorizedRoleRes.status === 403, "PATCH /api/rooms/:roomCode/role denies non-host users");

    // Direct change video via REST by Moderator
    const changeVideoRes = await httpRequest("PATCH", `/api/rooms/${roomCode}/video`, {
      videoId: "jNQXAC9IVRw",
      videoTitle: "Me at the zoo",
    }, modToken);
    assert(changeVideoRes.status === 200 && changeVideoRes.data.data.currentVideo.videoId === "jNQXAC9IVRw", "PATCH /api/rooms/:roomCode/video allows Moderator to change video");

    // Participant requests playback change via REST
    const reqPlaybackRes = await httpRequest("POST", `/api/rooms/${roomCode}/requests`, {
      type: "seek",
      payload: { currentTime: 45 },
    }, partToken);
    assert(reqPlaybackRes.status === 201 && reqPlaybackRes.data.data.request._id, "POST /api/rooms/:roomCode/requests submits playback change request");
    const createdRequestId = reqPlaybackRes.data.data.request._id;

    // Moderator approves playback request
    const approveReqRes = await httpRequest("PATCH", `/api/rooms/${roomCode}/requests/${createdRequestId}`, {
      status: "approved",
    }, modToken);
    assert(approveReqRes.status === 200 && approveReqRes.data.data.request.status === "approved", "PATCH /api/rooms/:roomCode/requests/:id allows Moderator/Host to approve request");

    // -----------------------------------------------------------
    // 4. SOCKET.IO TESTING
    // -----------------------------------------------------------
    console.log("\n--- Testing Socket.IO Real-time Events & Roles ---");

    // Test rejection without token
    const unauthClient = Client(BASE_URL, {
      transports: ["websocket"],
      autoConnect: true,
      reconnection: false,
    });
    const unauthError = await new Promise((resolve) => {
      unauthClient.on("connect_error", (err) => resolve(err.message));
      setTimeout(() => resolve(null), 1000);
    });
    unauthClient.disconnect();
    assert(unauthError && unauthError.includes("Authentication error"), "Socket connection rejected when unauthenticated");

    // Connect authenticated clients
    const hostSocket = Client(BASE_URL, {
      auth: { token: hostToken },
      transports: ["websocket"],
    });
    const modSocket = Client(BASE_URL, {
      auth: { token: modToken },
      transports: ["websocket"],
    });
    const partSocket = Client(BASE_URL, {
      auth: { token: partToken },
      transports: ["websocket"],
    });

    await Promise.all([
      new Promise((res) => hostSocket.on("connect", res)),
      new Promise((res) => modSocket.on("connect", res)),
      new Promise((res) => partSocket.on("connect", res)),
    ]);
    assert(true, "Host, Moderator, and Participant connected authenticated sockets");

    // Host joins room
    const hostJoinPromise = new Promise((resolve) => {
      hostSocket.emit("join_room", { roomCode }, (res) => resolve(res));
    });
    const hostJoinRes = await hostJoinPromise;
    assert(hostJoinRes.success && hostJoinRes.data.role === "host", "Host joins room via socket and role is 'host'");

    // Moderator joins room - Host should receive user_joined
    const userJoinedPromise = new Promise((resolve) => {
      hostSocket.once("user_joined", (data) => resolve(data));
    });
    await new Promise((resolve) => {
      modSocket.emit("join_room", { roomCode }, resolve);
    });
    const userJoinedData = await userJoinedPromise;
    assert(userJoinedData && userJoinedData.user.username === modUser.username, "Socket broadcasts 'user_joined' to room");

    // Participant joins room and receives sync_state
    const syncStatePromise = new Promise((resolve) => {
      partSocket.once("sync_state", (state) => resolve(state));
    });
    await new Promise((resolve) => {
      partSocket.emit("join_room", { roomCode }, resolve);
    });
    const initialSyncState = await syncStatePromise;
    assert(initialSyncState && initialSyncState.roomCode === roomCode, "New participant receives 'sync_state' upon joining");

    // Participant tries to play video directly -> MUST BE REJECTED (RBAC)
    const partPlayPromise = new Promise((resolve) => {
      partSocket.emit("play", { roomCode, currentTime: 10 }, (res) => resolve(res));
    });
    const partPlayRes = await partPlayPromise;
    assert(partPlayRes.success === false, "Participant cannot directly play/control playback (RBAC enforced)");

    // Participant tries to pause video directly -> MUST BE REJECTED (RBAC)
    const partPausePromise = new Promise((resolve) => {
      partSocket.emit("pause", { roomCode, currentTime: 10 }, (res) => resolve(res));
    });
    const partPauseRes = await partPausePromise;
    assert(partPauseRes.success === false, "Participant cannot directly pause video (RBAC enforced)");

    // Participant tries to seek video directly -> MUST BE REJECTED (RBAC)
    const partSeekDirectPromise = new Promise((resolve) => {
      partSocket.emit("seek", { roomCode, currentTime: 45 }, (res) => resolve(res));
    });
    const partSeekDirectRes = await partSeekDirectPromise;
    assert(partSeekDirectRes.success === false, "Participant cannot directly seek video (RBAC enforced)");

    // Participant tries to change video directly -> MUST BE REJECTED (RBAC)
    const partChangeDirectPromise = new Promise((resolve) => {
      partSocket.emit("change_video", { roomCode, videoId: "dQw4w9WgXcQ" }, (res) => resolve(res));
    });
    const partChangeDirectRes = await partChangeDirectPromise;
    assert(partChangeDirectRes.success === false, "Participant cannot directly change video (RBAC enforced)");

    // Host emits 'play' -> MUST BE BROADCAST TO ALL
    const modPlayListenPromise = new Promise((resolve) => {
      modSocket.once("play", (data) => resolve(data));
    });
    hostSocket.emit("play", { roomCode, currentTime: 12 });
    const modPlayData = await modPlayListenPromise;
    assert(modPlayData && modPlayData.isPlaying === true, "Host controls playback and emits 'play' event to room");

    // Moderator emits 'pause' -> MUST BE BROADCAST TO ALL
    const partPauseListenPromise = new Promise((resolve) => {
      partSocket.once("pause", (data) => resolve(data));
    });
    modSocket.emit("pause", { roomCode, currentTime: 15 });
    const partPauseData = await partPauseListenPromise;
    assert(partPauseData && partPauseData.isPlaying === false, "Moderator controls playback and emits 'pause' event to room");

    // Moderator emits 'seek' -> MUST BE BROADCAST TO ALL
    const partSeekListenPromise = new Promise((resolve) => {
      partSocket.once("seek", (data) => resolve(data));
    });
    modSocket.emit("seek", { roomCode, currentTime: 120 });
    const partSeekData = await partSeekListenPromise;
    assert(partSeekData && partSeekData.currentTime === 120, "Moderator emits 'seek' and room receives it");

    // Moderator emits 'change_video' -> VALIDATED & BROADCAST TO ALL
    const partChangeVideoPromise = new Promise((resolve) => {
      partSocket.once("change_video", (data) => resolve(data));
    });
    modSocket.emit("change_video", {
      roomCode,
      videoId: "https://www.youtube.com/watch?v=kJQP7kiw5Fk", // Despacito URL
      title: "Despacito",
    });
    const partChangeVideoData = await partChangeVideoPromise;
    assert(partChangeVideoData && partChangeVideoData.videoId === "kJQP7kiw5Fk", "change_video validates YouTube URL/ID and broadcasts to room");

    // -----------------------------------------------------------
    // 5. PARTICIPANT APPROVAL SYSTEM VIA SOCKET
    // -----------------------------------------------------------
    console.log("\n--- Testing Participant Approval System via Socket ---");

    // Participant requests playback change (seek to 50s)
    const hostRequestPromise = new Promise((resolve) => {
      hostSocket.once("request_playback_change", (data) => resolve(data));
    });
    const partRequestPromise = new Promise((resolve) => {
      partSocket.emit(
        "request_playback_change",
        {
          roomCode,
          type: "seek",
          payload: { currentTime: 50 },
        },
        resolve
      );
    });
    const [partReqAck, hostReceivedReq] = await Promise.all([
      partRequestPromise,
      hostRequestPromise,
    ]);
    assert(hostReceivedReq && hostReceivedReq.request.type === "seek", "Participant requests playback change; Host receives 'request_playback_change'");

    const pendingRequestId = hostReceivedReq.request._id;

    // Host approves request
    const partApprovalPromise = new Promise((resolve) => {
      partSocket.once("approve_request", (data) => resolve(data));
    });
    hostSocket.emit("approve_request", {
      roomCode,
      requestId: pendingRequestId,
    });
    const approvalData = await partApprovalPromise;
    assert(approvalData && approvalData.requestId === pendingRequestId, "Host approves request; room receives 'approve_request' and updated state");

    // Participant submits request to be rejected
    const rejectReqListenPromise = new Promise((resolve) => {
      hostSocket.once("request_playback_change", (data) => resolve(data));
    });
    partSocket.emit("request_playback_change", {
      roomCode,
      type: "play",
      payload: { currentTime: 99 },
    });
    const reqToReject = await rejectReqListenPromise;

    // Moderator rejects request
    const partRejectPromise = new Promise((resolve) => {
      partSocket.once("reject_request", (data) => resolve(data));
    });
    modSocket.emit("reject_request", {
      roomCode,
      requestId: reqToReject.request._id,
    });
    const rejectData = await partRejectPromise;
    assert(rejectData && rejectData.requestId === reqToReject.request._id, "Moderator rejects request; room receives 'reject_request'");

    // -----------------------------------------------------------
    // 6. ROLE ASSIGNMENT & PARTICIPANT REMOVAL VIA SOCKET
    // -----------------------------------------------------------
    console.log("\n--- Testing Socket Participant Management ---");

    // Assign Role via socket
    const roleAssignPromise = new Promise((resolve) => {
      partSocket.once("role_assigned", (data) => resolve(data));
    });
    hostSocket.emit("assign_role", {
      roomCode,
      targetUserId: partUser._id,
      newRole: "moderator",
    });
    const roleData = await roleAssignPromise;
    assert(roleData && roleData.targetUserId === partUser._id && roleData.newRole === "moderator", "Host assigns role via socket; room receives 'role_assigned'");

    // Remove participant via socket
    const kickPromise = new Promise((resolve) => {
      partSocket.once("kicked", (data) => resolve(data));
    });
    const roomRemovePromise = new Promise((resolve) => {
      hostSocket.once("participant_removed", (data) => resolve(data));
    });
    hostSocket.emit("remove_participant", {
      roomCode,
      targetUserId: partUser._id,
    });
    const [kickData, removedData] = await Promise.all([
      kickPromise,
      roomRemovePromise,
    ]);
    assert(kickData && removedData && removedData.removedUserId === partUser._id, "Host removes participant; target socket receives 'kicked', room receives 'participant_removed'");

    // Leave room
    const userLeftPromise = new Promise((resolve) => {
      hostSocket.once("user_left", (data) => resolve(data));
    });
    modSocket.emit("leave_room", { roomCode });
    const userLeftData = await userLeftPromise;
    assert(userLeftData && userLeftData.userId === modUser._id, "User leaves room; room members receive 'user_left'");

    // Disconnect initial sockets
    hostSocket.disconnect();
    modSocket.disconnect();
    partSocket.disconnect();

    // -----------------------------------------------------------
    // 7. REAL-TIME GROUP CHAT & ADVANCED NOTIFICATIONS TEST
    // -----------------------------------------------------------
    console.log("\n--- Testing Real-Time Group Chat & Notifications ---");

    // Create a dedicated room for Chat & Notification Testing
    const chatRoomRes = await httpRequest("POST", "/api/rooms", {
      title: "Chat & Notifications Test Party",
      initialVideoId: "dQw4w9WgXcQ",
      initialVideoTitle: "Rick Astley",
    }, hostToken);
    const chatRoomCode = chatRoomRes.data.data.room.roomCode;
    assert(chatRoomCode, "Created dedicated room for chat and notification tests");

    // Moderator and Participant join chat room via REST
    await httpRequest("POST", `/api/rooms/${chatRoomCode}/join`, {}, modToken);
    await httpRequest("POST", `/api/rooms/${chatRoomCode}/join`, {}, partToken);

    // Promote modUser to moderator
    await httpRequest("PATCH", `/api/rooms/${chatRoomCode}/role`, {
      targetUserId: modUser._id,
      newRole: "moderator",
    }, hostToken);

    // Connect 3 new authenticated sockets
    const hostChatSocket = Client(BASE_URL, {
      auth: { token: hostToken },
      transports: ["websocket"],
    });
    const modChatSocket = Client(BASE_URL, {
      auth: { token: modToken },
      transports: ["websocket"],
    });
    const partChatSocket = Client(BASE_URL, {
      auth: { token: partToken },
      transports: ["websocket"],
    });

    await Promise.all([
      new Promise((res) => hostChatSocket.on("connect", res)),
      new Promise((res) => modChatSocket.on("connect", res)),
      new Promise((res) => partChatSocket.on("connect", res)),
    ]);

    // Host joins socket room
    await new Promise((resolve) => {
      hostChatSocket.emit("join_room", { roomCode: chatRoomCode }, resolve);
    });

    // Moderator joins: Host should receive join notification with actual username
    const hostChatJoinPromise = new Promise((resolve) => {
      hostChatSocket.once("user_joined", resolve);
    });
    await new Promise((resolve) => {
      modChatSocket.emit("join_room", { roomCode: chatRoomCode }, resolve);
    });
    const hostJoinData = await hostChatJoinPromise;
    assert(
      hostJoinData && hostJoinData.user?.username === modUser.username && hostJoinData.message?.includes("joined the party"),
      "Host receives join notification with actual username ('Rahul joined the party')"
    );

    // Participant joins: Mod should receive join notification
    const modJoinPromise = new Promise((resolve) => {
      modChatSocket.once("user_joined", resolve);
    });
    await new Promise((resolve) => {
      partChatSocket.emit("join_room", { roomCode: chatRoomCode }, resolve);
    });
    const modJoinData = await modJoinPromise;
    assert(
      modJoinData && modJoinData.user?.username === partUser.username,
      "Moderator receives Participant join notification with actual username"
    );

    // 7.1 Host sends chat message -> Moderator and Participant receive it in real-time
    const modReceiveMsgPromise1 = new Promise((resolve) => {
      modChatSocket.once("receive_message", resolve);
    });
    const partReceiveMsgPromise1 = new Promise((resolve) => {
      partChatSocket.once("receive_message", resolve);
    });

    hostChatSocket.emit("send_message", {
      roomCode: chatRoomCode,
      message: "Hello from Host!",
    });

    const [modMsg1, partMsg1] = await Promise.all([
      modReceiveMsgPromise1,
      partReceiveMsgPromise1,
    ]);

    assert(
      modMsg1?.message?.username === hostUser.username &&
      modMsg1?.message?.message === "Hello from Host!" &&
      partMsg1?.message?.username === hostUser.username,
      "Host sends message; Moderator and Participant receive it instantly via Socket.IO"
    );

    // 7.2 Moderator sends chat message -> Host and Participant receive it
    const hostReceiveMsgPromise2 = new Promise((resolve) => {
      hostChatSocket.once("receive_message", resolve);
    });
    const partReceiveMsgPromise2 = new Promise((resolve) => {
      partChatSocket.once("receive_message", resolve);
    });

    modChatSocket.emit("send_message", {
      roomCode: chatRoomCode,
      message: "Moderator replying here!",
    });

    const [hostMsg2, partMsg2] = await Promise.all([
      hostReceiveMsgPromise2,
      partReceiveMsgPromise2,
    ]);

    assert(
      hostMsg2?.message?.username === modUser.username &&
      partMsg2?.message?.username === modUser.username,
      "Moderator sends message; Host and Participant receive it instantly"
    );

    // 7.3 Participant sends chat message -> Host and Moderator receive it
    const hostReceiveMsgPromise3 = new Promise((resolve) => {
      hostChatSocket.once("receive_message", resolve);
    });
    const modReceiveMsgPromise3 = new Promise((resolve) => {
      modChatSocket.once("receive_message", resolve);
    });

    partChatSocket.emit("send_message", {
      roomCode: chatRoomCode,
      message: "Participant message test!",
    });

    const [hostMsg3, modMsg3] = await Promise.all([
      hostReceiveMsgPromise3,
      modReceiveMsgPromise3,
    ]);

    assert(
      hostMsg3?.message?.username === partUser.username &&
      modMsg3?.message?.username === partUser.username,
      "Participant sends message; Host and Moderator receive it instantly"
    );

    // 7.4 Validation: Empty message rejection
    const emptyMsgRes = await new Promise((resolve) => {
      partChatSocket.emit("send_message", { roomCode: chatRoomCode, message: "   " }, resolve);
    });
    assert(emptyMsgRes.success === false, "Empty message is rejected by backend validation");

    // 7.5 Validation: Message length limit (>500 chars)
    const longString = "A".repeat(501);
    const longMsgRes = await new Promise((resolve) => {
      partChatSocket.emit("send_message", { roomCode: chatRoomCode, message: longString }, resolve);
    });
    assert(longMsgRes.success === false, "Message exceeding 500 characters is rejected by backend");

    // 7.6 Security: XSS Sanitization
    const xssPromise = new Promise((resolve) => {
      hostChatSocket.once("receive_message", resolve);
    });
    partChatSocket.emit("send_message", {
      roomCode: chatRoomCode,
      message: "<script>alert('xss')</script>",
    });
    const xssReceived = await xssPromise;
    assert(
      xssReceived?.message?.message === "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;&#x2F;script&gt;",
      "Message content is sanitized/escaped to prevent XSS"
    );

    // 7.7 Room Isolation: Create Room 2, ensure messages are never leaked across rooms
    const room2Res = await httpRequest("POST", "/api/rooms", {
      title: "Isolated Room 2",
    }, hostToken);
    const room2Code = room2Res.data.data.room.roomCode;

    // Connect separate socket to Room 2
    const room2Socket = Client(BASE_URL, {
      auth: { token: hostToken },
      transports: ["websocket"],
    });
    await new Promise((res) => room2Socket.on("connect", res));
    await new Promise((resolve) => {
      room2Socket.emit("join_room", { roomCode: room2Code }, resolve);
    });

    let room2LeakDetected = false;
    room2Socket.on("receive_message", (data) => {
      if (data?.message?.message === "Secret message for Room 1") {
        room2LeakDetected = true;
      }
    });

    hostChatSocket.emit("send_message", {
      roomCode: chatRoomCode,
      message: "Secret message for Room 1",
    });

    await new Promise((r) => setTimeout(r, 600));
    assert(!room2LeakDetected, "Room isolation: Messages in Room 1 are never received by members in Room 2");
    room2Socket.disconnect();

    // 7.8 Backend Membership Validation: Non-member cannot send messages
    const outsiderRes = await httpRequest("POST", "/api/auth/register", {
      username: `outsider_${timestamp}`,
      email: `outsider_${timestamp}@example.com`,
      password: "password123",
    });
    const outsiderSocket = Client(BASE_URL, {
      auth: { token: outsiderRes.data.data.token },
      transports: ["websocket"],
    });
    await new Promise((res) => outsiderSocket.on("connect", res));

    const outsiderSendRes = await new Promise((resolve) => {
      outsiderSocket.emit("send_message", {
        roomCode: chatRoomCode,
        message: "I am not a member!",
      }, resolve);
    });
    assert(
      outsiderSendRes.success === false && outsiderSendRes.statusCode === 403,
      "Backend validates room membership: Non-member cannot send messages (HTTP 403)"
    );
    outsiderSocket.disconnect();

    // 7.9 Chat History Persistence in MongoDB
    const chatHistoryRes = await httpRequest("GET", `/api/rooms/${chatRoomCode}/messages`, null, hostToken);
    assert(
      chatHistoryRes.status === 200 &&
      Array.isArray(chatHistoryRes.data.data.messages) &&
      chatHistoryRes.data.data.messages.length >= 3,
      "Recent chat history is preserved in MongoDB and accessible via GET /api/rooms/:roomCode/messages"
    );

    // Verify chronological order and required fields
    const firstStoredMsg = chatHistoryRes.data.data.messages[0];
    assert(
      firstStoredMsg.room &&
      firstStoredMsg.username &&
      firstStoredMsg.message &&
      firstStoredMsg.timestamp,
      "Stored messages contain room ID, sender/username, message, and timestamp"
    );

    // 7.10 Participant Leaves -> Remaining members receive notification with actual username
    let partReceivedOwnLeave = false;
    partChatSocket.once("user_left", () => {
      partReceivedOwnLeave = true;
    });

    const hostLeaveNotifyPromise = new Promise((resolve) => {
      hostChatSocket.once("user_left", resolve);
    });

    partChatSocket.emit("leave_room", { roomCode: chatRoomCode });
    const hostLeaveData = await hostLeaveNotifyPromise;

    assert(
      hostLeaveData && hostLeaveData.username === partUser.username && hostLeaveData.message?.includes("left the party"),
      "Remaining members receive leave notification with actual username ('Amit left the party')"
    );
    assert(!partReceivedOwnLeave, "The user who left does NOT receive their own leave notification");

    // 7.11 Participant Removal / Kick Notification with actual username
    const kickNotifyPromise = new Promise((resolve) => {
      hostChatSocket.once("participant_removed", resolve);
    });

    hostChatSocket.emit("remove_participant", {
      roomCode: chatRoomCode,
      targetUserId: modUser._id,
    });
    const kickNotificationData = await kickNotifyPromise;

    assert(
      kickNotificationData &&
      kickNotificationData.removedUsername === modUser.username &&
      kickNotificationData.message?.includes("was removed from the party"),
      "Removal/Kick generates notification with actual username to remaining members ('Rahul was removed from the party')"
    );

    // Clean up chat test sockets
    hostChatSocket.disconnect();
    modChatSocket.disconnect();
    partChatSocket.disconnect();

    console.log("\n========================================================");
    console.log(` TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("========================================================\n");

    server.close();
    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error("Test execution failed with error:", error);
    if (server) server.close();
    process.exit(1);
  }
};

runAllTests();
