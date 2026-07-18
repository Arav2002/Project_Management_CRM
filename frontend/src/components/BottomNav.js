import React from 'react';
import { NavLink } from 'react-router-dom';
import '../styles/bottomnav.css';

const BottomNav = ({ navItems }) => (
  <nav className="pms-bottom-nav">
    {navItems.map((item) => (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.end}
        className={({ isActive }) => `pms-bottom-nav-link ${isActive ? 'active' : ''}`}
        title={item.label}
      >
        <i className={item.icon.startsWith('fa-brands') ? item.icon : `fa-solid ${item.icon}`}></i>
      </NavLink>
    ))}
  </nav>
);

export default BottomNav;
