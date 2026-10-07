const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');

const PORT = process.env.PORT || 8000;
const JWT_SECRET = 'maze_runner_secret_key_2026';

// Defined 10 Campaign Levels
const CAMPAIGN_LEVELS = [
  { id: 1, name: 'Novice Escape', grid: 15, algo: 'bfs', speed: 'easy', fog: false, desc: 'Learn the controls. The enemy moves slowly.' },
  { id: 2, name: 'Speed Pursuit', grid: 15, algo: 'astar', speed: 'medium', fog: false, desc: 'The enemy uses A* to stalk your path.' },
  { id: 3, name: 'Foggy Corridor', grid: 21, algo: 'bfs', speed: 'medium', fog: true, desc: 'Limited spotlight vision. Watch out for blind spots!' },
  { id: 4, name: 'Dual Heuristic', grid: 21, algo: 'astar', speed: 'hard', fog: false, desc: 'Increased maze size and faster AI chaser.' },
  { id: 5, name: 'Maze Master', grid: 25, algo: 'astar', speed: 'hard', fog: false, desc: 'Larger 25x25 grid requiring strategic power-up usage.' },
  { id: 6, name: 'Dark Labyrinth', grid: 25, algo: 'bfs', speed: 'hard', fog: true, desc: 'Large fog-covered maze. Rely on your instincts!' },
  { id: 7, name: 'Relentless Pursuit', grid: 25, algo: 'astar', speed: 'nightmare', fog: false, desc: 'Relentless nightmare AI speed. Move fast!' },
  { id: 8, name: 'Shadows of the AI', grid: 31, algo: 'astar', speed: 'hard', fog: true, desc: '31x31 large dark grid with fast A* pathfinding.' },
  { id: 9, name: 'Cyber Fortress', grid: 31, algo: 'astar', speed: 'nightmare', fog: false, desc: 'Massive grid with maximum AI speed.' },
  { id: 10, name: 'The Ultimate Escape', grid: 35, algo: 'astar', speed: 'nightmare', fog: true, desc: '35x35 colossal maze with Fog of War & Nightmare AI.' }
];

// Simple JWT generation & verification
function generateToken(user) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: user.id,
    username: user.username,
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
  })).toString('base64url');

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

function verifyToken(token) {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;

    const expectedSig = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');

    if (signature !== expectedSig) return null;

    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (decoded.exp < Math.floor(Date.now() / 1000)) return null;

    return decoded;
  } catch (err) {
    return null;
  }
}

// Request Helper
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
  });
}

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  });
  res.end(JSON.stringify(data));
}

// MIME Types map for static files
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    });
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // Extract Auth Token
  const authHeader = req.headers['authorization'];
  let userToken = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    userToken = verifyToken(authHeader.substring(7));
  }

  // --- API ROUTES ---
  if (pathname === '/api/auth/register' && req.method === 'POST') {
    const body = await parseBody(req);
    const { username, email, password } = body;

    if (!username || !email || !password) {
      return sendJSON(res, 400, { error: 'Username, email, and password are required.' });
    }
    if (username.length < 3 || password.length < 4) {
      return sendJSON(res, 400, { error: 'Username must be at least 3 chars, password at least 4 chars.' });
    }

    try {
      const newUser = db.createUser(username, email, password);
      const token = generateToken(newUser);
      return sendJSON(res, 201, { user: newUser, token });
    } catch (err) {
      return sendJSON(res, 400, { error: err.message });
    }
  }

  if (pathname === '/api/auth/login' && req.method === 'POST') {
    const body = await parseBody(req);
    const { usernameOrEmail, password } = body;

    if (!usernameOrEmail || !password) {
      return sendJSON(res, 400, { error: 'Username/Email and password are required.' });
    }

    const user = db.verifyUser(usernameOrEmail, password);
    if (!user) {
      return sendJSON(res, 401, { error: 'Invalid credentials.' });
    }

    const token = generateToken(user);
    return sendJSON(res, 200, { user, token });
  }

  if (pathname === '/api/auth/me' && req.method === 'GET') {
    if (!userToken) return sendJSON(res, 401, { error: 'Unauthorized.' });
    const user = db.getUserById(userToken.sub);
    if (!user) return sendJSON(res, 404, { error: 'User not found.' });

    const progress = db.getUserProgress(user.id);
    return sendJSON(res, 200, { user, progress });
  }

  if (pathname === '/api/levels' && req.method === 'GET') {
    let progress = {};
    if (userToken) {
      progress = db.getUserProgress(userToken.sub);
    }

    // Determine unlocked levels
    const levelsWithStatus = CAMPAIGN_LEVELS.map((lvl, index) => {
      const isCompleted = !!(progress[lvl.id] && progress[lvl.id].completed);
      // Level 1 is always unlocked. Level N is unlocked if Level N-1 is completed.
      const isUnlocked = index === 0 || !!(progress[CAMPAIGN_LEVELS[index - 1].id] && progress[CAMPAIGN_LEVELS[index - 1].id].completed);
      const userLevelData = progress[lvl.id] || {};

      return {
        ...lvl,
        completed: isCompleted,
        unlocked: isUnlocked,
        bestTimeSec: userLevelData.bestTimeSec || null,
        stars: userLevelData.stars || 0
      };
    });

    return sendJSON(res, 200, { levels: levelsWithStatus });
  }

  if (pathname === '/api/levels/complete' && req.method === 'POST') {
    if (!userToken) return sendJSON(res, 401, { error: 'Unauthorized. Please login to save level progress.' });

    const body = await parseBody(req);
    const { levelId, timeSec } = body;

    if (!levelId || timeSec === undefined) {
      return sendJSON(res, 400, { error: 'levelId and timeSec are required.' });
    }

    const updatedProgress = db.saveLevelCompletion(userToken.sub, parseInt(levelId, 10), parseInt(timeSec, 10));
    return sendJSON(res, 200, { success: true, progress: updatedProgress });
  }

  if (pathname === '/api/leaderboard' && req.method === 'GET') {
    const leaderboard = db.getLeaderboard();
    return sendJSON(res, 200, { leaderboard });
  }

  // --- STATIC FILE SERVING ---
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
  const ext = path.extname(filePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Maze Runner Server running at http://localhost:${PORT}`);
});
