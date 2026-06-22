/**
 * App.jsx - Root Component với Sidebar Layout
 */
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import CreateLinkPage from './pages/CreateLinkPage';
import VideoManagerPage from './pages/VideoManagerPage';
import AffiliateManagerPage from './pages/AffiliateManagerPage';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="dashboard-layout">
        <Sidebar />
        <main className="dashboard-main">
          <Routes>
            <Route path="/" element={<CreateLinkPage />} />
            <Route path="/videos" element={<VideoManagerPage />} />
            <Route path="/affiliate" element={<AffiliateManagerPage />} />
            <Route path="*" element={<CreateLinkPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
