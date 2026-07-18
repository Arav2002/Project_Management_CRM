import React, { useCallback, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts';
import Header from './Header';
import BottomNav from './BottomNav';
import LogoutConfirmModal from './LogoutConfirmModal';
import ShortcutsHelpModal from './ShortcutsHelpModal';
import '../styles/layout.css';

const navItems = [
  { to: '/', label: 'Dashboard', icon: 'fa-gauge-high', end: true, shortcut: '1' },
  { to: '/aws-accounts', label: 'AWS Accounts', icon: 'fa-brands fa-aws', shortcut: '2' },
  { to: '/projects', label: 'Projects', icon: 'fa-diagram-project', shortcut: '3' }
];

const Layout = ({ children }) => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { toggleTheme } = useTheme();

  // Sidebar collapse state is controlled ONLY via Alt+S - there is
  // intentionally no visible toggle button for it, to keep the rail clean.
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('pm_sidebar_collapsed') === '1');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('pm_sidebar_collapsed', next ? '1' : '0');
      return next;
    });
  }, []);

  const handleLogoutConfirmed = () => {
    logout();
    setShowLogoutConfirm(false);
    navigate('/login');
  };

  useKeyboardShortcuts({
    '1': () => navigate('/'),
    '2': () => navigate('/aws-accounts'),
    '3': () => navigate('/projects'),
    's': toggleCollapsed,
    't': toggleTheme,
    'l': () => setShowLogoutConfirm(true),
    '?': () => setShowShortcuts(true),
    Escape: () => {
      setShowLogoutConfirm(false);
      setShowShortcuts(false);
    }
  });

  return (
    <div className="pms-layout">
      <aside className={`pms-sidebar ${collapsed ? 'pms-sidebar-collapsed' : ''}`}>
        <div className="pms-sidebar-brand">
          <i className="fa-solid fa-cloud-bolt"></i>
          {!collapsed && <span>PM Suite</span>}
        </div>

        <nav className="pms-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `pms-nav-link ${isActive ? 'active' : ''}`}
              title={collapsed ? `${item.label} (Alt+${item.shortcut})` : undefined}
            >
              <i className={item.icon.startsWith('fa-brands') ? item.icon : `fa-solid ${item.icon}`}></i>
              {!collapsed && <span className="pms-nav-label">{item.label}</span>}
              {!collapsed && <span className="pms-nav-shortcut">Alt+{item.shortcut}</span>}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="pms-content-area">
        <Header
          onOpenShortcuts={() => setShowShortcuts(true)}
          onRequestLogout={() => setShowLogoutConfirm(true)}
        />
        <main className="pms-main pms-scroll">{children}</main>
      </div>

      <BottomNav navItems={navItems} />

      {showLogoutConfirm && (
        <LogoutConfirmModal
          onConfirm={handleLogoutConfirmed}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}

      {showShortcuts && <ShortcutsHelpModal onClose={() => setShowShortcuts(false)} />}
    </div>
  );
};

export default Layout;
