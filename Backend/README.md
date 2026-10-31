# YouTube Watch Party Backend

A robust, real-time, role-based backend for synchronized YouTube watch parties built with **Node.js**, **Express.js**, **MongoDB (Mongoose)**, and **Socket.IO**.

---

## Table of Contents
1. [Overview & Architecture](#overview--architecture)
2. [Technology Stack](#technology-stack)
3. [Folder Structure](#folder-structure)
4. [Role-Based Access Control (RBAC)](#role-based-access-control-rbac)
5. [Installation & Setup](#installation--setup)
6. [Environment Variables](#environment-variables)
7. [Running the Application](#running-the-application)
8. [Automated Test Suite](#automated-test-suite)
9. [REST API Documentation](#rest-api-documentation)
10. [Socket.IO Events Documentation](#socketio-events-documentation)
11. [Testing with cURL & Postman](#testing-with-curl--postman)
12. [Security & Design Considerations](#security--design-considerations)

---

## Overview & Architecture

The YouTube Watch Party system allows multiple users to watch YouTube videos together with synchronized playback. 

```mermaid
flowchart TD
    Client1["Host (Client)"] <-->|Socket.IO (JWT Auth)| SocketServer["Socket.IO Server"]
    Client2["Moderator (Client)"] <-->|Socket.IO (JWT Auth)| SocketServer
    Client3["Participant (Client)"] <-->|Socket.IO (JWT Auth)| SocketServer

    Client1 & Client2 & Client3 <-->|HTTP / REST (JWT Bearer)| ExpressApp["Express.js API"]

    SocketServer <--> RoomService["Room Service & Business Logic"]
    ExpressApp <--> RoomService

    RoomService <--> MongoDB[("MongoDB Atlas / Database")]
```

### Key Highlights
- **Real-Time Video Synchronization**: Synchronizes playback state (`play`, `pause`, `seek`, `change_video`, and `sync_state`) across all room members with real-time elapsed time calculation.
- **Role-Based Access Control**: Strict backend verification. Host and Moderator have direct controls; participants can only request changes.
- **Participant Approval System**: Participants can submit playback change requests, which the Host or Moderator can approve or reject in real time.
- **Strict Backend Security**: JWT authentication for both REST endpoints and Socket.IO connections. All role validations happen on the server—client-provided roles are never trusted.
- **Robust URL & Video ID Validation**: Supports raw 11-character YouTube video IDs and all standard YouTube URLs (`watch?v=`, `youtu.be/`, `embed/`).

---

## Technology Stack

- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Real-Time Communication**: Socket.IO (v4.8+)
- **Authentication**: JSON Web Tokens (`jsonwebtoken`) & `bcryptjs`
- **Configuration & Utilities**: `dotenv`, `cors`, `crypto`

---

## Folder Structure

```
Backend/
├── config/
│   └── db.js                 # MongoDB connection logic
├── controllers/
│   ├── auth.controller.js    # Register, login, and user profile
│   └── room.controller.js    # Room CRUD, role assignment, requests
├── middleware/
│   └── auth.middleware.js    # JWT Bearer authentication middleware
├── models/
│   ├── Room.js               # Room schema, participants, requests, sync logic
│   └── User.js               # User schema, password hashing, methods
├── routes/
│   ├── auth.routes.js        # Authentication endpoints (/api/auth)
│   └── room.routes.js        # Room management endpoints (/api/rooms)
├── services/
│   └── room.service.js       # Core business logic for rooms, state & permissions
├── sockets/
│   ├── room.socket.js        # Modular Socket.IO room event handlers
│   └── socket.js             # Socket.IO initialization & JWT handshake auth
├── test/
│   └── test_all.js           # Comprehensive automated end-to-end test suite
├── utils/
│   ├── generateRoomCode.js   # 6-character uppercase room code generator
│   ├── token.js              # JWT sign and verify helpers
│   └── youtubeValidator.js   # YouTube video ID regex and extractor
├── .env                      # Environment variables
├── .env.example              # Template environment configuration
├── .gitignore                # Git ignore rules
├── app.js                    # Express app configuration & middleware
├── package.json              # Project dependencies and npm scripts
└── server.js                 # HTTP + Socket.IO server entry point
```

---

## Role-Based Access Control (RBAC)

| Capability | Host | Moderator | Participant |
| :--- | :---: | :---: | :---: |
| Play / Pause video directly | ✅ Yes | ✅ Yes | ❌ Request Only |
| Seek video position directly | ✅ Yes | ✅ Yes | ❌ Request Only |
| Change YouTube video | ✅ Yes | ✅ Yes | ❌ Request Only |
| Request playback change | ✅ Yes | ✅ Yes | ✅ Yes |
| Approve / Reject requests | ✅ Yes | ✅ Yes | ❌ No |
| Assign Moderator role | ✅ Yes | ❌ No | ❌ No |
| Transfer Host role | ✅ Yes | ❌ No | ❌ No |
| Remove participants | ✅ Yes | ✅ (Participants only) | ❌ No |

---

## Installation & Setup

### 1. Clone & Navigate to Backend
```bash
cd "C:\Users\moik2\OneDrive\Desktop\YouTube Watch Party\Backend"
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env` (or configure your existing `.env`):
```bash
cp .env.example .env
```

---

## Environment Variables

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `PORT` | Port the Express server listens on | `3000` |
| `MONGO_URL` | MongoDB connection URI string | `mongodb+srv://...` |
| `JWT_SECRET` | Secret key used for signing JWTs | `your_secret_key` |
| `JWT_EXPIRES_IN` | Token expiration duration | `7d` |
| `CLIENT_URL` | Allowed CORS origins (or `*`) | `*` |

---

## Running the Application

### Development Mode (with file watching)
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

Once running:
- **Server URL**: `http://localhost:3000`
- **Health Check**: `http://localhost:3000/health`
- **Socket.IO**: `ws://localhost:3000`

---

## Automated Test Suite

A complete test suite is included in `test/test_all.js`. It boots an in-memory test server, connects real HTTP and Socket.IO clients, verifies all 31 endpoints and events, role boundaries, and cleanly exits.

To run tests:
```bash
npm test
```

Sample output:
```text
========================================================
   STARTING WATCH PARTY END-TO-END TEST SUITE
========================================================
...
========================================================
 TEST SUMMARY: 31 PASSED, 0 FAILED
========================================================
```

---

## REST API Documentation

### Base URL: `/api`

### 1. Authentication Endpoints

#### Register User
- **POST** `/api/auth/register`
- **Access**: Public
- **Body**:
  ```json
  {
    "username": "alice",
    "email": "alice@example.com",
    "password": "password123"
  }
  ```
- **Response** (`201 Created`):
  ```json
  {
    "success": true,
    "message": "User registered successfully.",
    "data": {
      "user": {
        "_id": "6722...",
        "username": "alice",
        "email": "alice@example.com",
        "avatar": "https://api.dicebear.com/..."
      },
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6..."
    }
  }
  ```

#### Login User
- **POST** `/api/auth/login`
- **Access**: Public
- **Body**:
  ```json
  {
    "email": "alice@example.com",
    "password": "password123"
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "message": "Login successful.",
    "data": {
      "user": { "_id": "...", "username": "alice", "email": "..." },
      "token": "eyJhbGciOi..."
    }
  }
  ```

#### Current User Profile
- **GET** `/api/auth/me`
- **Headers**: `Authorization: Bearer <token>`
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "data": { "user": { "_id": "...", "username": "alice" } }
  }
  ```

---

### 2. Room Management Endpoints

*(All room endpoints require `Authorization: Bearer <token>`)*

#### Create Room
- **POST** `/api/rooms`
- **Body**:
  ```json
  {
    "title": "Anime Watch Party",
    "initialVideoId": "dQw4w9WgXcQ",
    "initialVideoTitle": "Rick Astley"
  }
  ```
- **Response** (`201 Created`):
  ```json
  {
    "success": true,
    "message": "Room created successfully.",
    "data": {
      "room": {
        "roomCode": "WP8K2M",
        "title": "Anime Watch Party",
        "host": { "username": "alice", ... },
        "participants": [
          { "user": { "username": "alice" }, "role": "host", "isOnline": true }
        ],
        "currentVideo": { "videoId": "dQw4w9WgXcQ", "title": "Rick Astley" },
        "playbackState": { "isPlaying": false, "currentTime": 0 }
      }
    }
  }
  ```

#### Get Room Details & Sync State
- **GET** `/api/rooms/:roomCode`
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "data": {
      "room": { ... },
      "syncState": {
        "roomCode": "WP8K2M",
        "currentVideo": { "videoId": "dQw4w9WgXcQ", "title": "Rick Astley" },
        "playbackState": { "isPlaying": false, "currentTime": 0 },
        "onlineCount": 1,
        "totalParticipants": 1
      }
    }
  }
  ```

#### Join Room
- **POST** `/api/rooms/:roomCode/join` (or `POST /api/rooms/join` with `{"roomCode": "..."}`)
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "message": "Joined room successfully.",
    "data": { "room": { ... }, "syncState": { ... } }
  }
  ```

#### Leave Room
- **POST** `/api/rooms/:roomCode/leave`
- **Body** (optional): `{"permanent": true}`
- **Response** (`200 OK`)

#### Assign Moderator / Role
- **PATCH** `/api/rooms/:roomCode/role`
- **Access**: Host only
- **Body**:
  ```json
  {
    "targetUserId": "6722...",
    "newRole": "moderator"
  }
  ```
- **Response** (`200 OK`)

#### Remove Participant
- **DELETE** `/api/rooms/:roomCode/participants/:userId`
- **Access**: Host or Moderator

#### Submit Playback Change Request
- **POST** `/api/rooms/:roomCode/requests`
- **Access**: Any participant
- **Body**:
  ```json
  {
    "type": "seek",
    "payload": { "currentTime": 45 }
  }
  ```

#### Approve or Reject Request
- **PATCH** `/api/rooms/:roomCode/requests/:requestId`
- **Access**: Host or Moderator
- **Body**:
  ```json
  {
    "status": "approved"
  }
  ```

#### Directly Change Video
- **PATCH** `/api/rooms/:roomCode/video`
- **Access**: Host or Moderator
- **Body**:
  ```json
  {
    "videoId": "https://www.youtube.com/watch?v=kJQP7kiw5Fk",
    "videoTitle": "Despacito"
  }
  ```

---

## Socket.IO Events Documentation

### Socket Connection & Handshake Authentication
To establish a Socket.IO connection, pass your JWT token in the `auth` object:
```javascript
const socket = io("http://localhost:3000", {
  auth: {
    token: "<JWT_TOKEN>"
  }
});
```

---

### Client-to-Server Events

| Event Name | Payload | Allowed Roles | Description |
| :--- | :--- | :--- | :--- |
| `join_room` | `{ roomCode: string }` | Any authenticated user | Joins room, returns current `sync_state` to client and emits `user_joined` to others. |
| `leave_room` | `{ roomCode: string }` | Any member | Leaves the room, updates status, broadcasts `user_left`. |
| `play` | `{ roomCode: string, currentTime: number }` | Host, Moderator | Starts playback at given timestamp; broadcasts `play` and `sync_state`. |
| `pause` | `{ roomCode: string, currentTime: number }` | Host, Moderator | Pauses playback at given timestamp; broadcasts `pause` and `sync_state`. |
| `seek` | `{ roomCode: string, currentTime: number }` | Host, Moderator | Seeks playback to given timestamp; broadcasts `seek` and `sync_state`. |
| `change_video` | `{ roomCode: string, videoId: string, title?: string }` | Host, Moderator | Validates YouTube video ID/URL, updates video, resets time to 0, broadcasts `change_video` and `sync_state`. |
| `sync_state` | `{ roomCode: string }` | Any member | Fetches calculated real-time playback state for the room. |
| `assign_role` | `{ roomCode: string, targetUserId: string, newRole: "host" \| "moderator" \| "participant" }` | Host | Updates participant role and broadcasts `role_assigned`. |
| `remove_participant` | `{ roomCode: string, targetUserId: string }` | Host, Moderator | Removes user, emits `kicked` to their socket, broadcasts `participant_removed`. |
| `request_playback_change` | `{ roomCode: string, type: "play" \| "pause" \| "seek" \| "change_video", payload: object }` | Participant | Creates a pending request and broadcasts `request_playback_change` to room. |
| `approve_request` | `{ roomCode: string, requestId: string }` | Host, Moderator | Approves request, applies change, emits `approve_request` and `sync_state`. |
| `reject_request` | `{ roomCode: string, requestId: string }` | Host, Moderator | Rejects request and emits `reject_request`. |

---

### Server-to-Client (Broadcast) Events

| Event Name | Payload Structure | Description |
| :--- | :--- | :--- |
| `sync_state` | `{ roomCode, currentVideo, playbackState: { isPlaying, currentTime, lastUpdatedAt }, onlineCount, totalParticipants, myRole }` | Emitted when joining or whenever playback state changes. |
| `user_joined` | `{ user: { id, username, email }, role, onlineCount }` | Sent to other members when a user joins. |
| `user_left` | `{ userId, username, onlineCount }` | Sent when a user leaves or disconnects. |
| `play` | `{ currentTime, isPlaying: true, updatedBy }` | Sent when playback starts. |
| `pause` | `{ currentTime, isPlaying: false, updatedBy }` | Sent when playback pauses. |
| `seek` | `{ currentTime, updatedBy }` | Sent when playback is seeked. |
| `change_video` | `{ videoId, title, currentTime: 0, isPlaying: false, updatedBy }` | Sent when a new video is loaded. |
| `request_playback_change` | `{ request: { _id, user, type, payload, status } }` | Sent when a participant requests a change. |
| `approve_request` | `{ requestId, request, syncState }` | Sent when request is approved. |
| `reject_request` | `{ requestId, request }` | Sent when request is rejected. |
| `role_assigned` | `{ targetUserId, newRole, assignedBy, participants }` | Sent when a user's role is updated. |
| `participant_removed` | `{ removedUserId, removedBy, participants }` | Sent to the room when a participant is kicked. |
| `kicked` | `{ roomCode, message }` | Sent directly to the removed user's socket. |

---

## Testing with cURL & Postman

### 1. Register a Host User
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"john_host","email":"john@example.com","password":"password123"}'
```

### 2. Create a Room
```bash
curl -X POST http://localhost:3000/api/rooms \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <HOST_TOKEN>" \
  -d '{"title":"Friday Chill","initialVideoId":"dQw4w9WgXcQ"}'
```

### 3. Join the Room as Participant
```bash
curl -X POST http://localhost:3000/api/rooms/<ROOM_CODE>/join \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <PARTICIPANT_TOKEN>"
```

### 4. Promote Participant to Moderator
```bash
curl -X PATCH http://localhost:3000/api/rooms/<ROOM_CODE>/role \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <HOST_TOKEN>" \
  -d '{"targetUserId":"<PARTICIPANT_USER_ID>","newRole":"moderator"}'
```

---

## Security & Design Considerations

1. **Server-Side Validation**: Role permissions are computed using the user's ID stored in the verified JWT token and matched against MongoDB room participant records. Client-provided role strings are never accepted for authorization.
2. **Real-Time Elapsed Playback Time**: When a video is playing, `syncState.playbackState.currentTime` dynamically factors in elapsed seconds (`(Date.now() - lastUpdatedAt) / 1000`) so participants joining mid-stream receive the exact real-time playback position without desync.
3. **YouTube Input Sanitization**: Regular expression filters ensure only legitimate 11-character YouTube video IDs or URLs are accepted, preventing injection and broken player embeds.
4. **Graceful Disconnects**: Disconnected sockets are tracked and their room participant record is automatically toggled to `isOnline: false` with broadcast updates to other room members.
