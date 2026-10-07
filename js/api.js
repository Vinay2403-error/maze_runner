/**
 * REST API Client & Auth Manager
 */
class APIClient {
  constructor() {
    this.token = localStorage.getItem('maze_token') || null;
    this.user = null;
  }

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(endpoint, { ...options, headers });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'API Request failed');
      }
      return data;
    } catch (err) {
      console.warn(`API Error [${endpoint}]:`, err.message);
      throw err;
    }
  }

  async register(username, email, password) {
    const data = await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password })
    });

    this.token = data.token;
    this.user = data.user;
    localStorage.setItem('maze_token', this.token);
    return data;
  }

  async login(usernameOrEmail, password) {
    const data = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ usernameOrEmail, password })
    });

    this.token = data.token;
    this.user = data.user;
    localStorage.setItem('maze_token', this.token);
    return data;
  }

  logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('maze_token');
  }

  async getProfile() {
    if (!this.token) return null;
    try {
      const data = await this.request('/api/auth/me');
      this.user = data.user;
      return data;
    } catch (err) {
      this.logout();
      return null;
    }
  }

  async getLevels() {
    return await this.request('/api/levels');
  }

  async completeLevel(levelId, timeSec) {
    if (!this.token) return null;
    return await this.request('/api/levels/complete', {
      method: 'POST',
      body: JSON.stringify({ levelId, timeSec })
    });
  }

  async getLeaderboard() {
    return await this.request('/api/leaderboard');
  }
}

const api = new APIClient();
