import React from 'react';
import { NavLink } from 'react-router-dom';
import './Sidebar.css';

const Sidebar = () => {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo">
          <img src="/logo.svg" alt="ME of Ukraine" className="logo-img" />
          <span className="logo-text">ME of Ukraine</span>
        </div>
      </div>
      
      <nav className="sidebar-nav">
        <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} data-testid="nav-dashboard">
          <i className="icon">📊</i>
          <span>Dashboard</span>
        </NavLink>
        <NavLink to="/monthly-services" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} data-testid="nav-monthly-services">
          <i className="icon">📋</i>
          <span>Облік послуг</span>
        </NavLink>
        <NavLink to="/incomes" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} data-testid="nav-incomes">
          <i className="icon">💰</i>
          <span>Доходи</span>
        </NavLink>
        <NavLink to="/expenses" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} data-testid="nav-expenses">
          <i className="icon">📉</i>
          <span>Витрати</span>
        </NavLink>
        <NavLink to="/doctors" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} data-testid="nav-doctors">
          <i className="icon">👥</i>
          <span>Лікарі</span>
        </NavLink>
        <NavLink to="/services" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} data-testid="nav-services">
          <i className="icon">🏥</i>
          <span>Послуги</span>
        </NavLink>
        <NavLink to="/documents" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} data-testid="nav-documents">
          <i className="icon">📄</i>
          <span>Документи</span>
        </NavLink>
      </nav>
    </aside>
  );
};

export default Sidebar;