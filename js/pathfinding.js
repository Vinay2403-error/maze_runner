/**
 * Pathfinding Algorithms: A* (A-Star) and BFS (Breadth-First Search)
 */

class PriorityQueue {
  constructor() {
    this.elements = [];
  }

  enqueue(element, priority) {
    this.elements.push({ element, priority });
    this.elements.sort((a, b) => a.priority - b.priority);
  }

  dequeue() {
    return this.elements.shift().element;
  }

  isEmpty() {
    return this.elements.length === 0;
  }
}

class Pathfinder {
  /**
   * Main entry point to calculate path
   * @param {Maze} maze 
   * @param {{r: number, c: number}} start 
   * @param {{r: number, c: number}} goal 
   * @param {'astar' | 'bfs'} algorithm 
   */
  static findPath(maze, start, goal, algorithm = 'astar') {
    const startTime = performance.now();
    let result;

    if (algorithm === 'astar') {
      result = Pathfinder.findPathAStar(maze, start, goal);
    } else {
      result = Pathfinder.findPathBFS(maze, start, goal);
    }

    const computeTimeMs = (performance.now() - startTime).toFixed(2);

    return {
      path: result.path,
      visitedNodes: result.visitedNodes,
      exploredCount: result.visitedNodes.length,
      computeTimeMs: parseFloat(computeTimeMs)
    };
  }

  /**
   * A* (A-Star) Pathfinding Algorithm
   */
  static findPathAStar(maze, start, goal) {
    const pq = new PriorityQueue();
    const startKey = `${start.r},${start.c}`;
    const goalKey = `${goal.r},${goal.c}`;

    const gScore = new Map();
    const fScore = new Map();
    const cameFrom = new Map();
    const visitedNodes = [];
    const visitedSet = new Set();

    gScore.set(startKey, 0);
    fScore.set(startKey, Pathfinder.heuristic(start, goal));
    pq.enqueue(start, fScore.get(startKey));

    while (!pq.isEmpty()) {
      const current = pq.dequeue();
      const currentKey = `${current.r},${current.c}`;

      if (!visitedSet.has(currentKey)) {
        visitedSet.add(currentKey);
        visitedNodes.push(current);
      }

      // Reached goal?
      if (current.r === goal.r && current.c === goal.goal) { // Note check: current.r === goal.r && current.c === goal.c
      }
      if (current.r === goal.r && current.c === goal.c) {
        return {
          path: Pathfinder.reconstructPath(cameFrom, currentKey),
          visitedNodes
        };
      }

      const neighbors = maze.getValidNeighbors(current.r, current.c);
      for (const neighbor of neighbors) {
        const neighborKey = `${neighbor.r},${neighbor.c}`;
        const tentativeG = gScore.get(currentKey) + 1;

        if (!gScore.has(neighborKey) || tentativeG < gScore.get(neighborKey)) {
          cameFrom.set(neighborKey, current);
          gScore.set(neighborKey, tentativeG);
          const f = tentativeG + Pathfinder.heuristic(neighbor, goal);
          fScore.set(neighborKey, f);
          pq.enqueue(neighbor, f);
        }
      }
    }

    return { path: [], visitedNodes };
  }

  /**
   * BFS (Breadth-First Search) Algorithm
   */
  static findPathBFS(maze, start, goal) {
    const queue = [start];
    const startKey = `${start.r},${start.c}`;

    const cameFrom = new Map();
    const visitedSet = new Set([startKey]);
    const visitedNodes = [start];

    while (queue.length > 0) {
      const current = queue.shift();
      const currentKey = `${current.r},${current.c}`;

      if (current.r === goal.r && current.c === goal.c) {
        return {
          path: Pathfinder.reconstructPath(cameFrom, currentKey),
          visitedNodes
        };
      }

      const neighbors = maze.getValidNeighbors(current.r, current.c);
      for (const neighbor of neighbors) {
        const neighborKey = `${neighbor.r},${neighbor.c}`;
        if (!visitedSet.has(neighborKey)) {
          visitedSet.add(neighborKey);
          visitedNodes.push(neighbor);
          cameFrom.set(neighborKey, current);
          queue.push(neighbor);
        }
      }
    }

    return { path: [], visitedNodes };
  }

  /**
   * Manhattan Distance Heuristic for Grid Pathfinding
   */
  static heuristic(a, b) {
    return Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
  }

  /**
   * Reconstruct path from cameFrom map
   */
  static reconstructPath(cameFrom, currentKey) {
    const path = [];
    let key = currentKey;

    while (key) {
      const [r, c] = key.split(',').map(Number);
      path.unshift({ r, c });

      const prevNode = cameFrom.get(key);
      key = prevNode ? `${prevNode.r},${prevNode.c}` : null;
    }

    return path;
  }
}
