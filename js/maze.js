/**
 * Maze Generator using Recursive Backtracking + Multi-Path Loop Carving
 */
class Cell {
  constructor(r, c) {
    this.r = r;
    this.c = c;
    this.walls = { top: true, right: true, bottom: true, left: true };
    this.visited = false;
  }
}

class Maze {
  constructor(rows, cols) {
    this.rows = rows;
    this.cols = cols;
    this.grid = [];
    this.powerUps = []; // Array of { r, c, type: 'speed' | 'freeze' | 'hint' }
    this.initGrid();
  }

  initGrid() {
    this.grid = [];
    for (let r = 0; r < this.rows; r++) {
      const row = [];
      for (let c = 0; c < this.cols; c++) {
        row.push(new Cell(r, c));
      }
      this.grid.push(row);
    }
  }

  generate() {
    this.initGrid();
    const stack = [];
    let current = this.grid[0][0];
    current.visited = true;

    let unvisitedCount = this.rows * this.cols - 1;

    while (unvisitedCount > 0) {
      const neighbors = this.getUnvisitedNeighbors(current);
      if (neighbors.length > 0) {
        const next = neighbors[Math.floor(Math.random() * neighbors.length)];
        stack.push(current);
        this.removeWall(current, next);

        current = next;
        current.visited = true;
        unvisitedCount--;
      } else if (stack.length > 0) {
        current = stack.pop();
      }
    }

    // 1. Carve 15% internal wall breaks across the maze for multi-path loops & shortcuts
    this.addLoops(0.15);

    // 2. Explicitly guarantee multiple distinct entry routes to the Finish Point
    this.carveMultipleGoalPaths();

    // 3. Spawn power-ups
    this.spawnPowerUps();
  }

  getUnvisitedNeighbors(cell) {
    const { r, c } = cell;
    const neighbors = [];

    if (r > 0 && !this.grid[r - 1][c].visited) neighbors.push(this.grid[r - 1][c]); // Top
    if (c < this.cols - 1 && !this.grid[r][c + 1].visited) neighbors.push(this.grid[r][c + 1]); // Right
    if (r < this.rows - 1 && !this.grid[r + 1][c].visited) neighbors.push(this.grid[r + 1][c]); // Bottom
    if (c > 0 && !this.grid[r][c - 1].visited) neighbors.push(this.grid[r][c - 1]); // Left

    return neighbors;
  }

  removeWall(a, b) {
    const dr = a.r - b.r;
    const dc = a.c - b.c;

    if (dr === 1) {
      a.walls.top = false;
      b.walls.bottom = false;
    } else if (dr === -1) {
      a.walls.bottom = false;
      b.walls.top = false;
    }

    if (dc === 1) {
      a.walls.left = false;
      b.walls.right = false;
    } else if (dc === -1) {
      a.walls.right = false;
      b.walls.left = false;
    }
  }

  addLoops(ratio) {
    const totalInternalWalls = (this.rows - 1) * this.cols + (this.cols - 1) * this.rows;
    const wallsToRemove = Math.floor(totalInternalWalls * ratio);

    for (let i = 0; i < wallsToRemove; i++) {
      const r = Math.floor(Math.random() * (this.rows - 1));
      const c = Math.floor(Math.random() * (this.cols - 1));
      const cell = this.grid[r][c];

      if (Math.random() < 0.5 && cell.walls.right) {
        cell.walls.right = false;
        this.grid[r][c + 1].walls.left = false;
      } else if (cell.walls.bottom) {
        cell.walls.bottom = false;
        this.grid[r + 1][c].walls.top = false;
      }
    }
  }

  /**
   * Specifically carves multiple distinct entrances & branching corridors
   * leading directly into the Finish Exit cell (rows-1, cols-1).
   */
  carveMultipleGoalPaths() {
    const goalR = this.rows - 1;
    const goalC = this.cols - 1;
    const goalCell = this.grid[goalR][goalC];

    // Guarantee Top approach into goal
    if (goalR > 0) {
      const topCell = this.grid[goalR - 1][goalC];
      this.removeWall(goalCell, topCell);
    }

    // Guarantee Left approach into goal
    if (goalC > 0) {
      const leftCell = this.grid[goalR][goalC - 1];
      this.removeWall(goalCell, leftCell);
    }

    // Carve branching shortcuts 2 steps out from the goal
    if (goalR > 1 && goalC > 0) {
      const cellA = this.grid[goalR - 2][goalC];
      const cellB = this.grid[goalR - 2][goalC - 1];
      this.removeWall(cellA, cellB);
    }

    if (goalR > 0 && goalC > 1) {
      const cellC = this.grid[goalR][goalC - 2];
      const cellD = this.grid[goalR - 1][goalC - 2];
      this.removeWall(cellC, cellD);
    }

    if (goalR > 1 && goalC > 1) {
      const diagCell = this.grid[goalR - 1][goalC - 1];
      const leftCell = this.grid[goalR - 1][goalC - 2];
      this.removeWall(diagCell, leftCell);
    }
  }

  spawnPowerUps() {
    this.powerUps = [];
    const types = ['speed', 'freeze', 'hint'];
    const count = Math.max(3, Math.floor((this.rows * this.cols) / 45));

    for (let i = 0; i < count; i++) {
      let r, c;
      let attempts = 0;
      do {
        r = Math.floor(Math.random() * this.rows);
        c = Math.floor(Math.random() * this.cols);
        attempts++;
      } while (
        ( (r === 0 && c === 0) ||
          (r === this.rows - 1 && c === this.cols - 1) ||
          (r === this.rows - 1 && c === 0) ||
          this.hasPowerUpAt(r, c)
        ) && attempts < 150
      );

      if (attempts < 150) {
        const type = types[i % types.length];
        this.powerUps.push({ r, c, type });
      }
    }
  }

  hasPowerUpAt(r, c) {
    return this.powerUps.some(p => p.r === r && p.c === c);
  }

  getValidNeighbors(r, c) {
    const cell = this.grid[r][c];
    const neighbors = [];

    if (!cell.walls.top && r > 0) neighbors.push({ r: r - 1, c });
    if (!cell.walls.right && c < this.cols - 1) neighbors.push({ r, c: c + 1 });
    if (!cell.walls.bottom && r < this.rows - 1) neighbors.push({ r: r + 1, c });
    if (!cell.walls.left && c > 0) neighbors.push({ r, c: c - 1 });

    return neighbors;
  }
}
