/**
 * Sidebar.jsx - Thanh điều hướng bên trái của Admin Dashboard
 */
import { NavLink } from 'react-router-dom';
import { Zap, PlusCircle, Video, Link2 } from 'lucide-react';

const navItems = [
  { to: '/',        icon: PlusCircle, label: 'Tạo Fake Link' },
  { to: '/videos',  icon: Video,      label: 'Quản lý Video' },
  { to: '/affiliate', icon: Link2,    label: 'Link Tiếp Thị' },
];

const Sidebar = () => (
  <aside className="sidebar">
    {/* Logo */}
    <div className="sidebar-logo">
      <div className="sidebar-logo-icon"><Zap size={20} /></div>
      <span className="sidebar-logo-text">CloakLink</span>
    </div>

    {/* Nav */}
    <nav className="sidebar-nav">
      {navItems.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `sidebar-nav-item ${isActive ? 'sidebar-nav-item--active' : ''}`
          }
        >
          <Icon size={18} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>

    {/* Footer */}
    <div className="sidebar-footer">
      <span>Admin Panel v3.0</span>
    </div>
  </aside>
);

export default Sidebar;
