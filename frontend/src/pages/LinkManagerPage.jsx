/**
 * LinkManagerPage.jsx - Quản lý các Fake Link đã tạo
 */
import { useNavigate } from 'react-router-dom';
import LinkList from '../components/LinkList';

const LinkManagerPage = () => {
  const navigate = useNavigate();

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">📋 Quản lý Fake Link</h2>
      </div>
      
      <div className="glass-card" style={{ padding: '24px' }}>
        <LinkList 
          refreshTrigger={0} 
          onCreateNew={() => navigate('/')} 
        />
      </div>
    </div>
  );
};

export default LinkManagerPage;
