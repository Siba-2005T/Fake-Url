/**
 * api.js - Axios instance với JWT Interceptor + CRUD functions
 */
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  timeout: 30000,
});

/* ── JWT Interceptor: tự gắn Authorization header ── */
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

/* ── Response interceptor: xử lý lỗi 401 (token hết hạn) ── */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Nếu là lỗi 401 và KHÔNG phải ở trang đăng nhập thì mới báo hết hạn phiên
    const isLoginRequest = error.config && error.config.url && error.config.url.includes('/api/login');
    
    if (error.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      return Promise.reject(new Error('Phiên đăng nhập đã hết hạn.'));
    }
    
    const message = error.response?.data?.error || error.message || 'Có lỗi xảy ra.';
    return Promise.reject(new Error(message));
  }
);

/* ── Auth ── */
export const loginAPI = async (username, password) => {
  const { data } = await api.post('/api/login', { username, password });
  return data;
};

export const fetchCurrentUser = async () => {
  const { data } = await api.get('/api/me');
  return data;
};

/* ── Users (Admin) ── */
export const fetchUsers = async () => {
  const { data } = await api.get('/api/users');
  return data;
};

export const createUser = async (payload) => {
  const { data } = await api.post('/api/users', payload);
  return data;
};

export const deleteUser = async (id) => {
  const { data } = await api.delete(`/api/users/${id}`);
  return data;
};

/* ── Cloak Links ── */
export const fetchLinks = async (page = 1, perPage = 20) => {
  const { data } = await api.get('/api/links/', { params: { page, per_page: perPage } });
  return data;
};

export const createLink = async (linkData) => {
  const formData = new FormData();
  // V2.1: Gửi link1_value, link1_platform (hỗ trợ auto-create)
  if (linkData.link1_value)         formData.append('link1_value', linkData.link1_value);
  if (linkData.link1_platform)      formData.append('link1_platform', linkData.link1_platform);
  if (linkData.link2_value)         formData.append('link2_value', linkData.link2_value);
  if (linkData.link2_platform)      formData.append('link2_platform', linkData.link2_platform);
  // Fallback v1: original_url nếu không dùng ID
  if (linkData.original_url)        formData.append('original_url', linkData.original_url);
  formData.append('custom_slug', linkData.custom_slug);
  if (linkData.custom_domain)       formData.append('custom_domain', linkData.custom_domain);
  if (linkData.og_title)            formData.append('og_title', linkData.og_title);
  if (linkData.og_description)      formData.append('og_description', linkData.og_description);
  if (linkData.og_image_url)        formData.append('og_image_url', linkData.og_image_url);
  if (linkData.video_source)        formData.append('video_source', linkData.video_source);
  if (linkData.telegram_file_id)    formData.append('telegram_file_id', linkData.telegram_file_id);
  if (linkData.direct_video_url)    formData.append('direct_video_url', linkData.direct_video_url);
  if (linkData.content_description) formData.append('content_description', linkData.content_description);
  if (linkData.image instanceof File) formData.append('image', linkData.image);
  const { data } = await api.post('/api/links/', formData);
  return data;
};

export const updateLink = async (id, linkData) => {
  const formData = new FormData();
  // V2.1
  if (linkData.link1_value !== undefined)        formData.append('link1_value', linkData.link1_value || '');
  if (linkData.link1_platform !== undefined)     formData.append('link1_platform', linkData.link1_platform || '');
  if (linkData.link2_value !== undefined)        formData.append('link2_value', linkData.link2_value || '');
  if (linkData.link2_platform !== undefined)     formData.append('link2_platform', linkData.link2_platform || '');
  if (linkData.original_url !== undefined)       formData.append('original_url', linkData.original_url);
  if (linkData.custom_domain !== undefined)      formData.append('custom_domain', linkData.custom_domain || '');
  if (linkData.og_title !== undefined)           formData.append('og_title', linkData.og_title || '');
  if (linkData.og_description !== undefined)     formData.append('og_description', linkData.og_description || '');
  if (linkData.og_image_url !== undefined)       formData.append('og_image_url', linkData.og_image_url || '');
  if (linkData.video_source !== undefined)       formData.append('video_source', linkData.video_source || 'direct');
  if (linkData.telegram_file_id !== undefined)   formData.append('telegram_file_id', linkData.telegram_file_id || '');
  if (linkData.direct_video_url !== undefined)   formData.append('direct_video_url', linkData.direct_video_url || '');
  if (linkData.content_description !== undefined) formData.append('content_description', linkData.content_description || '');
  if (linkData.is_active !== undefined)          formData.append('is_active', linkData.is_active.toString());
  if (linkData.image instanceof File)            formData.append('image', linkData.image);
  const { data } = await api.put(`/api/links/${id}`, formData);
  return data;
};

export const deleteLink = async (id) => {
  const { data } = await api.delete(`/api/links/${id}`);
  return data;
};

export const checkSlugAvailability = async (slug) => {
  const { data } = await api.get(`/api/check-slug/${slug}`);
  return data;
};

/* ── Telegram Videos ── */
export const fetchTelegramVideos = async () => {
  const { data } = await api.get('/api/telegram-videos');
  return data;
};

export const deleteTelegramVideo = async (id) => {
  const { data } = await api.delete(`/api/telegram-videos/${id}`);
  return data;
};

/* ── Direct Videos ── */
export const fetchDirectVideos = async () => {
  const { data } = await api.get('/api/direct-videos');
  return data;
};

export const createDirectVideo = async (payload) => {
  const { data } = await api.post('/api/direct-videos', payload);
  return data;
};

export const updateDirectVideo = async (id, payload) => {
  const { data } = await api.put(`/api/direct-videos/${id}`, payload);
  return data;
};

export const deleteDirectVideo = async (id) => {
  const { data } = await api.delete(`/api/direct-videos/${id}`);
  return data;
};

/* ── Affiliate Links ── */
export const fetchAffiliateLinks = async (platform = '') => {
  const params = platform ? { platform } : {};
  const { data } = await api.get('/api/affiliate-links', { params });
  return data;
};

export const createAffiliateLink = async (payload) => {
  const { data } = await api.post('/api/affiliate-links', payload);
  return data;
};

export const updateAffiliateLink = async (id, payload) => {
  const { data } = await api.put(`/api/affiliate-links/${id}`, payload);
  return data;
};

export const deleteAffiliateLink = async (id) => {
  const { data } = await api.delete(`/api/affiliate-links/${id}`);
  return data;
};

export default api;
