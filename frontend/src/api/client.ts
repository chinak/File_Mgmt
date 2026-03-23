import axios from 'axios';

const TOKEN_KEY = 'archive_auth_token';

/** 统一 axios 实例，配置 baseURL 和拦截器 */
const apiClient = axios.create({
  baseURL: '/api',
});

// ---- 请求拦截器：自动注入 Token ----
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ---- 响应错误拦截器 ----
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!axios.isAxiosError(error) || !error.response) {
      return Promise.reject(error);
    }

    const { status } = error.response;

    switch (status) {
      case 401:
        // 清除本地凭证并跳转登录页
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem('archive_auth_user');
        // 避免在登录页重复跳转
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        break;
      case 403:
        // 权限不足 — 由调用方或全局 message 处理
        break;
      case 400:
      case 409:
        // 业务错误 — 保留 data.message 供调用方使用
        break;
      default:
        break;
    }

    return Promise.reject(error);
  },
);

export default apiClient;
