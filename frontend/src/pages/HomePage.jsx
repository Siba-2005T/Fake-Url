/**
 * HomePage.jsx - Trang chủ ứng dụng
 * ====================================
 * Layout chính gồm:
 * - Header với logo và navigation
 * - Tab "Tạo Link" | "Danh sách"
 * - CreateLinkForm component
 * - LinkList component
 */
import { useState } from 'react';
import { Zap, List, Plus, Info } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import CreateLinkForm from '../components/CreateLinkForm';
import LinkList from '../components/LinkList';

const HomePage = () => {
  // Tab đang active: 'create' hoặc 'list'
  const [activeTab, setActiveTab] = useState('create');
  // Trigger để LinkList reload khi tạo link mới
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Callback sau khi tạo link thành công
  const handleLinkCreated = (newLink) => {
    toast.success(
      <div>
        <strong>✅ Tạo link thành công!</strong>
        <br />
        <code style={{ fontSize: '0.8em', opacity: 0.8 }}>
          /{newLink.custom_slug}
        </code>
      </div>,
      { duration: 5000 }
    );
    // Tăng trigger để LinkList tự reload
    setRefreshTrigger((prev) => prev + 1);
    // Chuyển sang tab danh sách
    setActiveTab('list');
  };

  return (
    <div className="home-page">
      {/* ====================== HEADER ====================== */}
      <header className="app-header">
        <div className="container">
          <div className="header-inner">
            {/* Logo */}
            <div className="header-logo">
              <div className="logo-icon">
                <Zap size={22} />
              </div>
              <div>
                <h1 className="logo-title">CloakLink</h1>
                <p className="logo-subtitle">Che giấu URL & Custom OG Tags</p>
              </div>
            </div>

            {/* Navigation */}
            <nav className="header-nav">
              <a
                href={`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/health`}
                target="_blank"
                rel="noopener noreferrer"
                className="nav-link"
                title="Kiểm tra API Backend"
              >
                <Info size={16} />
                <span className="hide-mobile">API Status</span>
              </a>
            </nav>
          </div>
        </div>
      </header>

      {/* ====================== MAIN ====================== */}
      <main className="app-main">
        <div className="container">

          {/* Tabs Navigation */}
          <div className="tabs-nav">
            <button
              id="tab-create"
              className={`tab-btn ${activeTab === 'create' ? 'tab-btn--active' : ''}`}
              onClick={() => setActiveTab('create')}
            >
              <Plus size={16} />
              Tạo Link Mới
            </button>
            <button
              id="tab-list"
              className={`tab-btn ${activeTab === 'list' ? 'tab-btn--active' : ''}`}
              onClick={() => setActiveTab('list')}
            >
              <List size={16} />
              Danh Sách Link
              {refreshTrigger > 0 && <span className="tab-dot" />}
            </button>
          </div>

          {/* Tab Content */}
          <div className="tab-content">
            {activeTab === 'create' && (
              <div className="glass-card tab-panel animate-scale-in" id="panel-create">
                <CreateLinkForm onSuccess={handleLinkCreated} />
              </div>
            )}

            {activeTab === 'list' && (
              <div className="tab-panel animate-fade-in" id="panel-list">
                <LinkList
                  refreshTrigger={refreshTrigger}
                  onCreateNew={() => setActiveTab('create')}
                />
              </div>
            )}
          </div>

          {/* ====================== HOW IT WORKS ====================== */}
          <div className="how-it-works glass-card">
            <h2 className="hiw-title">⚡ Cơ chế hoạt động</h2>
            <div className="hiw-steps">
              <div className="hiw-step">
                <div className="hiw-step-num">1</div>
                <div className="hiw-step-content">
                  <h4>Facebook/Zalo crawl link</h4>
                  <p>Bot mạng xã hội gửi request đến URL cloak của bạn</p>
                </div>
              </div>
              <div className="hiw-arrow">→</div>
              <div className="hiw-step">
                <div className="hiw-step-num">2</div>
                <div className="hiw-step-content">
                  <h4>Server trả về OG Tags</h4>
                  <p>Backend render HTML với <code>og:image</code>, <code>og:title</code> tùy chỉnh</p>
                </div>
              </div>
              <div className="hiw-arrow">→</div>
              <div className="hiw-step">
                <div className="hiw-step-num">3</div>
                <div className="hiw-step-content">
                  <h4>Preview đẹp xuất hiện</h4>
                  <p>Ảnh & tiêu đề của bạn hiển thị thay vì ảnh gốc của Shopee</p>
                </div>
              </div>
              <div className="hiw-arrow">→</div>
              <div className="hiw-step">
                <div className="hiw-step-num">4</div>
                <div className="hiw-step-content">
                  <h4>Người dùng click → Redirect</h4>
                  <p>JS <code>window.location.replace()</code> chuyển hướng sang URL gốc tức thì</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ====================== FOOTER ====================== */}
      <footer className="app-footer">
        <div className="container">
          <p>CloakLink — Cloak URL & Custom OG Tags</p>
        </div>
      </footer>

      {/* Toast notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#313244',
            color: '#cdd6f4',
            border: '1px solid rgba(203,166,247,0.2)',
            borderRadius: '12px',
            fontSize: '0.9rem',
          },
          success: { iconTheme: { primary: '#a6e3a1', secondary: '#313244' } },
          error: { iconTheme: { primary: '#f38ba8', secondary: '#313244' } },
        }}
      />
    </div>
  );
};

export default HomePage;
