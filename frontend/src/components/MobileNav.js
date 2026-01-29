import React from 'react';
import { NavLink } from 'react-router-dom';
import './MobileNav.css';

const MobileNav = () => {
  return (
    <nav className="mobile-nav">
      <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'mobile-nav-link active' : 'mobile-nav-link'} data-testid="mobile-nav-dashboard">
        <i className="icon">📊</i>
        <span>Головна</span>
      </NavLink>
      <NavLink to="/monthly-services" className={({ isActive }) => isActive ? 'mobile-nav-link active' : 'mobile-nav-link'} data-testid="mobile-nav-monthly">
        <i className="icon">📋</i>
        <span>Облік</span>
      </NavLink>
      <NavLink to="/expenses" className={({ isActive }) => isActive ? 'mobile-nav-link active' : 'mobile-nav-link'} data-testid="mobile-nav-expenses">
        <i className="icon">📉</i>
        <span>Витрати</span>
      </NavLink>
      <NavLink to="/services" className={({ isActive }) => isActive ? 'mobile-nav-link active' : 'mobile-nav-link'} data-testid="mobile-nav-services">
        <i className="icon">🏥</i>
        <span>Послуги</span>
      </NavLink>
      <NavLink to="/documents" className={({ isActive }) => isActive ? 'mobile-nav-link active' : 'mobile-nav-link'} data-testid="mobile-nav-documents">
        <i className="icon">📄</i>
        <span>Документи</span>
      </NavLink>
    </nav>
  );
};

export default MobileNav;