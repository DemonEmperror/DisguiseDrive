import axios from 'axios';
import Cookies from 'js-cookie';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Create axios instance with default config
const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = Cookies.get('auth-token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      Cookies.remove('auth-token');
      Cookies.remove('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (userData) => api.post('/auth/register', userData),
  login: (credentials) => api.post('/auth/login', credentials),
  verify: () => api.post('/auth/verify'),
};

// Folders API
export const foldersAPI = {
  list: () => api.get('/folders'),
  create: (folderData) => api.post('/folders', folderData),
  get: (folderId, folderToken = null) => {
    const headers = folderToken ? { 'X-Folder-Token': folderToken } : {};
    return api.get(`/folders/${folderId}`, { headers });
  },
  lock: (folderId, password) => api.post(`/folders/${folderId}/lock`, { password }),
  unlock: (folderId, password) => api.post(`/folders/${folderId}/unlock`, { password }),
  delete: (folderId) => api.delete(`/folders/${folderId}`),
};

// Files API
export const filesAPI = {
  upload: (folderId, formData, folderToken = null) => {
    const headers = {
      'Content-Type': 'multipart/form-data',
      ...(folderToken && { 'X-Folder-Token': folderToken }),
    };
    return api.post(`/folders/${folderId}/files`, formData, { headers });
  },
  
  getMeta: (fileId) => api.get(`/files/${fileId}/meta`),
  
  getCoverUrl: (fileId) => `${API_BASE_URL}/api/files/${fileId}/cover`,
  
  getEncrypted: async (fileId, folderToken = null) => {
    const headers = folderToken ? { 'X-Folder-Token': folderToken } : {};
    const response = await api.get(`/files/${fileId}/encrypted`, {
      headers,
      responseType: 'arraybuffer',
    });
    return response.data;
  },
  
  decrypt: async (fileId, password, folderToken) => {
    const response = await api.post(`/files/${fileId}/decrypt`, 
      { password },
      {
        headers: folderToken ? { 'X-Folder-Token': folderToken } : {},
        responseType: 'arraybuffer'
      }
    );
    return response;
  },
  
  getFileUrl: async (fileId, folderToken) => {
    const response = await api.get(`/files/${fileId}/url`, {
      headers: folderToken ? { 'X-Folder-Token': folderToken } : {}
    });
    return response;
  },
  
  decryptKey: (fileId, password, folderToken = null) => {
    const headers = folderToken ? { 'X-Folder-Token': folderToken } : {};
    return api.post(`/files/${fileId}/decrypt-key`, { password }, { headers });
  },
  
  delete: (fileId) => api.delete(`/files/${fileId}`),
};

export default api;
