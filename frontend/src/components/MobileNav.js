import React from 'react';
import { NavLink } from 'react-router-dom';
import './MobileNav.css';

const MobileNav = () => {
  return (
    <nav className="mobile-nav">
      <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'mobile-nav-link active' : 'mobile-nav-link'} data-testid="mobile-nav-dashboard">
        <i className="icon">📊</i>
        <span>Dashboard</span>
      </NavLink>
      <NavLink to="/incomes" className={({ isActive }) => isActive ? 'mobile-nav-link active' : 'mobile-nav-link'} data-testid="mobile-nav-incomes">
        <i className="icon">💰</i>
        <span>Доходи</span>
      </NavLink>
      <NavLink to="/documents" className={({ isActive }) => isActive ? 'mobile-nav-link active' : 'mobile-nav-link'} data-testid="mobile-nav-documents">
        <i className="icon">📄</i>
        <span>Документи</span>
      </NavLink>
      <NavLink to="/doctors" className={({ isActive }) => isActive ? 'mobile-nav-link active' : 'mobile-nav-link'} data-testid="mobile-nav-doctors">
        <i className="icon">👥</i>
        <span>Лікарі</span>
      </NavLink>
    </nav>
  );
};

export default MobileNav;