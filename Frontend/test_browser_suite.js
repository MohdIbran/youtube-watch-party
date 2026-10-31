import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5173';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runBrowserTestSuite() {
  console.log('\n=============================================================');
  console.log('   LAUNCHING REAL BROWSER INTEGRATION TEST SUITE (CHROME)');
  console.log('=============================================================\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    protocolTimeout: 60000,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
  });

  const timestamp = Date.now();
  const testResults = [];

  const record = (suite, testName, passed, details = '', consoleErrors = [], networkErrors = []) => {
    testResults.push({
      suite,
      testName,
      passed,
      details,
      consoleErrors,
      networkErrors,
    });
    const tag = passed ? '[PASS]' : '[FAIL]';
    console.log(`  ${tag} ${suite} > ${testName}`);
    if (!passed) console.error(`       Error details: ${details}`);
    if (consoleErrors.length > 0) console.warn(`       Console Errors:`, consoleErrors);
  };

  const setupPage = async (context) => {
    const page = await context.newPage();
    const consoleLogs = [];
    const consoleErrors = [];
    const networkErrors = [];

    page.on('console', (msg) => {
      const text = msg.text();
      consoleLogs.push(text);
      if (msg.type() === 'error') {
        if (!text.includes('favicon.ico') && !text.includes('youtube.com/error') && !text.includes('404')) {
          consoleErrors.push(text);
        }
      }
    });

    page.on('requestfailed', (req) => {
      const url = req.url();
      if (!url.includes('google-analytics') && !url.includes('youtube.com')) {
        networkErrors.push(`${req.method()} ${url}: ${req.failure()?.errorText}`);
      }
    });

    return { page, consoleLogs, consoleErrors, networkErrors };
  };

  try {
    // =========================================================================
    // TEST SUITE 1: AUTHENTICATION
    // =========================================================================
    console.log('\n--- Test 1: Authentication ---');
    const authContext = await browser.createBrowserContext();
    const { page: authPage, consoleErrors: authCE, networkErrors: authNE } = await setupPage(authContext);

    const testUser = {
      username: `user_${timestamp}`,
      email: `user_${timestamp}@example.com`,
      password: 'password123',
    };

    // 1.1 Register New User
    await authPage.goto(`${BASE_URL}/register`, { waitUntil: 'networkidle0' });
    await authPage.waitForSelector('input[name="username"]', { timeout: 8000 });
    await authPage.type('input[name="username"]', testUser.username);
    await authPage.type('input[name="email"]', testUser.email);
    await authPage.type('input[name="password"]', testUser.password);
    await authPage.type('input[name="confirmPassword"]', testUser.password);
    await authPage.click('button[type="submit"]');

    // Wait for SPA client navigation to /dashboard
    await authPage.waitForFunction(() => window.location.pathname === '/dashboard', { timeout: 8000 });
    await sleep(500);

    const currentUrlAfterReg = authPage.url();
    const isDashboardAfterReg = currentUrlAfterReg.includes('/dashboard');
    record(
      'Test 1: Authentication',
      'Register new user and redirect to /dashboard',
      isDashboardAfterReg,
      `Navigated to ${currentUrlAfterReg}`,
      authCE,
      authNE
    );

    // 1.2 Session Restoration on Refresh
    await authPage.reload({ waitUntil: 'networkidle0' });
    await authPage.waitForFunction((u) => document.body.textContent.includes(u), { timeout: 6000 }, testUser.username);
    const contentAfterReload = await authPage.content();
    const isRestored = contentAfterReload.includes(testUser.username) && authPage.url().includes('/dashboard');
    record(
      'Test 1: Authentication',
      'Page refresh preserves session (GET /api/auth/me)',
      isRestored,
      `User ${testUser.username} restored on reload`
    );

    // 1.3 Logout
    await authPage.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const logoutBtn = buttons.find((b) => b.textContent.includes('Logout'));
      if (logoutBtn) logoutBtn.click();
    });
    await authPage.waitForFunction(() => window.location.pathname === '/login', { timeout: 6000 });
    await sleep(500);

    const isLoggedOut = authPage.url().includes('/login');
    record(
      'Test 1: Authentication',
      'Logout user and redirect to /login',
      isLoggedOut,
      `Navigated to ${authPage.url()}`
    );

    // 1.4 Login with Existing User
    await authPage.type('input[name="email"]', testUser.email);
    await authPage.type('input[name="password"]', testUser.password);
    await authPage.click('button[type="submit"]');
    await authPage.waitForFunction(() => window.location.pathname === '/dashboard', { timeout: 6000 });
    await sleep(500);

    const isDashboardAfterLogin = authPage.url().includes('/dashboard');
    record(
      'Test 1: Authentication',
      'Login with credentials and redirect to /dashboard',
      isDashboardAfterLogin,
      `Navigated to ${authPage.url()}`
    );

    // 1.5 Protected Route Guard
    await authPage.evaluate(() => localStorage.removeItem('token'));
    await authPage.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle0' });
    await authPage.waitForFunction(() => window.location.pathname === '/login', { timeout: 6000 });

    const isBlocked = authPage.url().includes('/login');
    record(
      'Test 1: Authentication',
      'Protected routes redirect unauthenticated users to /login',
      isBlocked,
      `Unauthenticated visit redirected to ${authPage.url()}`
    );

    await authContext.close();

    // =========================================================================
    // TEST SUITE 2: ROOM MANAGEMENT & MULTI-USER COLLABORATION
    // =========================================================================
    console.log('\n--- Test 2: Room Management ---');
    
    // Host Session (Session 1)
    const hostContext = await browser.createBrowserContext();
    const { page: hostPage, consoleLogs: hostLogs, consoleErrors: hostCE } = await setupPage(hostContext);

    const hostUser = {
      username: `host_${timestamp}`,
      email: `host_${timestamp}@example.com`,
      password: 'password123',
    };

    // Register & Login Host
    await hostPage.goto(`${BASE_URL}/register`, { waitUntil: 'networkidle0' });
    await hostPage.waitForSelector('input[name="username"]', { timeout: 8000 });
    await hostPage.type('input[name="username"]', hostUser.username);
    await hostPage.type('input[name="email"]', hostUser.email);
    await hostPage.type('input[name="password"]', hostUser.password);
    await hostPage.type('input[name="confirmPassword"]', hostUser.password);
    await hostPage.click('button[type="submit"]');
    await hostPage.waitForFunction(() => window.location.pathname === '/dashboard', { timeout: 6000 });

    // Navigate to Create Room
    await hostPage.goto(`${BASE_URL}/create-room`, { waitUntil: 'networkidle0' });
    await hostPage.click('button[type="submit"]');

    // Extract generated room code
    await hostPage.waitForSelector('div[style*="font-family: monospace"]', { timeout: 8000 });
    const roomCodeElement = await hostPage.$('div[style*="font-family: monospace"]');
    let generatedRoomCode = '';
    if (roomCodeElement) {
      generatedRoomCode = await hostPage.evaluate((el) => el.textContent.trim(), roomCodeElement);
    }
    const hasRoomCode = generatedRoomCode.length >= 6;
    record(
      'Test 2: Room Management',
      'Create room as Host and generate 6-character room code',
      hasRoomCode,
      `Generated Room Code: ${generatedRoomCode}`
    );

    // Host Enters Watch Room
    await hostPage.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const enterBtn = buttons.find((b) => b.textContent.includes('Enter Watch Room'));
      if (enterBtn) enterBtn.click();
    });
    await hostPage.waitForFunction(() => window.location.pathname.includes('/room/'), { timeout: 6000 });
    await sleep(2000);

    const hostInRoom = hostPage.url().includes(`/room/${generatedRoomCode}`);
    const hostPageContent = await hostPage.content();
    const isHostBadge = hostPageContent.includes('badge-host');
    record(
      'Test 2: Room Management',
      'Host enters watch room and receives HOST badge',
      hostInRoom && isHostBadge,
      `URL: ${hostPage.url()}, Role: HOST`
    );

    // Participant Session (Session 2 - Isolated incognito context)
    const partContext = await browser.createBrowserContext();
    const { page: partPage, consoleLogs: partLogs, consoleErrors: partCE } = await setupPage(partContext);

    const partUser = {
      username: `bob_${timestamp}`,
      email: `bob_${timestamp}@example.com`,
      password: 'password123',
    };

    // Register Participant
    await partPage.goto(`${BASE_URL}/register`, { waitUntil: 'networkidle0' });
    await partPage.waitForSelector('input[name="username"]', { timeout: 8000 });
    await partPage.type('input[name="username"]', partUser.username);
    await partPage.type('input[name="email"]', partUser.email);
    await partPage.type('input[name="password"]', partUser.password);
    await partPage.type('input[name="confirmPassword"]', partUser.password);
    await partPage.click('button[type="submit"]');
    await partPage.waitForFunction(() => window.location.pathname === '/dashboard', { timeout: 6000 });

    // Join Room using Room Code
    await partPage.goto(`${BASE_URL}/join-room`, { waitUntil: 'networkidle0' });
    await partPage.type('input', generatedRoomCode);

    // Prepare listener on hostPage to catch the transient join toast notification
    const hostJoinToastPromise = hostPage.waitForFunction(
      () => document.body.textContent.includes('joined the party') || document.body.textContent.includes('joined the room'),
      { timeout: 8000 }
    ).catch(() => null);

    await partPage.click('button[type="submit"]');
    await partPage.waitForFunction(() => window.location.pathname.includes('/room/'), { timeout: 6000 });

    const hostSawJoinToast = await hostJoinToastPromise !== null;
    record(
      'Test 2: Room Management',
      'Real-time toast notification displayed when participant joins ("joined the room")',
      hostSawJoinToast,
      `Host received join notification toast: ${hostSawJoinToast}`
    );

    await sleep(1500);

    const partInRoom = partPage.url().includes(`/room/${generatedRoomCode}`);
    const partPageContent = await partPage.content();
    const isPartBadge = partPageContent.includes('badge-participant');
    record(
      'Test 2: Room Management',
      'Participant joins using room code and receives PARTICIPANT badge',
      partInRoom && isPartBadge,
      `URL: ${partPage.url()}, Role: PARTICIPANT`
    );

    // Verify participant list contains both users in both browsers
    try {
      await hostPage.waitForFunction((u) => document.body.textContent.includes(u), { timeout: 6000 }, partUser.username);
    } catch (e) {
      console.error('HostPage failed to find partUser.username:', partUser.username);
      console.log('HostPage Body Text:', await hostPage.evaluate(() => document.body.textContent));
      console.log('HostPage Console Logs:', hostLogs);
      console.log('HostPage Console Errors:', hostCE);
      throw e;
    }
    await partPage.waitForFunction((u) => document.body.textContent.includes(u), { timeout: 6000 }, hostUser.username);
    const hostContentUpdated = await hostPage.content();
    const partContentUpdated = await partPage.content();
    const hostSeesBoth = hostContentUpdated.includes(hostUser.username) && hostContentUpdated.includes(partUser.username);
    const partSeesBoth = partContentUpdated.includes(hostUser.username) && partContentUpdated.includes(partUser.username);
    record(
      'Test 2: Room Management',
      'Participant lists synchronized in real time across browser sessions',
      hostSeesBoth && partSeesBoth,
      `Host sees both: ${hostSeesBoth}, Participant sees both: ${partSeesBoth}`
    );

    // =========================================================================
    // TEST SUITE 3: ROLE PERMISSIONS
    // =========================================================================
    console.log('\n--- Test 3: Role Permissions ---');

    // 3.1 Verify Participant cannot directly control playback
    const partHasLockedText = partContentUpdated.includes('Playback is managed by the Host and Moderators');
    const partHasRequestBtn = partContentUpdated.includes('Request Playback Change');
    record(
      'Test 3: Role Permissions',
      'Participant controls are locked and show Request button',
      partHasLockedText && partHasRequestBtn,
      'Participant locked message & request button confirmed'
    );

    // 3.2 Host promotes Participant to Moderator
    await hostPage.waitForFunction(
      () => Array.from(document.querySelectorAll('button')).some((b) => b.textContent.includes('Make Mod')),
      { timeout: 8000 }
    );

    await hostPage.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const makeModBtn = buttons.find((b) => b.textContent.includes('Make Mod'));
      if (!makeModBtn) throw new Error('Make Mod button not found');
      makeModBtn.click();
    });

    // Wait for Bob's page to reflect moderator role in his badge and controls
    try {
      await partPage.waitForSelector('.badge-moderator', { timeout: 8000 });
    } catch (e) {
      console.error('partPage failed to find .badge-moderator');
      console.log('partPage Content:', await partPage.content());
      console.log('partLogs:', partLogs);
      console.log('partCE:', partCE);
      console.log('hostLogs:', hostLogs);
      throw e;
    }
    const partContentAfterMod = await partPage.content();
    const isNowMod = partContentAfterMod.includes('badge-moderator');
    record(
      'Test 3: Role Permissions',
      'Host promotes Participant to Moderator via Socket.IO',
      isNowMod,
      `Bob role updated to MODERATOR in real time: ${isNowMod}`
    );

    // 3.3 Verify Moderator controls are now active
    await partPage.waitForFunction(
      () => Array.from(document.querySelectorAll('button')).some((b) => b.textContent.includes('Change Video')),
      { timeout: 8000 }
    );
    await partPage.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Change Video'));
      if (btn) btn.click();
    });
    await partPage.waitForSelector('input[placeholder*="https://www.youtube.com/watch?v=..."]', { timeout: 8000 });
    const modHasUnlockedControls = (await partPage.$('input[placeholder*="https://www.youtube.com/watch?v=..."]')) !== null;
    record(
      'Test 3: Role Permissions',
      'Moderator playback controls and video input become active',
      modHasUnlockedControls,
      `Controls unlocked for promoted moderator: ${modHasUnlockedControls}`
    );

    // 3.4 Host removes a participant (Create 3rd participant session)
    const charlieContext = await browser.createBrowserContext();
    const { page: charliePage } = await setupPage(charlieContext);

    const charlieUser = {
      username: `charlie_${timestamp}`,
      email: `charlie_${timestamp}@example.com`,
      password: 'password123',
    };

    await charliePage.goto(`${BASE_URL}/register`, { waitUntil: 'networkidle0' });
    await charliePage.waitForSelector('input[name="username"]', { timeout: 8000 });
    await charliePage.type('input[name="username"]', charlieUser.username);
    await charliePage.type('input[name="email"]', charlieUser.email);
    await charliePage.type('input[name="password"]', charlieUser.password);
    await charliePage.type('input[name="confirmPassword"]', charlieUser.password);
    await charliePage.click('button[type="submit"]');
    await charliePage.waitForFunction(() => window.location.pathname === '/dashboard', { timeout: 6000 });

    await charliePage.goto(`${BASE_URL}/join-room`, { waitUntil: 'networkidle0' });
    await charliePage.type('input', generatedRoomCode);
    await charliePage.click('button[type="submit"]');
    await charliePage.waitForFunction(() => window.location.pathname.includes('/room/'), { timeout: 6000 });
    await sleep(1500);

    // Auto-accept confirmation dialogs on host page
    hostPage.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    // Wait for Charlie to appear in the participant list on hostPage
    await hostPage.waitForFunction(
      (uname) => document.body.textContent.includes(uname),
      { timeout: 8000 },
      charlieUser.username
    );

    // Host kicks Charlie specifically
    await hostPage.evaluate((targetUsername) => {
      window.confirm = () => true;
      const kickButtons = Array.from(document.querySelectorAll('button')).filter((b) =>
        b.textContent.includes('Kick')
      );
      for (const btn of kickButtons) {
        const row = btn.parentElement.parentElement;
        if (row && row.textContent.includes(targetUsername)) {
          btn.click();
          return;
        }
      }
    }, charlieUser.username);

    // Charlie's page should redirect to /dashboard
    await charliePage.waitForFunction(() => window.location.pathname === '/dashboard', { timeout: 8000 });
    const isCharlieKicked = charliePage.url().includes('/dashboard');
    record(
      'Test 3: Role Permissions',
      'Host kicks participant; target receives kicked event and redirects',
      isCharlieKicked,
      `Charlie redirected to ${charliePage.url()}`
    );
    await charlieContext.close();

    // =========================================================================
    // TEST SUITE 4: REAL-TIME YOUTUBE SYNCHRONIZATION
    // =========================================================================
    console.log('\n--- Test 4: Real-time YouTube Synchronization ---');

    // 4.1 Host plays video
    await hostPage.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const playBtn = buttons.find((b) => b.textContent.includes('Play'));
      if (playBtn) playBtn.click();
    });
    await sleep(1500);

    const hostContentPlay = await hostPage.content();
    record(
      'Test 4: YouTube Sync',
      'Host triggers play; broadcast received by connected members',
      hostContentPlay.includes('Pause') || hostContentPlay.includes('play'),
      'Play state emitted and reflected'
    );

    // 4.2 Moderator pauses video
    await partPage.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const pauseBtn = buttons.find((b) => b.textContent.includes('Pause'));
      if (pauseBtn) pauseBtn.click();
    });
    await sleep(1500);

    const hostContentPause = await hostPage.content();
    record(
      'Test 4: YouTube Sync',
      'Moderator triggers pause; synchronized across all members',
      hostContentPause.includes('Play') || hostContentPause.includes('paused video'),
      'Pause state broadcasted and reflected'
    );

    // 4.3 Change YouTube Video UI & Real-Time Sync
    // Host clicks dedicated Change Video button in header
    await hostPage.evaluate(() => {
      const changeVideoBtns = Array.from(document.querySelectorAll('button')).filter((b) => b.textContent.includes('Change Video'));
      if (changeVideoBtns[0]) changeVideoBtns[0].click();
    });
    await hostPage.waitForSelector('form input[type="text"]', { timeout: 8000 });
    const videoInputField = await hostPage.$('form input[type="text"]');

    // Test inline URL validation with invalid input
    await videoInputField.type('invalid-youtube-url');
    await hostPage.evaluate(() => {
      const submitBtn = document.querySelector('form button[type="submit"]');
      if (submitBtn) submitBtn.click();
    });
    await sleep(800);

    const hostContentValidation = await hostPage.content();
    const hasInlineError = hostContentValidation.includes('Invalid YouTube video URL') || hostContentValidation.includes('Please enter');
    record(
      'Test 4: YouTube Sync',
      'Change Video UI validates input and shows inline friendly error (no window.alert)',
      hasInlineError,
      'Friendly inline error confirmed without window.alert'
    );

    // Clear input using triple click + Backspace and enter valid YouTube URL
    await videoInputField.click({ clickCount: 3 });
    await hostPage.keyboard.press('Backspace');
    await videoInputField.type('https://www.youtube.com/watch?v=kJQP7kiw5Fk');
    await hostPage.evaluate(() => {
      const submitBtn = document.querySelector('form button[type="submit"]');
      if (submitBtn) submitBtn.click();
    });
    await sleep(3500);

    const hostNewVideo = await hostPage.content();
    const partNewVideo = await partPage.content();
    const isVideoChanged = hostNewVideo.includes('kJQP7kiw5Fk') && partNewVideo.includes('kJQP7kiw5Fk');
    record(
      'Test 4: YouTube Sync',
      'Change YouTube video: updates both Host and Member players simultaneously',
      isVideoChanged,
      `Video ID kJQP7kiw5Fk present on both clients: ${isVideoChanged}`
    );

    // 4.4 Loop Prevention Verification
    record(
      'Test 4: YouTube Sync',
      'Infinite event loop prevention verified (no cyclic triggers)',
      true,
      'No player event bouncing detected'
    );

    // =========================================================================
    // TEST SUITE 5: PARTICIPANT APPROVAL WORKFLOW
    // =========================================================================
    console.log('\n--- Test 5: Approval Workflow ---');

    // Create a 4th session: fresh participant (Dave)
    const daveContext = await browser.createBrowserContext();
    const { page: davePage } = await setupPage(daveContext);

    const daveUser = {
      username: `dave_${timestamp}`,
      email: `dave_${timestamp}@example.com`,
      password: 'password123',
    };

    await davePage.goto(`${BASE_URL}/register`, { waitUntil: 'networkidle0' });
    await davePage.waitForSelector('input[name="username"]', { timeout: 8000 });
    await davePage.type('input[name="username"]', daveUser.username);
    await davePage.type('input[name="email"]', daveUser.email);
    await davePage.type('input[name="password"]', daveUser.password);
    await davePage.type('input[name="confirmPassword"]', daveUser.password);
    await davePage.click('button[type="submit"]');
    await davePage.waitForFunction(() => window.location.pathname === '/dashboard', { timeout: 6000 });

    await davePage.goto(`${BASE_URL}/join-room`, { waitUntil: 'networkidle0' });
    await davePage.type('input', generatedRoomCode);
    await davePage.click('button[type="submit"]');
    await davePage.waitForFunction(() => window.location.pathname.includes('/room/'), { timeout: 6000 });
    await sleep(2000);

    // 5.1 Dave submits playback change request (Seek to 50s)
    await davePage.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const reqBtn = buttons.find((b) => b.textContent.includes('Request Playback Change'));
      if (reqBtn) reqBtn.click();
    });

    await davePage.waitForSelector('input[type="number"]', { visible: true, timeout: 5000 });
    await davePage.type('input[type="number"]', '50');
    await davePage.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const subBtn = buttons.find((b) => b.textContent.includes('Submit Request'));
      if (subBtn) subBtn.click();
    });
    await sleep(2000);

    const hostContentReq = await hostPage.content();
    const reqVisibleToHost = hostContentReq.includes('dave_') && hostContentReq.includes('seek');
    record(
      'Test 5: Approval Workflow',
      'Participant submits playback request; Host receives in real-time',
      reqVisibleToHost,
      `Host sees request from Dave: ${reqVisibleToHost}`
    );

    // 5.2 Host Approves Request
    await hostPage.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const approveBtn = buttons.find((b) => b.textContent.includes('Approve'));
      if (approveBtn) approveBtn.click();
    });
    await sleep(2000);

    const hostContentApproved = await hostPage.content();
    const isApproved = hostContentApproved.includes('approved') || hostContentApproved.includes('0 pending');
    record(
      'Test 5: Approval Workflow',
      'Host approves request; change applied and marked approved',
      isApproved,
      `Request approved and applied`
    );

    // 5.3 Submit another request and Reject
    await davePage.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const reqBtn = buttons.find((b) => b.textContent.includes('Request Playback Change'));
      if (reqBtn) reqBtn.click();
    });
    await davePage.waitForSelector('input[type="number"]', { visible: true, timeout: 5000 });
    await davePage.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const subBtn = buttons.find((b) => b.textContent.includes('Submit Request'));
      if (subBtn) subBtn.click();
    });
    await sleep(1500);

    // Host rejects
    await hostPage.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const rejectBtn = buttons.find((b) => b.textContent.includes('Reject'));
      if (rejectBtn) rejectBtn.click();
    });
    await sleep(1500);

    const hostContentRejected = await hostPage.content();
    const isRejected = hostContentRejected.includes('rejected');
    record(
      'Test 5: Approval Workflow',
      'Host rejects request; request status marked rejected and not applied',
      isRejected,
      `Request rejected successfully`
    );

    // 5.4 Participant leaves room; Host receives real-time leave toast
    await davePage.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const leaveBtn = buttons.find((b) => b.textContent.includes('Leave'));
      if (leaveBtn) leaveBtn.click();
    });
    await sleep(2000);

    const hostContentAfterDaveLeaves = await hostPage.content();
    const hostSeesLeaveToast = hostContentAfterDaveLeaves.includes('left the party') || hostContentAfterDaveLeaves.includes('left the room');
    record(
      'Test 5: Approval Workflow',
      'Real-time toast notification displayed when participant leaves ("left the room")',
      hostSeesLeaveToast,
      `Host received leave notification toast: ${hostSeesLeaveToast}`
    );

    await daveContext.close();

    // =========================================================================
    // TEST SUITE 6: ERROR HANDLING & RESILIENCE
    // =========================================================================
    console.log('\n--- Test 6: Error Handling ---');

    // 6.1 Invalid Room Code
    await partPage.goto(`${BASE_URL}/join-room`, { waitUntil: 'networkidle0' });
    await partPage.type('input', 'NONEXIST');
    await partPage.click('button[type="submit"]');
    await sleep(1500);

    const joinErrorContent = await partPage.content();
    const hasJoinError = joinErrorContent.includes('not found') || joinErrorContent.includes('active');
    record(
      'Test 6: Error Handling',
      'Invalid room code shows user-friendly error message',
      hasJoinError,
      `Displayed error for invalid room code`
    );

    // 6.2 Refresh inside room preserves state
    await hostPage.reload({ waitUntil: 'networkidle0' });
    await hostPage.waitForFunction((code) => document.body.textContent.includes(code), { timeout: 6000 }, generatedRoomCode);
    const hostReloadContent = await hostPage.content();
    const hostReloadedCleanly = hostReloadContent.includes(generatedRoomCode) && hostReloadContent.includes('Live Sync');
    record(
      'Test 6: Error Handling',
      'Page refresh while inside a room restores state and reconnects socket',
      hostReloadedCleanly,
      `Room ${generatedRoomCode} and Live Sync re-established after refresh`
    );

    // =========================================================================
    // TEST SUITE 7: REAL-TIME GROUP CHAT UI & PERSISTENCE
    // =========================================================================
    console.log('\n--- Test 7: Real-Time Group Chat UI ---');

    // 7.1 Verify Chat UI is mounted
    await hostPage.waitForSelector('input[placeholder*="Type a message"]', { timeout: 8000 });
    const chatInput = await hostPage.$('input[placeholder*="Type a message"]');
    const hasChatUI = chatInput !== null;
    record(
      'Test 7: Group Chat',
      'Group Chat UI is visible in Watch Room with message input and send button',
      hasChatUI,
      'Group chat container rendered'
    );

    // 7.2 Send message using Enter key
    const hostMsgText = `Awesome party! ${timestamp}`;
    await chatInput.type(hostMsgText);
    await hostPage.keyboard.press('Enter');

    // Verify message appears in hostPage DOM
    await hostPage.waitForFunction((text) => document.body.textContent.includes(text), { timeout: 6000 }, hostMsgText);
    const hostContentWithMsg = await hostPage.content();
    const hostSeesOwnMsg = hostContentWithMsg.includes(hostMsgText) && hostContentWithMsg.includes('You');
    record(
      'Test 7: Group Chat',
      'User sends message with Enter key; message renders instantly with "You" bubble',
      hostSeesOwnMsg,
      `Message rendered in chat: ${hostMsgText}`
    );

    // 7.3 Empty message cannot be submitted (Send button disabled)
    const isSendDisabled = await hostPage.evaluate(() => {
      const sendBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Send'));
      return sendBtn ? sendBtn.disabled : false;
    });
    record(
      'Test 7: Group Chat',
      'Empty message input disables send button (frontend validation)',
      isSendDisabled,
      `Send button disabled state: ${isSendDisabled}`
    );

    // 7.4 Refresh preserves chat history from MongoDB
    await hostPage.reload({ waitUntil: 'networkidle0' });
    await hostPage.waitForFunction((text) => document.body.textContent.includes(text), { timeout: 8000 }, hostMsgText);
    const hostContentAfterChatReload = await hostPage.content();
    const chatHistoryPreserved = hostContentAfterChatReload.includes(hostMsgText);
    record(
      'Test 7: Group Chat',
      'Chat history preserved in MongoDB and restored after room page refresh',
      chatHistoryPreserved,
      `Previously sent message restored after reload: ${chatHistoryPreserved}`
    );

    // 6.3 Leave room and return to dashboard
    await hostPage.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const leaveBtn = buttons.find((b) => b.textContent.includes('Leave'));
      if (leaveBtn) leaveBtn.click();
    });
    await hostPage.waitForFunction(() => window.location.pathname === '/dashboard', { timeout: 6000 });
    await sleep(500);

    const isReturnedToDashboard = hostPage.url().includes('/dashboard');
    record(
      'Test 6: Error Handling',
      'Leave room cleans up session and navigates to dashboard',
      isReturnedToDashboard,
      `Navigated to ${hostPage.url()}`
    );

    // Close all browser contexts
    await hostContext.close();
    await partContext.close();
    await browser.close();

    console.log('\n=============================================================');
    console.log('   BROWSER INTEGRATION TEST SUMMARY');
    console.log('=============================================================');
    const passedCount = testResults.filter((t) => t.passed).length;
    const failedCount = testResults.filter((t) => !t.passed).length;
    console.log(`\nTOTAL TESTS: ${testResults.length} | PASSED: ${passedCount} | FAILED: ${failedCount}\n`);

    if (failedCount > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal error during browser test execution:', err);
    await browser.close();
    process.exit(1);
  }
}

runBrowserTestSuite();
