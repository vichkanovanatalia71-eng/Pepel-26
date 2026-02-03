import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import './Sidebar.css';

const Sidebar = () => {
  const location = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(
    location.pathname === '/services' || location.pathname === '/doctors' || location.pathname === '/pmg-settings'
  );

  const isSettingsActive = location.pathname === '/services' || location.pathname === '/doctors' || location.pathname === '/pmg-settings';

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
          <i className="icon">💳</i>
          <span>Платні послуги</span>
        </NavLink>
        <NavLink to="/incomes" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} data-testid="nav-incomes">
          <i className="icon">💰</i>
          <span>Дохід за ПМГ</span>
        </NavLink>
        <NavLink to="/expenses" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} data-testid="nav-expenses">
          <i className="icon">📉</i>
          <span>Витрати</span>
        </NavLink>
        <NavLink to="/documents" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} data-testid="nav-documents">
          <i className="icon">📄</i>
          <span>Документи</span>
        </NavLink>

        {/* Settings section with submenu */}
        <div className="nav-section">
          <button 
            className={`nav-link nav-section-header ${isSettingsActive ? 'active' : ''}`}
            onClick={() => setSettingsOpen(!settingsOpen)}
            data-testid="nav-settings"
          >
            <i className="icon">⚙️</i>
            <span>Налаштування</span>
            <i className={`chevron ${settingsOpen ? 'open' : ''}`}>▼</i>
          </button>
          
          {settingsOpen && (
            <div className="nav-submenu">
              <NavLink 
                to="/services" 
                className={({ isActive }) => isActive ? 'nav-link sub-link active' : 'nav-link sub-link'} 
                data-testid="nav-services"
              >
                <i className="icon">🏥</i>
                <span>Послуги</span>
              </NavLink>
              <NavLink 
                to="/doctors" 
                className={({ isActive }) => isActive ? 'nav-link sub-link active' : 'nav-link sub-link'} 
                data-testid="nav-doctors"
              >
                <i className="icon">👥</i>
                <span>Лікарі</span>
              </NavLink>
              <NavLink 
                to="/pmg-settings" 
                className={({ isActive }) => isActive ? 'nav-link sub-link active' : 'nav-link sub-link'} 
                data-testid="nav-pmg-settings"
              >
                <i className="icon">📊</i>
                <span>Капітація та коефіцієнти</span>
              </NavLink>
            </div>
          )}
        </div>
      </nav>
    </aside>
  );
};

export default Sidebar;
