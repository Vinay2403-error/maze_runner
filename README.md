# ⚡ Maze Runner with AI-Controlled Enemy

A playable 2D maze game where the player navigates to an exit while an AI-controlled enemy chases them in real-time using pathfinding algorithms (**A\*** and **BFS**).

Built using **HTML5 Canvas**, **Vanilla JavaScript**, and **Web Audio API**.

---

## ✨ Features

- 🤖 **Real-Time AI Pathfinding**:
  - **A\* Algorithm**: Optimal heuristic search using Manhattan distance ($h = |x_1 - x_2| + |y_1 - y_2|$).
  - **BFS (Breadth-First Search)**: Queue-based unweighted shortest path search.
- 👁️ **Visual Pathfinding Debugger**: Toggle live overlays showing the AI's calculated path and explored search frontier nodes in real-time, along with execution time and step count metrics.
- 🧩 **Procedural Maze Generation**: Generated via the Recursive Backtracking algorithm with customizable grid sizes (**15x15**, **21x21**, **31x31**).
- ⚡ **Power-ups**:
  - ⚡ **Speed Boost**: Doubles player movement speed.
  - ❄️ **Freeze AI**: Freezes the enemy chaser in place.
  - 💡 **Route Hint**: Highlights the optimal path to the exit.
- 🔦 **Fog of War Spotlight Mode**: Dynamic vision cone restricting view around the player.
- 🔊 **Web Audio Synthesizer**: Procedural retro audio effects without external asset downloads.
- 🎮 **Mobile & Desktop Controls**: Playable via Keyboard (Arrow Keys / WASD) or Touch D-Pad.

---

## 📁 Repository Structure

```
.
├── index.html        # Main HTML layout, HUD & control panel
├── style.css         # Cyberpunk dark theme styles
├── README.md         # Documentation
└── js/
    ├── maze.js        # Procedural maze generator (Recursive Backtracking)
    ├── pathfinding.js # A* and BFS pathfinding implementations
    ├── audio.js       # Synthesized Web Audio API sound engine
    └── game.js        # Core game loop, rendering, & AI state manager
```

---

## 🚀 How to Run Locally

No build steps or dependencies required!

### Option 1: Python HTTP Server
```bash
python -m http.server 8000
```
Open `http://localhost:8000` in your web browser.

### Option 2: Directly open `index.html`
Simply double-click or open `index.html` directly in any modern web browser.

---

## 🎮 Game Controls

| Control | Action |
| --- | --- |
| **Arrow Keys / W A S D** | Move Player |
| **On-Screen D-Pad** | Touch Controls (Mobile/Tablet) |
| **Algorithm Selector** | Switch between A* and BFS AI in real-time |
| **AI Speed** | Change enemy speed (Slow, Normal, Fast, Relentless) |
| **Show Path Toggle** | Turn AI visual debugger on/off |
| **Fog of War Toggle** | Turn spotlight vision mode on/off |

---

## 💡 Tech Stack

- **Frontend**: HTML5 Canvas, CSS3, Vanilla JavaScript (ES6+)
- **Algorithms**: A* Search Algorithm, Breadth-First Search (BFS), Recursive Backtracking
- **Audio**: Web Audio API (Synthesized SFX)
