/**
 * api.js - Axios instance và các hàm gọi API
 * ============================================
 * Cấu hình Axios với base URL, interceptors,
 * và định nghĩa tất cả các hàm gọi API backend.
 */
import axios from 'axios';

// ============================================================
// Tạo Axios instance với cấu hình mặc định
// ============================================================
const api = axios.create({
  // Base URL của Flask backend
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  // Timeout 30 giây
  timeout: 30000,
});

// Request Interceptor: log request (hữu ích khi debug)
api.interceptors.request.use(
  (config) => {
    // Không set Content-Type ở đây vì khi upload file
    // browser tự set multipart/form-data với boundary đúng
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: chuẩn hóa lỗi
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.error ||
      error.message ||
      'Có lỗi xảy ra. Vui lòng thử lại.';
    return Promise.reject(new Error(message));
  }
);

// ============================================================
// API Functions
// ============================================================

/**
 * Lấy danh sách tất cả Cloak Links (có phân trang)
 * @param {number} page - Trang hiện tại
 * @param {number} perPage - Số item mỗi trang
 */
export const fetchLinks = async (page = 1, perPage = 20) => {
  const { data } = await api.get('/api/links/', {
    params: { page, per_page: perPage },
  });
  return data;
};

/**
 * Tạo Cloak Link mới
 * Sử dụng FormData vì có upload file ảnh
 *
 * @param {Object} linkData - Dữ liệu link
 * @param {string} linkData.original_url   - URL gốc
 * @param {string} linkData.custom_slug    - Slug tùy chỉnh
 * @param {string} [linkData.custom_domain] - Tên miền riêng
 * @param {string} [linkData.og_title]     - Tiêu đề OG
 * @param {string} [linkData.og_description] - Mô tả OG
 * @param {string} [linkData.telegram_file_id] - File ID video trên Telegram
 * @param {string} [linkData.content_description] - Mô tả hiển thị dưới video
 * @param {string} [linkData.second_affiliate_url] - Link phụ (TikTok) — bẫy click tầng 2
 * @param {File}   [linkData.image]        - File ảnh thumbnail
 */
export const createLink = async (linkData) => {
  const formData = new FormData();

  // Append các field text
  formData.append('original_url', linkData.original_url);
  formData.append('custom_slug', linkData.custom_slug);

  if (linkData.custom_domain) formData.append('custom_domain', linkData.custom_domain);
  if (linkData.og_title)      formData.append('og_title', linkData.og_title);
  if (linkData.og_description) formData.append('og_description', linkData.og_description);
  if (linkData.video_source)    formData.append('video_source', linkData.video_source);
  if (linkData.telegram_file_id) formData.append('telegram_file_id', linkData.telegram_file_id);
  if (linkData.direct_video_url) formData.append('direct_video_url', linkData.direct_video_url);
  if (linkData.content_description) formData.append('content_description', linkData.content_description);
  if (linkData.second_affiliate_url) formData.append('second_affiliate_url', linkData.second_affiliate_url);

  // Append file ảnh (nếu có)
  if (linkData.image instanceof File) {
    formData.append('image', linkData.image);
  }

  const { data } = await api.post('/api/links/', formData);
  return data;
};

/**
 * Cập nhật Cloak Link theo ID
 * @param {number} id - ID của link cần cập nhật
 * @param {Object} linkData - Dữ liệu cần cập nhật
 */
export const updateLink = async (id, linkData) => {
  const formData = new FormData();

  if (linkData.original_url !== undefined) formData.append('original_url', linkData.original_url);
  if (linkData.custom_domain !== undefined) formData.append('custom_domain', linkData.custom_domain || '');
  if (linkData.og_title !== undefined)      formData.append('og_title', linkData.og_title || '');
  if (linkData.og_description !== undefined) formData.append('og_description', linkData.og_description || '');
  if (linkData.video_source !== undefined)    formData.append('video_source', linkData.video_source || 'direct');
  if (linkData.telegram_file_id !== undefined) formData.append('telegram_file_id', linkData.telegram_file_id || '');
  if (linkData.direct_video_url !== undefined) formData.append('direct_video_url', linkData.direct_video_url || '');
  if (linkData.content_description !== undefined) formData.append('content_description', linkData.content_description || '');
  if (linkData.second_affiliate_url !== undefined) formData.append('second_affiliate_url', linkData.second_affiliate_url || '');
  if (linkData.is_active !== undefined)     formData.append('is_active', linkData.is_active.toString());
  if (linkData.image instanceof File)       formData.append('image', linkData.image);

  const { data } = await api.put(`/api/links/${id}`, formData);
  return data;
};

/**
 * Xóa Cloak Link theo ID
 * @param {number} id - ID của link cần xóa
 */
export const deleteLink = async (id) => {
  const { data } = await api.delete(`/api/links/${id}`);
  return data;
};

/**
 * Kiểm tra slug có khả dụng không
 * @param {string} slug - Slug cần kiểm tra
 */
export const checkSlugAvailability = async (slug) => {
  const { data } = await api.get(`/api/check-slug/${slug}`);
  return data;
};

/**
 * Lấy danh sách video Telegram đã nhận được qua webhook
 */
export const fetchTelegramVideos = async () => {
  const { data } = await api.get('/api/telegram-videos');
  return data;
};

export default api;
