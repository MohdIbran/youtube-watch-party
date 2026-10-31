import api from './api';

const authService = {
  /**
   * Register a new user
   * @param {Object} userData - { username, email, password }
   */
  async register(userData) {
    const response = await api.post('/api/auth/register', userData);
    return response.data;
  },

  /**
   * Login user
   * @param {Object} credentials - { email, password }
   */
  async login(credentials) {
    const response = await api.post('/api/auth/login', credentials);
    return response.data;
  },

  /**
   * Get current authenticated user profile
   */
  async getMe() {
    const response = await api.get('/api/auth/me');
    return response.data;
  },
};

export default authService;
