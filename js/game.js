/**
 * Maze Runner Game Engine
 */
class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    // Settings & State
    this.rows = 21;
    this.cols = 21;
    this.cellSize = 30;

    this.algorithm = 'astar';
    this.aiSpeedMode = 'medium';
    this.showPath = true;
    this.fogOfWar = false;

    this.isPlaying = false;
    this.isPaused = false;
    this.startTime = 0;
    this.elapsedTime = 0;
    this.timerInterval = null;

    // Game Entities
    this.maze = null;
    this.player = { r: 0, c: 0, x: 0, y: 0, speedBoostTimer: 0 };
    this.enemy = { r: 0, c: 0, x: 0, y: 0, path: [], moveTimer: 0, freezeTimer: 0, visitedNodes: [] };
    this.goal = { r: 0, c: 0 };

    // Active Buffs / Effects
    this.activeBuff = 'None';
    this.hintTimer = 0;
    this.hintPath = [];
    this.particles = [];

    // Key states
    this.keys = {};
    this.lastMoveTime = 0;

    // AI timing configuration (in ms per step)
    this.speedIntervals = {
      easy: 420,
      medium: 260,
      hard: 180,
      nightmare: 120
    };

    this.initUI();
    this.initMaze();
    this.setupEventListeners();
    this.startLoop();
  }

  initUI() {
    this.ui = {
      timer: document.getElementById('hudTimer'),
      goalDist: document.getElementById('hudGoalDist'),
      enemyDist: document.getElementById('hudEnemyDist'),
      buff: document.getElementById('hudBuff'),
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
      winModal: document.getElementById('winModal'),
      loseModal: document.getElementById('loseModal'),
      btnWinRestart: document.getElementById('btnWinRestart'),
      btnLoseRestart: document.getElementById('btnLoseRestart'),
      winTime: document.getElementById('winTime'),
      winAlgo: document.getElementById('winAlgo'),
      winSize: document.getElementById('winSize'),
      loseTime: document.getElementById('loseTime'),
      loseDist: document.getElementById('loseDist')
    };
  }

  initMaze() {
    this.rows = parseInt(this.ui.sizeSelect.value, 10);
    this.cols = this.rows;

    // Calculate dynamic canvas size & cell size
    const maxCanvasDim = Math.min(window.innerWidth - 400, window.innerHeight - 200, 700);
    const canvasSize = Math.max(350, Math.min(700, maxCanvasDim || 650));
    this.canvas.width = canvasSize;
    this.canvas.height = canvasSize;
    this.cellSize = canvasSize / this.cols;

    // Generate maze
    this.maze = new Maze(this.rows, this.cols);
    this.maze.generate();

    // Reset entities
    this.player.r = 0;
    this.player.c = 0;
    this.player.x = (0 + 0.5) * this.cellSize;
    this.player.y = (0 + 0.5) * this.cellSize;
    this.player.speedBoostTimer = 0;

    this.goal.r = this.rows - 1;
    this.goal.c = this.cols - 1;

    // Enemy starts at bottom-left corner or furthest point
    this.enemy.r = this.rows - 1;
    this.enemy.c = 0;
    this.enemy.x = (this.enemy.c + 0.5) * this.cellSize;
    this.enemy.y = (this.enemy.r + 0.5) * this.cellSize;
    this.enemy.moveTimer = 0;
    this.enemy.freezeTimer = 0;

    this.activeBuff = 'None';
    this.hintTimer = 0;
    this.particles = [];

    // Initial AI path calculation
    this.updateAIPath();

    // Reset Game Timer
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
  }

  setupEventListeners() {
    // Keyboard controls
    window.addEventListener('keydown', (e) => {
      sounds.init();
      this.keys[e.code] = true;
      this.handlePlayerInput();
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // Touch / D-pad controls
    const touchButtons = document.querySelectorAll('.dbtn');
    touchButtons.forEach(btn => {
      const dir = btn.getAttribute('data-dir');
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        sounds.init();
        this.movePlayerDirection(dir);
      });
      btn.addEventListener('click', () => {
        sounds.init();
        this.movePlayerDirection(dir);
      });
    });

    // Sidebar UI controls
    this.ui.algoSelect.addEventListener('change', () => {
      this.algorithm = this.ui.algoSelect.value;
      this.updateAIPath();
    });

    this.ui.speedSelect.addEventListener('change', () => {
      this.aiSpeedMode = this.ui.speedSelect.value;
    });

    this.ui.sizeSelect.addEventListener('change', () => {
      this.initMaze();
    });

    this.ui.btnNewMaze.addEventListener('click', () => {
      this.initMaze();
    });

    this.ui.chkShowPath.addEventListener('change', (e) => {
      this.showPath = e.target.checked;
    });

    this.ui.chkFogOfWar.addEventListener('change', (e) => {
      this.fogOfWar = e.target.checked;
    });

    this.ui.chkAudio.addEventListener('change', (e) => {
      sounds.enabled = e.target.checked;
    });

    // Modal Restarts
    this.ui.btnWinRestart.addEventListener('click', () => {
      this.initMaze();
    });

    this.ui.btnLoseRestart.addEventListener('click', () => {
      this.initMaze();
    });
  }

  handlePlayerInput() {
    if (!this.isPlaying || this.isPaused) return;

    const now = performance.now();
    const moveDelay = this.player.speedBoostTimer > 0 ? 80 : 130; // Faster step if speed boost
    if (now - this.lastMoveTime < moveDelay) return;

    let moved = false;
    if (this.keys['ArrowUp'] || this.keys['KeyW']) {
      moved = this.movePlayerDirection('UP');
    } else if (this.keys['ArrowDown'] || this.keys['KeyS']) {
      moved = this.movePlayerDirection('DOWN');
    } else if (this.keys['ArrowLeft'] || this.keys['KeyA']) {
      moved = this.movePlayerDirection('LEFT');
    } else if (this.keys['ArrowRight'] || this.keys['KeyD']) {
      moved = this.movePlayerDirection('RIGHT');
    }

    if (moved) {
      this.lastMoveTime = now;
      sounds.playStep();
    }
  }

  movePlayerDirection(dir) {
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

      // Add footstep particles
      this.addParticles((newC + 0.5) * this.cellSize, (newR + 0.5) * this.cellSize, '#00f3ff', 3);

      // Check power-up collection
      this.checkPowerUpCollection();

      // Recalculate AI path when player moves
      this.updateAIPath();

      // Check win condition
      if (this.player.r === this.goal.r && this.player.c === this.goal.c) {
        this.triggerWin();
      }

      return true;
    }
    return false;
  }

  checkPowerUpCollection() {
    const pIndex = this.maze.powerUps.findIndex(p => p.r === this.player.r && p.c === this.player.c);
    if (pIndex !== -1) {
      const powerUp = this.maze.powerUps[pIndex];
      this.maze.powerUps.splice(pIndex, 1);

      if (powerUp.type === 'speed') {
        this.player.speedBoostTimer = 6000; // 6 seconds
        this.activeBuff = 'Speed ⚡';
        sounds.playPowerUp();
      } else if (powerUp.type === 'freeze') {
        this.enemy.freezeTimer = 4500; // 4.5 seconds
        this.activeBuff = 'Freeze ❄️';
        sounds.playFreeze();
      } else if (powerUp.type === 'hint') {
        this.hintTimer = 6000; // 6 seconds
        this.activeBuff = 'Hint 💡';
        const hintResult = Pathfinder.findPath(this.maze, { r: this.player.r, c: this.player.c }, this.goal, 'astar');
        this.hintPath = hintResult.path;
        sounds.playPowerUp();
      }

      this.addParticles((this.player.c + 0.5) * this.cellSize, (this.player.r + 0.5) * this.cellSize, '#ffd700', 12);
    }
  }

  updateAIPath() {
    if (!this.maze) return;
    const start = { r: this.enemy.r, c: this.enemy.c };
    const target = { r: this.player.r, c: this.player.c };

    const result = Pathfinder.findPath(this.maze, start, target, this.algorithm);
    this.enemy.path = result.path;
    this.enemy.visitedNodes = result.visitedNodes;

    // Update stats UI
    this.ui.statNodes.textContent = result.exploredCount;
    this.ui.statTime.textContent = `${result.computeTimeMs} ms`;
    this.ui.statLength.textContent = `${result.path.length} steps`;
  }

  updateEnemy(deltaMs) {
    if (!this.isPlaying || this.isPaused) return;

    // Handle Freeze timer
    if (this.enemy.freezeTimer > 0) {
      this.enemy.freezeTimer -= deltaMs;
      if (this.enemy.freezeTimer <= 0) {
        this.enemy.freezeTimer = 0;
        if (this.activeBuff.includes('Freeze')) this.activeBuff = 'None';
      }
      return; // Enemy frozen
    }

    // Handle Speed boost timer
    if (this.player.speedBoostTimer > 0) {
      this.player.speedBoostTimer -= deltaMs;
      if (this.player.speedBoostTimer <= 0) {
        this.player.speedBoostTimer = 0;
        if (this.activeBuff.includes('Speed')) this.activeBuff = 'None';
      }
    }

    // Handle Hint timer
    if (this.hintTimer > 0) {
      this.hintTimer -= deltaMs;
      if (this.hintTimer <= 0) {
        this.hintTimer = 0;
        if (this.activeBuff.includes('Hint')) this.activeBuff = 'None';
      }
    }

    // Enemy movement timer
    this.enemy.moveTimer += deltaMs;
    const interval = this.speedIntervals[this.aiSpeedMode] || 260;

    if (this.enemy.moveTimer >= interval) {
      this.enemy.moveTimer = 0;

      // Enemy moves one step along current path
      if (this.enemy.path.length > 1) {
        // Index 0 is current enemy cell, index 1 is next step towards player
        const nextStep = this.enemy.path[1];
        this.enemy.r = nextStep.r;
        this.enemy.c = nextStep.c;

        // Recalculate path
        this.updateAIPath();

        // Check lose condition
        if (this.enemy.r === this.player.r && this.enemy.c === this.player.c) {
          this.triggerLose();
        }
      }
    }
  }

  triggerWin() {
    this.isPlaying = false;
    clearInterval(this.timerInterval);
    sounds.playWin();

    this.ui.winTime.textContent = this.ui.timer.textContent;
    this.ui.winAlgo.textContent = this.algorithm.toUpperCase();
    this.ui.winSize.textContent = `${this.rows}x${this.cols}`;
    this.ui.winModal.classList.remove('hidden');
  }

  triggerLose() {
    this.isPlaying = false;
    clearInterval(this.timerInterval);
    sounds.playLose();

    const distToExit = Math.abs(this.player.r - this.goal.r) + Math.abs(this.player.c - this.goal.c);
    this.ui.loseTime.textContent = this.ui.timer.textContent;
    this.ui.loseDist.textContent = `${distToExit} steps`;
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
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  updateHUD() {
    const goalDist = Math.abs(this.player.r - this.goal.r) + Math.abs(this.player.c - this.goal.c);
    const enemyDist = Math.abs(this.player.r - this.enemy.r) + Math.abs(this.player.c - this.enemy.c);

    this.ui.goalDist.textContent = `${goalDist}m`;
    this.ui.enemyDist.textContent = `${enemyDist}m`;
    this.ui.buff.textContent = this.activeBuff;
  }

  // RENDER ENGINE
  render() {
    const { ctx, canvas, cellSize, rows, cols } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Smooth position interpolation
    this.player.x += ((this.player.c + 0.5) * cellSize - this.player.x) * 0.35;
    this.player.y += ((this.player.r + 0.5) * cellSize - this.player.y) * 0.35;

    this.enemy.x += ((this.enemy.c + 0.5) * cellSize - this.enemy.x) * 0.25;
    this.enemy.y += ((this.enemy.r + 0.5) * cellSize - this.enemy.y) * 0.25;

    // 1. Draw Visited Nodes Debugger (Translucent Search Frontier)
    if (this.showPath && this.enemy.visitedNodes) {
      ctx.fillStyle = 'rgba(157, 78, 221, 0.15)';
      for (const node of this.enemy.visitedNodes) {
        ctx.fillRect(node.c * cellSize + 2, node.r * cellSize + 2, cellSize - 4, cellSize - 4);
      }
    }

    // 2. Draw Enemy Path Line Debugger
    if (this.showPath && this.enemy.path.length > 1) {
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

    // 3. Draw Hint Route if active
    if (this.hintTimer > 0 && this.hintPath.length > 0) {
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

    // 4. Draw Maze Walls
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = Math.max(2, cellSize * 0.1);
    ctx.shadowColor = 'rgba(0, 243, 255, 0.15)';
    ctx.shadowBlur = 4;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = this.maze.grid[r][c];
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
    ctx.shadowBlur = 0; // reset glow

    // 5. Draw Exit Portal (Goal)
    const goalX = (this.goal.c + 0.5) * cellSize;
    const goalY = (this.goal.r + 0.5) * cellSize;
    const goalRadius = cellSize * 0.35;

    ctx.save();
    ctx.translate(goalX, goalY);
    ctx.rotate(Date.now() * 0.002);
    ctx.fillStyle = '#00ff66';
    ctx.shadowColor = '#00ff66';
    ctx.shadowBlur = 12;
    ctx.fillRect(-goalRadius, -goalRadius, goalRadius * 2, goalRadius * 2);
    ctx.restore();

    // 6. Draw Power-Ups
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

    // 7. Draw Particle Effects
    for (const p of this.particles) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }

    // 8. Draw Player
    const playerRadius = cellSize * 0.32;
    ctx.beginPath();
    ctx.arc(this.player.x, this.player.y, playerRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#00f3ff';
    ctx.shadowColor = '#00f3ff';
    ctx.shadowBlur = 15;
    ctx.fill();
    ctx.shadowBlur = 0;

    // 9. Draw AI Enemy
    const enemyRadius = cellSize * 0.34;
    ctx.beginPath();
    ctx.arc(this.enemy.x, this.enemy.y, enemyRadius, 0, Math.PI * 2);
    ctx.fillStyle = this.enemy.freezeTimer > 0 ? '#00d2ff' : '#ff0055';
    ctx.shadowColor = this.enemy.freezeTimer > 0 ? '#00d2ff' : '#ff0055';
    ctx.shadowBlur = 18;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Draw Enemy Eyes / Pulsing Aura
    if (this.enemy.freezeTimer > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `${Math.floor(cellSize * 0.4)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('❄️', this.enemy.x, this.enemy.y);
    }

    // 10. Fog of War Dynamic vision spotlight
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

  // MAIN GAME LOOP
  startLoop() {
    let lastFrameTime = performance.now();

    const loop = (now) => {
      const deltaMs = now - lastFrameTime;
      lastFrameTime = now;

      this.handlePlayerInput();
      this.updateEnemy(deltaMs);
      this.updateParticles();
      this.updateHUD();
      this.render();

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }
}

// Start game when page loads
window.addEventListener('load', () => {
  window.game = new Game();
});
