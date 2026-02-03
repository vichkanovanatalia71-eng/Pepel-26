import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import './MobileNav.css';

const MobileNav = () => {
  const location = useLocation();
  const [showMore, setShowMore] = useState(false);
  
  const isSettingsActive = location.pathname === '/services' || location.pathname === '/doctors';

  return (
    <>
      <nav className="mobile-nav">
        <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'mobile-nav-link active' : 'mobile-nav-link'} data-testid="mobile-nav-dashboard">
          <i className="icon">📊</i>
          <span>Головна</span>
        </NavLink>
        <NavLink to="/monthly-services" className={({ isActive }) => isActive ? 'mobile-nav-link active' : 'mobile-nav-link'} data-testid="mobile-nav-monthly">
          <i className="icon">💳</i>
          <span>Платні</span>
        </NavLink>
        <NavLink to="/expenses" className={({ isActive }) => isActive ? 'mobile-nav-link active' : 'mobile-nav-link'} data-testid="mobile-nav-expenses">
          <i className="icon">📉</i>
          <span>Витрати</span>
        </NavLink>
        <NavLink to="/documents" className={({ isActive }) => isActive ? 'mobile-nav-link active' : 'mobile-nav-link'} data-testid="mobile-nav-documents">
          <i className="icon">📄</i>
          <span>Документи</span>
        </NavLink>
        <button 
          className={`mobile-nav-link ${showMore || isSettingsActive ? 'active' : ''}`}
          onClick={() => setShowMore(!showMore)}
          data-testid="mobile-nav-more"
        >
          <i className="icon">⚙️</i>
          <span>Ще</span>
        </button>
      </nav>

      {/* More menu popup */}
      {showMore && (
        <div className="mobile-more-menu">
          <div className="mobile-more-overlay" onClick={() => setShowMore(false)} />
          <div className="mobile-more-content">
            <div className="mobile-more-header">
              <h3>Налаштування</h3>
              <button className="mobile-more-close" onClick={() => setShowMore(false)}>✕</button>
            </div>
            <NavLink 
              to="/services" 
              className={({ isActive }) => isActive ? 'mobile-more-link active' : 'mobile-more-link'}
              onClick={() => setShowMore(false)}
            >
              <i className="icon">🏥</i>
              <span>Послуги</span>
            </NavLink>
            <NavLink 
              to="/doctors" 
              className={({ isActive }) => isActive ? 'mobile-more-link active' : 'mobile-more-link'}
              onClick={() => setShowMore(false)}
            >
              <i className="icon">👥</i>
              <span>Лікарі</span>
            </NavLink>
            <NavLink 
              to="/incomes" 
              className={({ isActive }) => isActive ? 'mobile-more-link active' : 'mobile-more-link'}
              onClick={() => setShowMore(false)}
            >
              <i className="icon">💰</i>
              <span>Доходи</span>
            </NavLink>
          </div>
        </div>
      )}
    </>
  );
};

export default MobileNav;
