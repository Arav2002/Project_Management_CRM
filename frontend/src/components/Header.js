import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import '../styles/header.css';

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/aws-accounts': 'AWS Accounts',
  '/projects': 'Projects'
};

const Header = ({ onOpenShortcuts, onRequestLogout }) => {
  const location = useLocation();
  const { email } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const pageTitle = PAGE_TITLES[location.pathname] || 'Project Management Suite';
  const initials = (email || '?').trim().slice(0, 2).toUpperCase();

  return (
    <header className="pms-header">
      <div className="pms-header-left">
        <h1 className="pms-header-title">{pageTitle}</h1>
      </div>

      <div className="pms-header-right">
        <button
          type="button"
          className="pms-header-icon-btn"
          onClick={onOpenShortcuts}
          title="Keyboard shortcuts (Shift + ?)"
        >
          <i className="fa-solid fa-keyboard"></i>
        </button>

        <button
          type="button"
          className="pms-header-icon-btn"
          onClick={toggleTheme}
          title={`${theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} (Alt+T)`}
        >
          <i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
        </button>

        <div className="pms-header-divider"></div>

        <div className="pms-header-profile" title={email}>
          <div className="pms-header-avatar">{initials}</div>
          <span className="pms-header-email">{email}</span>
        </div>

        <button
          type="button"
          className="pms-header-icon-btn pms-header-logout-btn"
          onClick={onRequestLogout}
          title="Log out (Alt+L)"
        >
          <i className="fa-solid fa-right-from-bracket"></i>
        </button>
      </div>
    </header>
  );
};

export default Header;
