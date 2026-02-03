import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import './App.css';
import Dashboard from './pages/Dashboard';
import PMGIncome from './pages/PMGIncome';
import Expenses from './pages/Expenses';
import Documents from './pages/Documents';
import Doctors from './pages/Doctors';
import Services from './pages/Services';
import PMGSettings from './pages/PMGSettings';
import MonthlyServices from './pages/MonthlyServices';
import ShareReport from './pages/ShareReport';
import Sidebar from './components/Sidebar';
import MobileNav from './components/MobileNav';

function AppContent() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const location = useLocation();
  const isSharePage = location.pathname.startsWith('/share');

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="app">
      {!isSharePage && !isMobile && <Sidebar />}
      <main className={`main-content ${!isSharePage && !isMobile ? 'with-sidebar' : ''}`}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/incomes" element={<PMGIncome />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/doctors" element={<Doctors />} />
          <Route path="/services" element={<Services />} />
          <Route path="/monthly-services" element={<MonthlyServices />} />
          <Route path="/share/:token" element={<ShareReport />} />
        </Routes>
      </main>
      {!isSharePage && isMobile && <MobileNav />}
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;