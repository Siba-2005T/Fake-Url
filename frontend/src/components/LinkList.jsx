/**
 * LinkList.jsx - Danh sách Cloak Links
 * =======================================
 * Hiển thị lưới các LinkCard.
 * Xử lý trạng thái loading, empty state, và error.
 */
import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, LinkIcon, Plus } from 'lucide-react';
import LinkCard from './LinkCard';
import { fetchLinks } from '../api/api';

const LinkList = ({ refreshTrigger, onCreateNew }) => {
  const [links, setLinks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);

  // Load danh sách links
  const loadLinks = useCallback(async (currentPage = 1) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchLinks(currentPage, 12);
      setLinks(data.data);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load lại khi refreshTrigger thay đổi (sau khi tạo link mới)
  useEffect(() => {
    loadLinks(1);
    setPage(1);
  }, [refreshTrigger, loadLinks]);

  // Xử lý khi link bị xóa: cập nhật state local (không cần refetch)
  const handleLinkDeleted = (deletedId) => {
    setLinks((prev) => prev.filter((l) => l.id !== deletedId));
  };

  // ---- Loading State ----
  if (isLoading) {
    return (
      <div className="link-list-state">
        <div className="loading-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="link-card-skeleton glass-card">
              <div className="skeleton-thumb" />
              <div className="skeleton-body">
                <div className="skeleton-line skeleton-title" />
                <div className="skeleton-line skeleton-desc" />
                <div className="skeleton-line skeleton-url" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ---- Error State ----
  if (error) {
    return (
      <div className="link-list-state">
        <div className="state-container">
          <div className="state-icon state-icon--error">⚠️</div>
          <h3>Không thể tải danh sách</h3>
          <p className="state-desc">{error}</p>
          <button
            className="btn btn-outline"
            onClick={() => loadLinks(page)}
          >
            <RefreshCw size={16} />
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  // ---- Empty State ----
  if (links.length === 0) {
    return (
      <div className="link-list-state">
        <div className="state-container">
          <div className="state-icon">🔗</div>
          <h3>Chưa có Cloak Link nào</h3>
          <p className="state-desc">
            Tạo Cloak Link đầu tiên của bạn để bắt đầu che giấu URL và tùy chỉnh preview mạng xã hội.
          </p>
          <button className="btn btn-primary" onClick={onCreateNew}>
            <Plus size={16} />
            Tạo Link Đầu Tiên
          </button>
        </div>
      </div>
    );
  }

  // ---- Danh sách Links ----
  return (
    <div className="link-list-container">
      {/* Header */}
      <div className="link-list-header">
        <div className="link-list-count">
          <LinkIcon size={16} />
          <span>
            {pagination?.total || links.length} link
            {(pagination?.total || links.length) > 1 ? 's' : ''}
          </span>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => loadLinks(page)}
          title="Làm mới danh sách"
        >
          <RefreshCw size={14} />
          Làm mới
        </button>
      </div>

      {/* Grid LinkCards */}
      <div className="links-grid">
        {links.map((link) => (
          <LinkCard
            key={link.id}
            link={link}
            onDeleted={handleLinkDeleted}
          />
        ))}
      </div>

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="pagination">
          <button
            className="btn btn-ghost btn-sm"
            disabled={!pagination.has_prev}
            onClick={() => { const p = page - 1; setPage(p); loadLinks(p); }}
          >
            ← Trước
          </button>
          <span className="pagination-info">
            Trang {pagination.page} / {pagination.pages}
          </span>
          <button
            className="btn btn-ghost btn-sm"
            disabled={!pagination.has_next}
            onClick={() => { const p = page + 1; setPage(p); loadLinks(p); }}
          >
            Sau →
          </button>
        </div>
      )}
    </div>
  );
};

export default LinkList;
