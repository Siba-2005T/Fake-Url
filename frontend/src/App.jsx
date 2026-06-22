/**
 * App.jsx - Root Component với Auth + Sidebar Layout + Protected Routes
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Sidebar from './components/Sidebar';
import LoginPage from './pages/LoginPage';
import CreateLinkPage from './pages/CreateLinkPage';
import LinkManagerPage from './pages/LinkManagerPage';
import VideoManagerPage from './pages/VideoManagerPage';
import AffiliateManagerPage from './pages/AffiliateManagerPage';
import UserManagerPage from './pages/UserManagerPage';
import { Loader2 } from 'lucide-react';
import './App.css';

/* ── Protected Route: yêu cầu đăng nhập ── */
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)', gap: 10 }}>
        <Loader2 size={24} className="animate-spin" /> Đang xác thực...
      </div>
    );
  }
  return user ? children : <Navigate to="/login" replace />;
};

/* ── Admin-only Route ── */
const AdminRoute = ({ children }) => {
  const { user, isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
};

/* ── Dashboard Layout (Sidebar + Content) ── */
const DashboardLayout = () => (
  <div className="dashboard-layout">
    <Sidebar />
    <main className="dashboard-main">
      <Routes>
        <Route path="/" element={<CreateLinkPage />} />
        <Route path="/links" element={<LinkManagerPage />} />
        <Route path="/videos" element={<VideoManagerPage />} />
        <Route path="/affiliate" element={<AffiliateManagerPage />} />
        <Route path="/users" element={<AdminRoute><UserManagerPage /></AdminRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/*" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
