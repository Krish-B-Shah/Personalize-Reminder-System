import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token management
const getToken = () => {
  return localStorage.getItem('accessToken');
};

const setTokens = (accessToken, refreshToken) => {
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
};

const clearTokens = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
};

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const response = await axios.post(
            `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/auth/refresh`,
            { refreshToken }
          );

          const { accessToken, refreshToken: newRefreshToken } = response.data.tokens;
          setTokens(accessToken, newRefreshToken);

          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        clearTokens();
        window.location.href = '/signin';
      }
    }

    return Promise.reject(error);
  }
);

// Auth API methods
export const authAPI = {
  // Register with new JWT system
  register: async (userData) => {
    const response = await api.post('/auth/register', userData);
    if (response.data.tokens) {
      setTokens(response.data.tokens.accessToken, response.data.tokens.refreshToken);
    }
    return response.data;
  },

  // Login with new JWT system
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    if (response.data.tokens) {
      setTokens(response.data.tokens.accessToken, response.data.tokens.refreshToken);
    }
    return response.data;
  },

  // Get current user profile
  getProfile: async () => {
    const response = await api.get('/auth/profile');
    return response.data;
  },

  // Logout
  logout: async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      clearTokens();
    }
  },

  // Refresh token
  refreshToken: async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    const response = await api.post('/auth/refresh', { refreshToken });
    if (response.data.tokens) {
      setTokens(response.data.tokens.accessToken, response.data.tokens.refreshToken);
    }
    return response.data;
  }
};

// Users API methods
export const usersAPI = {
  // Get all users (admin only)
  getUsers: async (params = {}) => {
    const response = await api.get('/users', { params });
    return response.data;
  },

  // Get user by ID
  getUser: async (userId) => {
    const response = await api.get(`/users/${userId}`);
    return response.data;
  },

  // Update user profile
  updateProfile: async (profileData) => {
    const response = await api.put('/users/profile', profileData);
    return response.data;
  },

  // Update user role (admin only)
  updateUserRole: async (userId, role) => {
    const response = await api.put(`/users/${userId}/role`, { role });
    return response.data;
  },

  // Delete user (admin only)
  deleteUser: async (userId) => {
    const response = await api.delete(`/users/${userId}`);
    return response.data;
  },

  // Get user statistics (admin only)
  getUserStats: async () => {
    const response = await api.get('/users/stats/overview');
    return response.data;
  }
};

// Internships API methods
export const internshipsAPI = {
  // Get internships with filters
  getInternships: async (params = {}) => {
    const response = await api.get('/internships', { params });
    return response.data;
  },

  // Get internship by ID
  getInternship: async (internshipId) => {
    const response = await api.get(`/internships/${internshipId}`);
    return response.data;
  },

  // Create new internship
  createInternship: async (internshipData) => {
    const response = await api.post('/internships', internshipData);
    return response.data;
  },

  // Update internship
  updateInternship: async (internshipId, updateData) => {
    const response = await api.put(`/internships/${internshipId}`, updateData);
    return response.data;
  },

  // Delete internship
  deleteInternship: async (internshipId) => {
    const response = await api.delete(`/internships/${internshipId}`);
    return response.data;
  },

  // Apply to internship
  applyToInternship: async (internshipId, applicationData) => {
    const response = await api.post(`/internships/${internshipId}/apply`, applicationData);
    return response.data;
  },

  // Get applications for internship
  getApplications: async (internshipId) => {
    const response = await api.get(`/internships/${internshipId}/applications`);
    return response.data;
  }
};

// Reminders API methods
export const remindersAPI = {
  // Get user's reminders
  getReminders: async (params = {}) => {
    const response = await api.get('/reminders', { params });
    return response.data;
  },

  // Create reminder
  createReminder: async (reminderData) => {
    const response = await api.post('/reminders', reminderData);
    return response.data;
  },

  // Update reminder
  updateReminder: async (reminderId, updateData) => {
    const response = await api.put(`/reminders/${reminderId}`, updateData);
    return response.data;
  },

  // Mark reminder as completed
  completeReminder: async (reminderId) => {
    const response = await api.patch(`/reminders/${reminderId}/complete`);
    return response.data;
  },

  // Delete reminder
  deleteReminder: async (reminderId) => {
    const response = await api.delete(`/reminders/${reminderId}`);
    return response.data;
  },

  // Get reminder statistics
  getReminderStats: async () => {
    const response = await api.get('/reminders/stats');
    return response.data;
  }
};

// ML Recommendations API methods
export const mlAPI = {
  // Get personalized recommendations
  getRecommendations: async (params = {}) => {
    const response = await api.get('/ml/recommendations', { params });
    return response.data;
  },

  // Get match score for specific internship
  getMatchScore: async (internshipId) => {
    const response = await api.get(`/ml/match/${internshipId}`);
    return response.data;
  },

  // Bulk match analysis
  bulkMatch: async (internshipIds) => {
    const response = await api.post('/ml/bulk-match', { internshipIds });
    return response.data;
  },

  // Update skills for better matching
  updateSkills: async (skillsData) => {
    const response = await api.put('/ml/profile/skills', skillsData);
    return response.data;
  },

  // Get insights and analytics
  getInsights: async () => {
    const response = await api.get('/ml/insights');
    return response.data;
  }
};

// Utility methods
export const utilsAPI = {
  // Health check
  healthCheck: async () => {
    const response = await api.get('/health');
    return response.data;
  },

  // Test endpoint
  hello: async () => {
    const response = await api.get('/hello');
    return response.data;
  }
};

// Error handling utility
export const handleAPIError = (error) => {
  if (error.response) {
    // Server responded with error status
    const message = error.response.data?.error || error.response.data?.message || 'An error occurred';
    throw new Error(message);
  } else if (error.request) {
    // Request was made but no response received
    throw new Error('Network error - please check your connection');
  } else {
    // Something else happened
    throw new Error(error.message || 'An unexpected error occurred');
  }
};

// Token utilities
export const tokenUtils = {
  getToken,
  setTokens,
  clearTokens,
  isTokenExpired: (token) => {
    if (!token) return true;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }
};

export default api;
