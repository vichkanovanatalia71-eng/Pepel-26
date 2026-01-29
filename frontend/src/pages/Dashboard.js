import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Dashboard.css';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/dashboard/stats?month=${currentMonth}&year=${currentYear}`);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  const monthNames = [
    'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
    'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'
  ];

  return (
    <div className="dashboard" data-testid="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1>🏥 ME of Ukraine</h1>
          <p className="subtitle">{monthNames[currentMonth - 1]} {currentYear}</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card income" data-testid="stat-income">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <p className="stat-label">Дохід</p>
            <h2 className="stat-value">{stats?.total_income?.toLocaleString('uk-UA') || 0} ₴</h2>
            <p className="stat-change positive">↗ +15% від минулого</p>
          </div>
        </div>

        <div className="stat-card expense" data-testid="stat-expenses">
          <div className="stat-icon">📉</div>
          <div className="stat-content">
            <p className="stat-label">Витрати</p>
            <h2 className="stat-value">{stats?.total_expenses?.toLocaleString('uk-UA') || 0} ₴</h2>
            <p className="stat-change negative">↘ -5% від минулого</p>
          </div>
        </div>

        <div className="stat-card profit" data-testid="stat-profit">
          <div className="stat-icon">💵</div>
          <div className="stat-content">
            <p className="stat-label">Чистий прибуток</p>
            <h2 className="stat-value">{stats?.net_profit?.toLocaleString('uk-UA') || 0} ₴</h2>
            <p className="stat-change positive">↗ +22% від минулого</p>
          </div>
        </div>

        <div className="stat-card declarations" data-testid="stat-declarations">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <p className="stat-label">Декларації</p>
            <h2 className="stat-value">{stats?.total_declarations || 0}</h2>
            <p className="stat-change positive">↗ +3% від минулого</p>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="card">
          <h3>Швидкі дії</h3>
          <div className="quick-actions">
            <button className="quick-action-btn" data-testid="quick-add-expense">
              <span className="icon">📉</span>
              <span>Додати витрату</span>
            </button>
            <button className="quick-action-btn" data-testid="quick-upload-doc">
              <span className="icon">📄</span>
              <span>Завантажити документ</span>
            </button>
            <button className="quick-action-btn" data-testid="quick-add-service">
              <span className="icon">🏥</span>
              <span>Платна послуга</span>
            </button>
          </div>
        </div>

        <div className="card">
          <h3>Останні операції</h3>
          <div className="recent-operations">
            <p className="empty-state">Операції з'являться після додавання даних</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;