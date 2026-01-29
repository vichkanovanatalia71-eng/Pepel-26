import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import Dashboard from './pages/Dashboard';
import Incomes from './pages/Incomes';
import Expenses from './pages/Expenses';
import Documents from './pages/Documents';
import Doctors from './pages/Doctors';
import Services from './pages/Services';
import MonthlyServices from './pages/MonthlyServices';
import Sidebar from './components/Sidebar';
import MobileNav from './components/MobileNav';

function App() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <Router>
      <div className="app">
        {!isMobile && <Sidebar />}
        <main className={`main-content ${!isMobile ? 'with-sidebar' : ''}`}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/incomes" element={<Incomes />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/doctors" element={<Doctors />} />
            <Route path="/services" element={<Services />} />
            <Route path="/monthly-services" element={<MonthlyServices />} />
          </Routes>
        </main>
        {isMobile && <MobileNav />}
      </div>
    </Router>
  );
}

export default App;