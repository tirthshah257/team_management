import axios from 'axios';

// Helper to get cookie value by name
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

export const apiClient = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to attach CSRF token on state-changing requests
apiClient.interceptors.request.use((config) => {
  const method = config.method ? config.method.toUpperCase() : 'GET';
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrfToken = getCookie('XSRF-TOKEN');
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response interceptor for consistent error extraction
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const errorPayload = error.response?.data?.error;
    const message = errorPayload?.message || error.message || 'An error occurred';
    const code = errorPayload?.code || 'UNKNOWN_ERROR';
    const details = errorPayload?.details || null;
    const status = error.response?.status || 500;

    const normalizedError = new Error(message);
    normalizedError.code = code;
    normalizedError.status = status;
    normalizedError.details = details;
    normalizedError.raw = error;

    return Promise.reject(normalizedError);
  }
);
