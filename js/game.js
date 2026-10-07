/**
 * Maze Runner Game Engine (Canvas-Scoped Pause & Scroll Fix)
 */
class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    // Settings & State
    this.rows = 15;
    this.cols = 15;
    this.cellSize = 30;

    this.algorithm = 'bfs';
    this.aiSpeedMode = 'easy';
    this.showPath = true;
    this.fogOfWar = false;

    this.isPlaying = false;
    this.isPaused = false;
    this.currentLevel = null;

    this.startTime = 0;
    this.elapsedTime = 0;
    this.timerInterval = null;

    // Entities
    this.maze = null;
    this.player = { r: 0, c: 0, x: 0, y: 0, speedBoostTimer: 0, autoPath: [] };
    this.enemy = { r: 0, c: 0, x: 0, y: 0, path: [], moveTimer: 0, freezeTimer: 0, visitedNodes: [] };
    this.goal = { r: 0, c: 0 };

    // Active Buffs, Floating Popups & Effects
    this.activeBuff = 'None';
    this.hintTimer = 0;
    this.hintPath = [];
    this.particles = [];
    this.popups = [];

    // Keys
    this.keys = {};
    this.lastMoveTime = 0;

    // Speed configurations (in ms per step)
    this.speedIntervals = {
      easy: 420,
      medium: 260,
      hard: 180,
      nightmare: 120
    };

    // 1. Initialize UI elements
    this.initUI();
    // 2. Initialize maze synchronously FIRST
    this.initMaze();
    // 3. Set up input & event listeners
    this.setupEventListeners();
    // 4. Async loading (User Auth & Campaign Levels)
    this.checkUserAuth();
    this.loadCampaignLevelById(1);
    // 5. Start main animation loop
    this.startLoop();
  }

  initUI() {
    this.ui = {
      timer: document.getElementById('hudTimer'),
      goalDist: document.getElementById('hudGoalDist'),
      enemyDist: document.getElementById('hudEnemyDist'),
      buff: document.getElementById('hudBuff'),
      currentModeBadge: document.getElementById('currentModeBadge'),
      btnPauseGame: document.getElementById('btnPauseGame'),

      algoSelect: document.getElementById('algoSelect'),
      speedSelect: document.getElementById('speedSelect'),
      sizeSelect: document.getElementById('sizeSelect'),
      btnNewMaze: document.getElementById('btnNewMaze'),
      chkShowPath: document.getElementById('chkShowPath'),
      chkFogOfWar: document.getElementById('chkFogOfWar'),
      chkAudio: document.getElementById('chkAudio'),

      statNodes: document.getElementById('statNodesExplored'),
      statTime: document.getElementById('statComputeTime'),
      statLength: document.getElementById('statPathLength'),

      // Modals
      pauseModal: document.getElementById('pauseModal'),
      pauseUserStatus: document.getElementById('pauseUserStatus'),
      btnPauseAuth: document.getElementById('btnPauseAuth'),
      btnResume: document.getElementById('btnResume'),
      btnRestartLevel: document.getElementById('btnRestartLevel'),

      winModal: document.getElementById('winModal'),
      btnWinRestart: document.getElementById('btnWinRestart'),
      btnNextLevel: document.getElementById('btnNextLevel'),
      winTime: document.getElementById('winTime'),
      winAlgo: document.getElementById('winAlgo'),
      winSize: document.getElementById('winSize'),

      loseModal: document.getElementById('loseModal'),
      btnLoseRestart: document.getElementById('btnLoseRestart'),
      loseTime: document.getElementById('loseTime'),
      loseDist: document.getElementById('loseDist'),

      // Auth
      btnOpenAuth: document.getElementById('btnOpenAuth'),
      btnCloseAuth: document.getElementById('btnCloseAuth'),
      userWidget: document.getElementById('userWidget'),
      userProfileBadge: document.getElementById('userProfileBadge'),
      usernameDisplay: document.getElementById('usernameDisplay'),
      btnLogout: document.getElementById('btnLogout'),
      authModal: document.getElementById('authModal'),
      tabLogin: document.getElementById('tabLogin'),
      tabRegister: document.getElementById('tabRegister'),
      loginForm: document.getElementById('loginForm'),
      registerForm: document.getElementById('registerForm'),
      loginError: document.getElementById('loginError'),
      regError: document.getElementById('regError'),

      // Levels & Leaderboard
      btnOpenLevels: document.getElementById('btnOpenLevels'),
      btnCloseLevels: document.getElementById('btnCloseLevels'),
      levelsModal: document.getElementById('levelsModal'),
      levelsGrid: document.getElementById('levelsGrid'),

      btnOpenLeaderboard: document.getElementById('btnOpenLeaderboard'),
      btnCloseLeaderboard: document.getElementById('btnCloseLeaderboard'),
      leaderboardModal: document.getElementById('leaderboardModal'),
      leaderboardBody: document.getElementById('leaderboardBody')
    };
  }

  async checkUserAuth() {
    const profile = await api.getProfile();
    this.updateUserUI(profile ? profile.user : null);
  }

  updateUserUI(user) {
    if (user) {
      this.ui.btnOpenAuth.classList.add('hidden');
      this.ui.userProfileBadge.classList.remove('hidden');
      this.ui.usernameDisplay.textContent = user.username;
      if (this.ui.pauseUserStatus) this.ui.pauseUserStatus.innerHTML = `Logged in as <strong>${user.username}</strong>`;
      if (this.ui.btnPauseAuth) this.ui.btnPauseAuth.classList.add('hidden');
    } else {
      this.ui.btnOpenAuth.classList.remove('hidden');
      this.ui.userProfileBadge.classList.add('hidden');
      if (this.ui.pauseUserStatus) this.ui.pauseUserStatus.innerHTML = `Playing as <strong>Guest</strong>`;
      if (this.ui.btnPauseAuth) this.ui.btnPauseAuth.classList.remove('hidden');
    }
  }

  async loadCampaignLevelById(levelId) {
    try {
      const res = await api.getLevels();
      const levelObj = res.levels.find(l => l.id === levelId);
      if (levelObj) {
        this.startLevel(levelObj);
      }
    } catch (e) {
      // Fallback offline level
      this.startLevel({ id: levelId, name: `Level ${levelId}`, grid: 15, algo: 'bfs', speed: 'easy', fog: false });
    }
  }

  startLevel(levelObj) {
    this.currentLevel = levelObj;

    this.rows = levelObj.grid;
    this.cols = levelObj.grid;
    this.algorithm = levelObj.algo;
    this.aiSpeedMode = levelObj.speed;
    this.fogOfWar = levelObj.fog;

    // Sync UI controls
    this.ui.sizeSelect.value = levelObj.grid;
    this.ui.algoSelect.value = levelObj.algo;
    this.ui.speedSelect.value = levelObj.speed;
    this.ui.chkFogOfWar.checked = levelObj.fog;
    this.ui.currentModeBadge.textContent = `Campaign ${levelObj.name} (${levelObj.grid}x${levelObj.grid})`;

    this.initMaze();
  }

  initMaze() {
    const maxCanvasDim = Math.min(window.innerWidth - 400, window.innerHeight - 200, 700);
    const canvasSize = Math.max(350, Math.min(700, maxCanvasDim || 650));
    this.canvas.width = canvasSize;
    this.canvas.height = canvasSize;
    this.cellSize = canvasSize / this.cols;

    this.maze = new Maze(this.rows, this.cols);
    this.maze.generate();

    this.player.r = 0;
    this.player.c = 0;
    this.player.x = (0 + 0.5) * this.cellSize;
    this.player.y = (0 + 0.5) * this.cellSize;
    this.player.speedBoostTimer = 0;
    this.player.autoPath = [];

    this.goal.r = this.rows - 1;
    this.goal.c = this.cols - 1;

    this.enemy.r = this.rows - 1;
    this.enemy.c = 0;
    this.enemy.x = (this.enemy.c + 0.5) * this.cellSize;
    this.enemy.y = (this.enemy.r + 0.5) * this.cellSize;
    this.enemy.moveTimer = 0;
    this.enemy.freezeTimer = 0;

    this.activeBuff = 'None';
    this.hintTimer = 0;
    this.particles = [];
    this.popups = [];

    this.updateAIPath();

    this.elapsedTime = 0;
    this.isPlaying = true;
    this.isPaused = false;
    this.startTime = Date.now();

    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (this.isPlaying && !this.isPaused) {
        this.elapsedTime = Math.floor((Date.now() - this.startTime) / 1000);
        const mins = String(Math.floor(this.elapsedTime / 60)).padStart(2, '0');
        const secs = String(this.elapsedTime % 60).padStart(2, '0');
        this.ui.timer.textContent = `${mins}:${secs}`;
      }
    }, 1000);

    // Hide modals
    this.ui.winModal.classList.add('hidden');
    this.ui.loseModal.classList.add('hidden');
    this.ui.pauseModal.classList.add('hidden');
  }

  togglePause() {
    if (!this.isPlaying) return;

    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      this.ui.pauseModal.classList.remove('hidden');
    } else {
      this.startTime = Date.now() - (this.elapsedTime * 1000);
      this.ui.pauseModal.classList.add('hidden');
    }
  }

  openModalWithAutoPause(modalElement) {
    if (this.isPlaying && !this.isPaused) {
      this.togglePause();
    }
    modalElement.classList.remove('hidden');
  }

  setupEventListeners() {
    // Keyboard listeners with scroll prevention
    window.addEventListener('keydown', (e) => {
      // Prevent browser scrolling on Arrow keys and Spacebar
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }

      sounds.init();
      if (e.code === 'KeyP' || e.code === 'Escape') {
        this.togglePause();
        return;
      }
      this.keys[e.code] = true;
      this.player.autoPath = [];
      this.handlePlayerInput();
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // Touch D-Pad
    const touchButtons = document.querySelectorAll('.dbtn');
    touchButtons.forEach(btn => {
      const dir = btn.getAttribute('data-dir');
      btn.addEventListener('click', () => {
        sounds.init();
        this.player.autoPath = [];
        this.movePlayerDirection(dir);
      });
    });

    // Interactive Click / Tap on Canvas to Auto-Walk
    this.canvas.addEventListener('click', (e) => {
      if (!this.isPlaying || this.isPaused || !this.maze) return;
      sounds.init();

      const rect = this.canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      const targetC = Math.floor(clickX / this.cellSize);
      const targetR = Math.floor(clickY / this.cellSize);

      if (targetR >= 0 && targetR < this.rows && targetC >= 0 && targetC < this.cols) {
        const pathResult = Pathfinder.findPath(
          this.maze,
          { r: this.player.r, c: this.player.c },
          { r: targetR, c: targetC },
          'astar'
        );

        if (pathResult.path && pathResult.path.length > 1) {
          this.player.autoPath = pathResult.path.slice(1);
          this.addPopup(clickX, clickY, '🎯', '#00f3ff');
        }
      }
    });

    // Pause Controls
    this.ui.btnPauseGame.addEventListener('click', () => this.togglePause());
    this.ui.btnResume.addEventListener('click', () => this.togglePause());
    this.ui.btnRestartLevel.addEventListener('click', () => this.initMaze());

    if (this.ui.btnPauseAuth) {
      this.ui.btnPauseAuth.addEventListener('click', () => {
        this.ui.authModal.classList.remove('hidden');
      });
    }

    // Sidebar selects
    this.ui.algoSelect.addEventListener('change', () => {
      this.algorithm = this.ui.algoSelect.value;
      this.updateAIPath();
      this.addPopup(this.canvas.width / 2, 40, `AI Mode: ${this.algorithm.toUpperCase()}`, '#ff0055');
    });

    this.ui.speedSelect.addEventListener('change', () => {
      this.aiSpeedMode = this.ui.speedSelect.value;
      this.addPopup(this.canvas.width / 2, 40, `AI Speed: ${this.aiSpeedMode.toUpperCase()}`, '#ff0055');
    });

    this.ui.sizeSelect.addEventListener('change', () => {
      this.rows = parseInt(this.ui.sizeSelect.value, 10);
      this.cols = this.rows;
      this.currentLevel = null;
      this.ui.currentModeBadge.textContent = `Free Play (${this.rows}x${this.cols})`;
      this.initMaze();
    });

    this.ui.btnNewMaze.addEventListener('click', () => {
      this.initMaze();
    });

    this.ui.chkShowPath.addEventListener('change', (e) => this.showPath = e.target.checked);
    this.ui.chkFogOfWar.addEventListener('change', (e) => this.fogOfWar = e.target.checked);
    this.ui.chkAudio.addEventListener('change', (e) => sounds.enabled = e.target.checked);

    // Modals Restart & Next Level
    this.ui.btnWinRestart.addEventListener('click', () => this.initMaze());
    this.ui.btnNextLevel.addEventListener('click', () => {
      if (this.currentLevel && this.currentLevel.id < 10) {
        this.loadCampaignLevelById(this.currentLevel.id + 1);
      } else {
        this.initMaze();
      }
    });

    this.ui.btnLoseRestart.addEventListener('click', () => this.initMaze());

    // Auth Listeners (Auto-pause game when opening Auth modal)
    this.ui.btnOpenAuth.addEventListener('click', () => this.openModalWithAutoPause(this.ui.authModal));
    this.ui.btnCloseAuth.addEventListener('click', () => this.ui.authModal.classList.add('hidden'));

    this.ui.tabLogin.addEventListener('click', () => {
      this.ui.tabLogin.classList.add('active');
      this.ui.tabRegister.classList.remove('active');
      this.ui.loginForm.classList.remove('hidden');
      this.ui.registerForm.classList.add('hidden');
    });

    this.ui.tabRegister.addEventListener('click', () => {
      this.ui.tabRegister.classList.add('active');
      this.ui.tabLogin.classList.remove('active');
      this.ui.registerForm.classList.remove('hidden');
      this.ui.loginForm.classList.add('hidden');
    });

    this.ui.loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      this.ui.loginError.classList.add('hidden');
      try {
        const user = document.getElementById('loginUser').value;
        const pass = document.getElementById('loginPass').value;
        const res = await api.login(user, pass);
        this.updateUserUI(res.user);
        this.ui.authModal.classList.add('hidden');
        this.addPopup(this.canvas.width / 2, 60, `Welcome ${res.user.username}!`, '#00ff66');
      } catch (err) {
        this.ui.loginError.textContent = err.message;
        this.ui.loginError.classList.remove('hidden');
      }
    });

    this.ui.registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      this.ui.regError.classList.add('hidden');
      try {
        const user = document.getElementById('regUser').value;
        const email = document.getElementById('regEmail').value;
        const pass = document.getElementById('regPass').value;
        const res = await api.register(user, email, pass);
        this.updateUserUI(res.user);
        this.ui.authModal.classList.add('hidden');
        this.addPopup(this.canvas.width / 2, 60, `Account Created! Welcome ${res.user.username}`, '#00ff66');
      } catch (err) {
        this.ui.regError.textContent = err.message;
        this.ui.regError.classList.remove('hidden');
      }
    });

    this.ui.btnLogout.addEventListener('click', () => {
      api.logout();
      this.updateUserUI(null);
    });

    // Level Selector Modal Listeners
    this.ui.btnOpenLevels.addEventListener('click', () => {
      this.openModalWithAutoPause(this.ui.levelsModal);
      this.renderLevelsModal();
    });
    this.ui.btnCloseLevels.addEventListener('click', () => this.ui.levelsModal.classList.add('hidden'));

    // Leaderboard Listeners
    this.ui.btnOpenLeaderboard.addEventListener('click', () => {
      this.openModalWithAutoPause(this.ui.leaderboardModal);
      this.renderLeaderboardModal();
    });
    this.ui.btnCloseLeaderboard.addEventListener('click', () => this.ui.leaderboardModal.classList.add('hidden'));
  }

  async renderLevelsModal() {
    this.ui.levelsGrid.innerHTML = '<div style="color:#8a99ad;">Loading levels...</div>';

    try {
      const res = await api.getLevels();
      this.ui.levelsGrid.innerHTML = '';

      res.levels.forEach(lvl => {
        const item = document.createElement('div');
        item.className = `level-card-item ${lvl.unlocked ? 'unlocked' : 'locked'}`;
        
        let statusIcon = lvl.completed ? '⭐' : (lvl.unlocked ? '🔓' : '🔒');
        let bestText = lvl.bestTimeSec ? `${lvl.bestTimeSec}s` : '--';

        item.innerHTML = `
          <div class="lvl-num">Level ${lvl.id}</div>
          <div class="lvl-name">${lvl.name}</div>
          <div class="lvl-status">${statusIcon}</div>
          <div class="lvl-best">${bestText}</div>
        `;

        if (lvl.unlocked) {
          item.addEventListener('click', () => {
            this.startLevel(lvl);
            this.ui.levelsModal.classList.add('hidden');
          });
        }

        this.ui.levelsGrid.appendChild(item);
      });
    } catch (e) {
      this.ui.levelsGrid.innerHTML = '<div style="color:#ff0055;">Failed to load levels. Server offline.</div>';
    }
  }

  async renderLeaderboardModal() {
    this.ui.leaderboardBody.innerHTML = '<tr><td colspan="4">Loading leaderboard...</td></tr>';

    try {
      const res = await api.getLeaderboard();
      this.ui.leaderboardBody.innerHTML = '';

      if (res.leaderboard.length === 0) {
        this.ui.leaderboardBody.innerHTML = '<tr><td colspan="4">No completions recorded yet. Be the first!</td></tr>';
        return;
      }

      res.leaderboard.forEach((entry, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>#${idx + 1}</td>
          <td><strong>${entry.username}</strong></td>
          <td>${entry.completedCount} / 10</td>
          <td>${entry.totalTime}s</td>
        `;
        this.ui.leaderboardBody.appendChild(tr);
      });
    } catch (e) {
      this.ui.leaderboardBody.innerHTML = '<tr><td colspan="4" style="color:#ff0055;">Failed to load leaderboard.</td></tr>';
    }
  }

  handlePlayerInput() {
    if (!this.isPlaying || this.isPaused || !this.maze) return;

    const now = performance.now();
    const moveDelay = this.player.speedBoostTimer > 0 ? 80 : 130;
    if (now - this.lastMoveTime < moveDelay) return;

    if (this.player.autoPath && this.player.autoPath.length > 0) {
      const nextCell = this.player.autoPath.shift();
      this.player.r = nextCell.r;
      this.player.c = nextCell.c;
      this.lastMoveTime = now;

      sounds.playStep();
      this.addParticles((nextCell.c + 0.5) * this.cellSize, (nextCell.r + 0.5) * this.cellSize, '#00f3ff', 3);
      this.checkPowerUpCollection();
      this.updateAIPath();

      if (this.player.r === this.goal.r && this.player.c === this.goal.c) {
        this.triggerWin();
      }
      return;
    }

    let moved = false;
    if (this.keys['ArrowUp'] || this.keys['KeyW']) moved = this.movePlayerDirection('UP');
    else if (this.keys['ArrowDown'] || this.keys['KeyS']) moved = this.movePlayerDirection('DOWN');
    else if (this.keys['ArrowLeft'] || this.keys['KeyA']) moved = this.movePlayerDirection('LEFT');
    else if (this.keys['ArrowRight'] || this.keys['KeyD']) moved = this.movePlayerDirection('RIGHT');

    if (moved) {
      this.lastMoveTime = now;
      sounds.playStep();
    }
  }

  movePlayerDirection(dir) {
    if (!this.maze || !this.maze.grid) return false;
    const { r, c } = this.player;
    const cell = this.maze.grid[r][c];

    let newR = r;
    let newC = c;

    if (dir === 'UP' && !cell.walls.top && r > 0) newR--;
    else if (dir === 'DOWN' && !cell.walls.bottom && r < this.rows - 1) newR++;
    else if (dir === 'LEFT' && !cell.walls.left && c > 0) newC--;
    else if (dir === 'RIGHT' && !cell.walls.right && c < this.cols - 1) newC++;

    if (newR !== r || newC !== c) {
      this.player.r = newR;
      this.player.c = newC;

      this.addParticles((newC + 0.5) * this.cellSize, (newR + 0.5) * this.cellSize, '#00f3ff', 3);
      this.checkPowerUpCollection();
      this.updateAIPath();

      if (this.player.r === this.goal.r && this.player.c === this.goal.c) {
        this.triggerWin();
      }

      return true;
    }
    return false;
  }

  checkPowerUpCollection() {
    if (!this.maze || !this.maze.powerUps) return;
    const pIndex = this.maze.powerUps.findIndex(p => p.r === this.player.r && p.c === this.player.c);
    if (pIndex !== -1) {
      const powerUp = this.maze.powerUps[pIndex];
      this.maze.powerUps.splice(pIndex, 1);

      const px = (this.player.c + 0.5) * this.cellSize;
      const py = (this.player.r + 0.5) * this.cellSize;

      if (powerUp.type === 'speed') {
        this.player.speedBoostTimer = 6000;
        this.activeBuff = 'Speed ⚡';
        sounds.playPowerUp();
        this.addPopup(px, py - 20, '⚡ SPEED BOOST!', '#ffd700');
      } else if (powerUp.type === 'freeze') {
        this.enemy.freezeTimer = 4500;
        this.activeBuff = 'Freeze ❄️';
        sounds.playFreeze();
        this.addPopup(px, py - 20, '❄️ AI FROZEN!', '#00d2ff');
      } else if (powerUp.type === 'hint') {
        this.hintTimer = 6000;
        this.activeBuff = 'Hint 💡';
        const hintResult = Pathfinder.findPath(this.maze, { r: this.player.r, c: this.player.c }, this.goal, 'astar');
        this.hintPath = hintResult.path;
        sounds.playPowerUp();
        this.addPopup(px, py - 20, '💡 ROUTE HINT!', '#00ff66');
      }

      this.addParticles(px, py, '#ffd700', 14);
    }
  }

  updateAIPath() {
    if (!this.maze) return;
    const start = { r: this.enemy.r, c: this.enemy.c };
    const target = { r: this.player.r, c: this.player.c };

    const result = Pathfinder.findPath(this.maze, start, target, this.algorithm);
    this.enemy.path = result.path;
    this.enemy.visitedNodes = result.visitedNodes;

    if (this.ui.statNodes) this.ui.statNodes.textContent = result.exploredCount;
    if (this.ui.statTime) this.ui.statTime.textContent = `${result.computeTimeMs} ms`;
    if (this.ui.statLength) this.ui.statLength.textContent = `${result.path.length} steps`;
  }

  updateEnemy(deltaMs) {
    if (!this.isPlaying || this.isPaused || !this.maze) return;

    const dx = this.player.x - this.enemy.x;
    const dy = this.player.y - this.enemy.y;
    const dist = Math.hypot(dx, dy);

    if (dist < this.cellSize * 0.45 && this.enemy.freezeTimer <= 0) {
      this.triggerLose();
      return;
    }

    if (this.enemy.freezeTimer > 0) {
      this.enemy.freezeTimer -= deltaMs;
      if (this.enemy.freezeTimer <= 0) {
        this.enemy.freezeTimer = 0;
        if (this.activeBuff.includes('Freeze')) this.activeBuff = 'None';
      }
      return;
    }

    if (this.player.speedBoostTimer > 0) {
      this.player.speedBoostTimer -= deltaMs;
      if (this.player.speedBoostTimer <= 0) {
        this.player.speedBoostTimer = 0;
        if (this.activeBuff.includes('Speed')) this.activeBuff = 'None';
      }
    }

    if (this.hintTimer > 0) {
      this.hintTimer -= deltaMs;
      if (this.hintTimer <= 0) {
        this.hintTimer = 0;
        if (this.activeBuff.includes('Hint')) this.activeBuff = 'None';
      }
    }

    this.enemy.moveTimer += deltaMs;
    const interval = this.speedIntervals[this.aiSpeedMode] || 260;

    if (this.enemy.moveTimer >= interval) {
      this.enemy.moveTimer = 0;

      if (this.enemy.path && this.enemy.path.length > 1) {
        const nextStep = this.enemy.path[1];
        this.enemy.r = nextStep.r;
        this.enemy.c = nextStep.c;

        this.updateAIPath();

        if (this.enemy.r === this.player.r && this.enemy.c === this.player.c) {
          this.triggerLose();
        }
      }
    }
  }

  async triggerWin() {
    this.isPlaying = false;
    clearInterval(this.timerInterval);
    sounds.playWin();

    this.ui.winTime.textContent = this.ui.timer.textContent;
    this.ui.winAlgo.textContent = this.algorithm.toUpperCase();
    this.ui.winSize.textContent = `${this.rows}x${this.cols}`;

    if (this.currentLevel) {
      try {
        await api.completeLevel(this.currentLevel.id, this.elapsedTime);
      } catch (err) {
        console.log('Progress save info:', err.message);
      }
    }

    for (let i = 0; i < 40; i++) {
      this.addParticles(
        Math.random() * this.canvas.width,
        Math.random() * this.canvas.height,
        ['#00ff66', '#00f3ff', '#ffd700'][i % 3],
        1
      );
    }

    this.ui.winModal.classList.remove('hidden');
  }

  triggerLose() {
    this.isPlaying = false;
    clearInterval(this.timerInterval);
    sounds.playLose();

    const distToExit = Math.abs(this.player.r - this.goal.r) + Math.abs(this.player.c - this.goal.c);
    this.ui.loseTime.textContent = this.ui.timer.textContent;
    this.ui.loseDist.textContent = `${distToExit} steps`;

    this.addParticles(this.player.x, this.player.y, '#ff0055', 25);

    this.ui.loseModal.classList.remove('hidden');
  }

  addParticles(x, y, color, count = 5) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 3,
        vy: (Math.random() - 0.5) * 3,
        size: Math.random() * 4 + 2,
        color,
        life: 1.0
      });
    }
  }

  updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.04;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  addPopup(x, y, text, color = '#ffffff') {
    this.popups.push({ x, y, text, color, life: 1.0 });
  }

  updatePopups() {
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.y -= 0.8;
      p.life -= 0.025;
      if (p.life <= 0) this.popups.splice(i, 1);
    }
  }

  updateHUD() {
    if (!this.maze) return;
    const goalDist = Math.abs(this.player.r - this.goal.r) + Math.abs(this.player.c - this.goal.c);
    const enemyDist = Math.abs(this.player.r - this.enemy.r) + Math.abs(this.player.c - this.enemy.c);

    this.ui.goalDist.textContent = `${goalDist}m`;
    this.ui.enemyDist.textContent = `${enemyDist}m`;
    this.ui.buff.textContent = this.activeBuff;
  }

  render() {
    if (!this.maze || !this.maze.grid) return;

    const { ctx, canvas, cellSize, rows, cols } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    this.player.x += ((this.player.c + 0.5) * cellSize - this.player.x) * 0.35;
    this.player.y += ((this.player.r + 0.5) * cellSize - this.player.y) * 0.35;

    this.enemy.x += ((this.enemy.c + 0.5) * cellSize - this.enemy.x) * 0.25;
    this.enemy.y += ((this.enemy.r + 0.5) * cellSize - this.enemy.y) * 0.25;

    if (this.showPath && this.enemy.visitedNodes) {
      ctx.fillStyle = 'rgba(157, 78, 221, 0.15)';
      for (const node of this.enemy.visitedNodes) {
        ctx.fillRect(node.c * cellSize + 2, node.r * cellSize + 2, cellSize - 4, cellSize - 4);
      }
    }

    if (this.showPath && this.enemy.path && this.enemy.path.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 0, 85, 0.6)';
      ctx.lineWidth = Math.max(2, cellSize * 0.15);
      ctx.setLineDash([5, 5]);

      for (let i = 0; i < this.enemy.path.length; i++) {
        const pt = this.enemy.path[i];
        const px = (pt.c + 0.5) * cellSize;
        const py = (pt.r + 0.5) * cellSize;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (this.hintTimer > 0 && this.hintPath && this.hintPath.length > 0) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.8)';
      ctx.lineWidth = Math.max(3, cellSize * 0.2);
      for (let i = 0; i < this.hintPath.length; i++) {
        const pt = this.hintPath[i];
        const px = (pt.c + 0.5) * cellSize;
        const py = (pt.r + 0.5) * cellSize;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    if (this.player.autoPath && this.player.autoPath.length > 0) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(0, 243, 255, 0.4)';
      ctx.lineWidth = 2;
      ctx.moveTo(this.player.x, this.player.y);
      for (const pt of this.player.autoPath) {
        ctx.lineTo((pt.c + 0.5) * cellSize, (pt.r + 0.5) * cellSize);
      }
      ctx.stroke();
    }

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = Math.max(2, cellSize * 0.1);
    ctx.shadowColor = 'rgba(0, 243, 255, 0.15)';
    ctx.shadowBlur = 4;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = this.maze.grid[r][c];
        if (!cell) continue;
        const x = c * cellSize;
        const y = r * cellSize;

        ctx.beginPath();
        if (cell.walls.top) { ctx.moveTo(x, y); ctx.lineTo(x + cellSize, y); }
        if (cell.walls.right) { ctx.moveTo(x + cellSize, y); ctx.lineTo(x + cellSize, y + cellSize); }
        if (cell.walls.bottom) { ctx.moveTo(x, y + cellSize); ctx.lineTo(x + cellSize, y + cellSize); }
        if (cell.walls.left) { ctx.moveTo(x, y); ctx.lineTo(x, y + cellSize); }
        ctx.stroke();
      }
    }
    ctx.shadowBlur = 0;

    const goalX = (this.goal.c + 0.5) * cellSize;
    const goalY = (this.goal.r + 0.5) * cellSize;
    const goalRadius = cellSize * 0.35;

    ctx.save();
    ctx.translate(goalX, goalY);
    ctx.rotate(Date.now() * 0.002);
    ctx.fillStyle = '#00ff66';
    ctx.shadowColor = '#00ff66';
    ctx.shadowBlur = 14;
    ctx.fillRect(-goalRadius, -goalRadius, goalRadius * 2, goalRadius * 2);
    ctx.restore();

    if (this.maze.powerUps) {
      for (const p of this.maze.powerUps) {
        const px = (p.c + 0.5) * cellSize;
        const py = (p.r + 0.5) * cellSize;
        ctx.font = `${Math.floor(cellSize * 0.6)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        let icon = '⚡';
        if (p.type === 'freeze') icon = '❄️';
        else if (p.type === 'hint') icon = '💡';

        ctx.fillText(icon, px, py);
      }
    }

    for (const p of this.particles) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }

    const playerRadius = cellSize * 0.32;
    ctx.beginPath();
    ctx.arc(this.player.x, this.player.y, playerRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#00f3ff';
    ctx.shadowColor = '#00f3ff';
    ctx.shadowBlur = 15;
    ctx.fill();
    ctx.shadowBlur = 0;

    const enemyRadius = cellSize * 0.34;
    ctx.beginPath();
    ctx.arc(this.enemy.x, this.enemy.y, enemyRadius, 0, Math.PI * 2);
    ctx.fillStyle = this.enemy.freezeTimer > 0 ? '#00d2ff' : '#ff0055';
    ctx.shadowColor = this.enemy.freezeTimer > 0 ? '#00d2ff' : '#ff0055';
    ctx.shadowBlur = 18;
    ctx.fill();
    ctx.shadowBlur = 0;

    if (this.enemy.freezeTimer > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `${Math.floor(cellSize * 0.4)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('❄️', this.enemy.x, this.enemy.y);
    }

    for (const p of this.popups) {
      ctx.save();
      ctx.font = 'bold 13px Orbitron, sans-serif';
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.textAlign = 'center';
      ctx.fillText(p.text, p.x, p.y);
      ctx.restore();
    }

    if (this.fogOfWar) {
      ctx.save();
      ctx.fillStyle = '#050811';
      ctx.beginPath();
      ctx.rect(0, 0, canvas.width, canvas.height);
      const spotlightRadius = cellSize * 4.5;
      ctx.arc(this.player.x, this.player.y, spotlightRadius, 0, Math.PI * 2, true);
      ctx.fill();
      ctx.restore();
    }
  }

  startLoop() {
    let lastFrameTime = performance.now();

    const loop = (now) => {
      const deltaMs = now - lastFrameTime;
      lastFrameTime = now;

      this.handlePlayerInput();
      this.updateEnemy(deltaMs);
      this.updateParticles();
      this.updatePopups();
      this.updateHUD();
      this.render();

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }
}

window.addEventListener('load', () => {
  window.game = new Game();
});
