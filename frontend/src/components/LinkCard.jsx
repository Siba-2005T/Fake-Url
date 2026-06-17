/**
 * LinkCard.jsx - Card hiển thị một Cloak Link
 * =============================================
 * Hiển thị thông tin link với:
 * - Thumbnail ảnh (nếu có)
 * - URL cloak + nút copy
 * - Thống kê click
 * - Badge trạng thái active/inactive
 * - Nút xóa
 */
import { useState } from 'react';
import { Copy, Check, Trash2, ExternalLink, Globe, MousePointerClick, Clock, AlertCircle } from 'lucide-react';
import { deleteLink } from '../api/api';

// Lấy base URL từ biến môi trường (cập nhật trong .env khi deploy)
const SERVER_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Format thời gian tương đối (VD: "2 giờ trước")
const formatRelativeTime = (dateStr) => {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;
  if (diffDays < 30) return `${diffDays} ngày trước`;
  return date.toLocaleDateString('vi-VN');
};

// Rút gọn URL dài để hiển thị
const truncateUrl = (url, maxLen = 60) => {
  if (!url) return '';
  return url.length > maxLen ? url.slice(0, maxLen) + '...' : url;
};

const LinkCard = ({ link, onDeleted }) => {
  const [copied, setCopied] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Tạo URL cloak đầy đủ để hiển thị và copy
  // Nếu có custom domain → dùng domain đó
  // Nếu không → dùng URL của server backend hiện tại (đọc từ .env)
  const hasCustomDomain = Boolean(link.custom_domain);
  const cloakUrl = hasCustomDomain
    ? `https://${link.custom_domain}/${link.custom_slug}`
    : `${SERVER_BASE_URL}/${link.custom_slug}`;

  // --- Copy URL vào clipboard ---
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cloakUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback cho browser cũ
      const textArea = document.createElement('textarea');
      textArea.value = cloakUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // --- Xóa link ---
  const handleDelete = async () => {
    if (!window.confirm(`Bạn có chắc muốn xóa slug "${link.custom_slug}"?`)) return;

    setIsDeleting(true);
    try {
      await deleteLink(link.id);
      onDeleted?.(link.id);
    } catch (error) {
      alert(`Lỗi khi xóa: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className={`link-card glass-card animate-fade-in ${!link.is_active ? 'link-card--inactive' : ''}`}>
      {/* ---- Thumbnail ---- */}
      <div className="link-card__thumbnail">
        {link.image_url ? (
          <img
            src={link.image_url}
            alt={link.og_title || link.custom_slug}
            className="link-card__thumb-img"
            loading="lazy"
          />
        ) : (
          <div className="link-card__thumb-placeholder">
            <Globe size={24} />
          </div>
        )}

        {/* Badge trạng thái */}
        <div className={`link-card__status-badge ${link.is_active ? 'badge-success' : 'badge-warning'} badge`}>
          {link.is_active ? '● Active' : '○ Inactive'}
        </div>
      </div>

      {/* ---- Nội dung chính ---- */}
      <div className="link-card__body">
        {/* OG Title */}
        <h3 className="link-card__title">
          {link.og_title || link.custom_slug}
        </h3>

        {/* OG Description */}
        {link.og_description && (
          <p className="link-card__desc">{truncateUrl(link.og_description, 80)}</p>
        )}

        {/* Cloak URL (có nút copy) */}
        <div className="link-card__url-row">
          <code className="link-card__cloak-url">{cloakUrl}</code>
          <button
            type="button"
            className="btn btn-sm btn-ghost copy-btn"
            onClick={handleCopy}
            title="Copy URL"
            aria-label="Copy cloak URL"
          >
            {copied ? <Check size={14} className="copy-success" /> : <Copy size={14} />}
          </button>
        </div>

        {/* Cảnh báo khi chưa có domain riêng */}
        {!hasCustomDomain && (
          <div className="link-card__domain-hint">
            <AlertCircle size={12} />
            <span>
              Đang dùng server URL. Nhập <strong>Tên Miền Riêng</strong> để có link đẹp hơn (VD: <em>ten-cua-toi.com/{link.custom_slug}</em>)
            </span>
          </div>
        )}

        {/* URL gốc */}
        <div className="link-card__original">
          <ExternalLink size={12} />
          <span title={link.original_url}>{truncateUrl(link.original_url)}</span>
        </div>

        {/* ---- Footer: Thống kê & Actions ---- */}
        <div className="link-card__footer">
          <div className="link-card__stats">
            {/* Click count */}
            <span className="stat-item" title="Số lần được click">
              <MousePointerClick size={13} />
              {link.click_count.toLocaleString('vi-VN')} lượt
            </span>
            {/* Ngày tạo */}
            <span className="stat-item" title={link.created_at}>
              <Clock size={13} />
              {formatRelativeTime(link.created_at)}
            </span>
            {/* Custom domain */}
            {link.custom_domain && (
              <span className="stat-item badge badge-info">
                <Globe size={11} />
                {link.custom_domain}
              </span>
            )}
          </div>

          {/* Nút xóa */}
          <button
            type="button"
            className="btn btn-sm btn-danger"
            onClick={handleDelete}
            disabled={isDeleting}
            title="Xóa link này"
          >
            {isDeleting ? (
              <span className="spinner" style={{ width: 14, height: 14 }} />
            ) : (
              <Trash2 size={14} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LinkCard;
