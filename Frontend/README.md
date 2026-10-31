# YouTube Watch Party – React Frontend

A modern, responsive, real-time React frontend for the YouTube Watch Party System. Built with **React 19**, **Vite**, **Socket.IO Client**, **React Router DOM**, **Axios**, **Lucide Icons**, and the **YouTube IFrame Player API**.

---

## Features

- **YouTube Synchronization**: Synchronized play, pause, seek, and video changes in lockstep across all participants.
- **Infinite-Loop Prevention**: Distinguishes between remote Socket.IO broadcasts and local user actions.
- **Strict Role-Based Access Control**:
  - **Host**: Full room control, change videos, assign/demote Moderators, kick participants, approve/reject requests.
  - **Moderator**: Direct playback control, change videos, kick participants, approve/reject requests.
  - **Participant**: Synced video viewing, submit playback change requests to the Host/Moderator.
- **Real-Time Participant Panel**: Live online/offline status indicators, role badges (`HOST`, `MODERATOR`, `PARTICIPANT`), and participant management.
- **Participant Approval System**: In-room modal for participants to request seeks, pauses, plays, or new videos; real-time approve/reject buttons for Host and Moderator.
- **Session Restoration**: Automatically restores the authenticated user session on page refresh via `GET /api/auth/me`.
- **Protected Routes**: Route guards for `/dashboard`, `/create-room`, `/join-room`, and `/room/:roomCode`.
- **Dark YouTube Theme**: Clean dark theme with YouTube red accents, responsive cards, and custom video timeline slider.

---

## Prerequisites

- Node.js (v18+)
- Backend running on `http://localhost:3000`

---

## Installation & Setup

1. Open your terminal and navigate to the `Frontend` folder:
   ```bash
   cd "C:\Users\moik2\OneDrive\Desktop\YouTube Watch Party\Frontend"
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Ensure `Frontend/.env` exists and contains:
   ```env
   VITE_API_URL=http://localhost:3000
   VITE_SOCKET_URL=http://localhost:3000
   ```

---

## Running the Application

### 1. Start the Backend Server (Terminal 1)
```bash
cd "C:\Users\moik2\OneDrive\Desktop\YouTube Watch Party\Backend"
npm start
```
*Backend runs on `http://localhost:3000`*

### 2. Start the Frontend Development Server (Terminal 2)
```bash
cd "C:\Users\moik2\OneDrive\Desktop\YouTube Watch Party\Frontend"
npm run dev
```
*Frontend runs on `http://localhost:5173`*

---

## Step-by-Step Multi-User Testing Guide

To test real-time video synchronization and role permissions on your local machine:

### 1. Open Two Separate Browser Sessions
- **Session 1 (Host)**: Open a standard browser window at `http://localhost:5173`.
- **Session 2 (Participant)**: Open an **Incognito / Private Window** (or a second browser like Edge/Firefox) at `http://localhost:5173`.

### 2. Register & Login Both Users
- In **Session 1**: Register as `alice` (`alice@example.com`, password: `password123`).
- In **Session 2**: Register as `bob` (`bob@example.com`, password: `password123`).

### 3. Create a Room (Session 1 - Host)
1. In Session 1, click **"Create Watch Party"** or **"New Watch Party"**.
2. Enter room title (e.g., `Movie Night`) and click **"Generate Room"**.
3. Note the generated 6-character room code (e.g., `SK9V2T`).
4. Click **"Enter Watch Room"**. You will enter the room as the **HOST**.

### 4. Join the Room (Session 2 - Participant)
1. In Session 2, click **"Join with Code"** on the dashboard.
2. Enter the room code `SK9V2T` and click **"Join Room"**.
3. You will enter the room as a **PARTICIPANT**.
4. Both windows will update their participant list in real-time (`Alice (Host)` and `Bob (Participant)`).

### 5. Test Synchronized Playback
1. **Play / Pause**: In Session 1 (Alice), click **Play**. Both Session 1 and Session 2 will start playing the video simultaneously. Click **Pause**, and both will pause.
2. **Seek**: In Session 1, drag the timeline slider or click **+10s**. Both players will seek to the exact timestamp in lockstep.
3. **Change Video**: In Session 1, paste a YouTube link (e.g., `https://www.youtube.com/watch?v=kJQP7kiw5Fk`) and click **"Load Video"**. Both sessions will transition to the new video at time 0.

### 6. Test Participant Approval System
1. In Session 2 (Bob), notice that direct playback controls are locked.
2. Click **"Request Playback Change"**.
3. Choose `Seek to Time`, enter `45` seconds, and click **"Submit Request"**.
4. In Session 1 (Alice), the request appears instantly under **"Playback Requests"**.
5. Click **"Approve"**. The video immediately jumps to 45 seconds for both Alice and Bob!

### 7. Test Role Assignment & Removal
1. In Session 1, find Bob in the participants list and click **"Make Mod"**.
2. Bob's badge updates to `MODERATOR`. Bob's timeline controls unlock, allowing Bob to play, pause, and seek directly.
3. In Session 1, click **"Kick"** next to a participant. The participant receives an alert and is returned to their dashboard.
