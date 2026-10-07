const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_FILE = path.join(__dirname, 'database.json');

class Database {
  constructor() {
    this.data = {
      users: [],
      progress: []
    };
    this.init();
  }

  init() {
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        this.data = JSON.parse(raw);
      } catch (err) {
        console.error('Error reading database file, creating fresh DB:', err);
        this.save();
      }
    } else {
      this.save();
    }
  }

  save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to save database file:', err);
    }
  }

  // User Auth Methods
  hashPassword(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  }

  createUser(username, email, password) {
    const existingUser = this.data.users.find(
      u => u.username.toLowerCase() === username.toLowerCase() || u.email.toLowerCase() === email.toLowerCase()
    );
    if (existingUser) {
      throw new Error('Username or Email already exists.');
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = this.hashPassword(password, salt);

    const newUser = {
      id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      username,
      email,
      salt,
      hash,
      createdAt: new Date().toISOString()
    };

    this.data.users.push(newUser);
    this.save();

    return { id: newUser.id, username: newUser.username, email: newUser.email };
  }

  verifyUser(usernameOrEmail, password) {
    const user = this.data.users.find(
      u => u.username.toLowerCase() === usernameOrEmail.toLowerCase() || u.email.toLowerCase() === usernameOrEmail.toLowerCase()
    );

    if (!user) return null;

    const hash = this.hashPassword(password, user.salt);
    if (hash === user.hash) {
      return { id: user.id, username: user.username, email: user.email };
    }
    return null;
  }

  getUserById(id) {
    const user = this.data.users.find(u => u.id === id);
    if (!user) return null;
    return { id: user.id, username: user.username, email: user.email };
  }

  // Level Progress Methods
  getUserProgress(userId) {
    const userRecords = this.data.progress.filter(p => p.userId === userId);
    const progressMap = {};
    userRecords.forEach(r => {
      progressMap[r.levelId] = {
        completed: r.completed,
        bestTimeSec: r.bestTimeSec,
        stars: r.stars,
        completedAt: r.completedAt
      };
    });
    return progressMap;
  }

  saveLevelCompletion(userId, levelId, timeSec, stars = 3) {
    let record = this.data.progress.find(p => p.userId === userId && p.levelId === levelId);
    if (record) {
      record.completed = true;
      record.stars = Math.max(record.stars || 0, stars);
      if (!record.bestTimeSec || timeSec < record.bestTimeSec) {
        record.bestTimeSec = timeSec;
      }
      record.completedAt = new Date().toISOString();
    } else {
      this.data.progress.push({
        userId,
        levelId,
        completed: true,
        bestTimeSec: timeSec,
        stars,
        completedAt: new Date().toISOString()
      });
    }
    this.save();
    return this.getUserProgress(userId);
  }

  getLeaderboard() {
    // Rank users by total completed levels and total best time
    const userStats = {};
    this.data.users.forEach(u => {
      userStats[u.id] = { username: u.username, completedCount: 0, totalTime: 0 };
    });

    this.data.progress.forEach(p => {
      if (userStats[p.userId] && p.completed) {
        userStats[p.userId].completedCount++;
        userStats[p.userId].totalTime += p.bestTimeSec || 0;
      }
    });

    return Object.values(userStats)
      .filter(s => s.completedCount > 0)
      .sort((a, b) => b.completedCount - a.completedCount || a.totalTime - b.totalTime)
      .slice(0, 10);
  }
}

module.exports = new Database();
