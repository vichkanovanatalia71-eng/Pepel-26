import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import './ShareReport.css';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const ShareReport = () => {
  const { token } = useParams();
  const [reportData, setReportData] = useState(null);
  const [daysLeft, setDaysLeft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const monthNames = [
    'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
    'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'
  ];

  useEffect(() => {
    loadReport();
  }, [token]);

  const loadReport = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/reports/share/${token}`);
      setReportData(response.data.report);
      setDaysLeft(response.data.days_left);
      setLoading(false);
    } catch (error) {
      if (error.response?.status === 410) {
        setError('Термін дії звіту закінчився');
      } else if (error.response?.status === 404) {
        setError('Звіт не знайдено');
      } else {
        setError('Помилка завантаження звіту');
      }
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="share-report-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Завантаження звіту...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="share-report-page">
        <div className="error-container">
          <div className="error-icon">❌</div>
          <h2>{error}</h2>
          <p>Посилання недійсне або термін дії закінчився</p>
        </div>
      </div>
    );
  }

  const data = reportData?.data;

  // Агрегація по місяцях
  const aggregateByMonth = (entries) => {
    const monthlyAggregate = {};
    
    entries.forEach(entry => {
      const monthKey = `${entry.year}-${entry.month}`;
      
      if (!monthlyAggregate[monthKey]) {
        monthlyAggregate[monthKey] = {
          month: entry.month,
          year: entry.year,
          quantity: 0,
          revenue: 0,
          expenses: 0,
          ep: 0,
          vz: 0,
          toDistribute: 0,
          doctorIncome: 0
        };
      }
      
      const ep = entry.total_revenue * 0.05;
      const vz = entry.total_revenue * 0.01;
      const toDistribute = entry.total_revenue - entry.total_expenses - ep - vz;
      
      monthlyAggregate[monthKey].quantity += entry.quantity;
      monthlyAggregate[monthKey].revenue += entry.total_revenue;
      monthlyAggregate[monthKey].expenses += entry.total_expenses;
      monthlyAggregate[monthKey].ep += ep;
      monthlyAggregate[monthKey].vz += vz;
      monthlyAggregate[monthKey].toDistribute += toDistribute;
      monthlyAggregate[monthKey].doctorIncome += entry.doctor_income;
    });
    
    return Object.values(monthlyAggregate).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
  };

  const monthlyData = aggregateByMonth(data.entries);

  return (
    <div className="share-report-page">
      {/* Header */}
      <div className="share-header">
        <div className="share-logo">
          <img src="/logo.svg" alt="ME of Ukraine" />
          <span>ME of Ukraine</span>
        </div>
        <div className="share-expiry">
          <span className="expiry-label">Доступно ще:</span>
          <span className="expiry-days">{daysLeft} днів</span>
        </div>
      </div>

      {/* Title */}
      <div className="share-title">
        <h1>{data.title}</h1>
        <p className="share-subtitle">
          Згенеровано: {new Date(reportData.created_at).toLocaleDateString('uk-UA')}
        </p>
      </div>

      {/* Stats Cards - Read only */}
      <div className="share-stats">
        {monthlyData.reduce((sum, m) => sum + m.revenue, 0) > 0 && (
          <>
            <div className="share-stat-card">
              <div className="stat-icon">💰</div>
              <div>
                <div className="stat-label">Сума послуг</div>
                <div className="stat-value">
                  {monthlyData.reduce((sum, m) => sum + m.revenue, 0).toLocaleString('uk-UA')} ₴
                </div>
              </div>
            </div>
            <div className="share-stat-card">
              <div className="stat-icon">📉</div>
              <div>
                <div className="stat-label">Витрати</div>
                <div className="stat-value">
                  {monthlyData.reduce((sum, m) => sum + m.expenses, 0).toLocaleString('uk-UA')} ₴
                </div>
              </div>
            </div>
            <div className="share-stat-card highlight">
              <div className="stat-icon">👨‍⚕️</div>
              <div>
                <div className="stat-label">Дохід лікаря</div>
                <div className="stat-value">
                  {monthlyData.reduce((sum, m) => sum + m.doctorIncome, 0).toLocaleString('uk-UA')} ₴
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Table */}
      <div className="share-table-section">
        <h3>Детальна інформація</h3>
        <div className="table-wrapper">
          <table className="share-table">
            <thead>
              <tr>
                <th>Місяць</th>
                <th>К-ть</th>
                <th>Сума</th>
                <th>Витрати</th>
                <th>ЄП (5%)</th>
                <th>ВЗ (1%)</th>
                <th>До розподілу</th>
                <th>Дохід</th>
              </tr>
            </thead>
            <tbody>
              {monthlyData.map(m => (
                <tr key={`${m.year}-${m.month}`}>
                  <td><strong>{monthNames[m.month - 1]} {m.year}</strong></td>
                  <td>{m.quantity}</td>
                  <td className="revenue-cell">{m.revenue.toLocaleString('uk-UA')} ₴</td>
                  <td>{m.expenses.toLocaleString('uk-UA')} ₴</td>
                  <td>{m.ep.toLocaleString('uk-UA')} ₴</td>
                  <td>{m.vz.toLocaleString('uk-UA')} ₴</td>
                  <td className="highlight-cell">{m.toDistribute.toLocaleString('uk-UA')} ₴</td>
                  <td className="income-cell"><strong>{m.doctorIncome.toLocaleString('uk-UA')} ₴</strong></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td><strong>ВСЬОГО:</strong></td>
                <td><strong>{monthlyData.reduce((s, m) => s + m.quantity, 0)}</strong></td>
                <td className="revenue-cell"><strong>{monthlyData.reduce((s, m) => s + m.revenue, 0).toLocaleString('uk-UA')} ₴</strong></td>
                <td><strong>{monthlyData.reduce((s, m) => s + m.expenses, 0).toLocaleString('uk-UA')} ₴</strong></td>
                <td><strong>{monthlyData.reduce((s, m) => s + m.ep, 0).toLocaleString('uk-UA')} ₴</strong></td>
                <td><strong>{monthlyData.reduce((s, m) => s + m.vz, 0).toLocaleString('uk-UA')} ₴</strong></td>
                <td className="highlight-cell"><strong>{monthlyData.reduce((s, m) => s + m.toDistribute, 0).toLocaleString('uk-UA')} ₴</strong></td>
                <td className="income-cell"><strong>{monthlyData.reduce((s, m) => s + m.doctorIncome, 0).toLocaleString('uk-UA')} ₴</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="share-footer">
        <p>ME of Ukraine MedTrack</p>
        <p>Згенеровано: {new Date(reportData.created_at).toLocaleString('uk-UA')}</p>
        <p className="expiry-warning">Звіт буде доступний до {new Date(reportData.expires_at).toLocaleDateString('uk-UA')}</p>
      </div>
    </div>
  );
};

export default ShareReport;
