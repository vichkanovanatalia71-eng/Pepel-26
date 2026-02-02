import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import './ShareReport.css';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const COLORS = ['#FF8C00', '#FFA500', '#10B981', '#A78BFA', '#EF4444', '#3B82F6'];

const ShareReport = () => {
  const { token } = useParams();
  const [reportData, setReportData] = useState(null);
  const [daysLeft, setDaysLeft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showOverviewChart, setShowOverviewChart] = useState(false);
  const [activeTab, setActiveTab] = useState(null);

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
        setError('Помилка завантаження');
      }
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="share-report-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Завантаження...</p>
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
        </div>
      </div>
    );
  }

  const data = reportData?.data;

  // Групування по лікарях
  const groupByDoctor = () => {
    const byDoctor = {};
    
    data.entries.forEach(entry => {
      const doctor = data.doctors.find(d => d.id === entry.doctor_id);
      if (!byDoctor[entry.doctor_id]) {
        byDoctor[entry.doctor_id] = {
          doctor_id: entry.doctor_id,
          name: doctor?.name || 'N/A',
          short_name: doctor?.short_name || 'N/A',
          months: {}
        };
      }
      
      const monthKey = `${entry.year}-${entry.month}`;
      if (!byDoctor[entry.doctor_id].months[monthKey]) {
        byDoctor[entry.doctor_id].months[monthKey] = {
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
      
      byDoctor[entry.doctor_id].months[monthKey].quantity += entry.quantity;
      byDoctor[entry.doctor_id].months[monthKey].revenue += entry.total_revenue;
      byDoctor[entry.doctor_id].months[monthKey].expenses += entry.total_expenses;
      byDoctor[entry.doctor_id].months[monthKey].ep += ep;
      byDoctor[entry.doctor_id].months[monthKey].vz += vz;
      byDoctor[entry.doctor_id].months[monthKey].toDistribute += toDistribute;
      byDoctor[entry.doctor_id].months[monthKey].doctorIncome += entry.doctor_income;
    });
    
    return Object.values(byDoctor).map(doc => ({
      ...doc,
      monthsArray: Object.values(doc.months).sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      }),
      total: Object.values(doc.months).reduce((acc, m) => ({
        quantity: acc.quantity + m.quantity,
        revenue: acc.revenue + m.revenue,
        expenses: acc.expenses + m.expenses,
        ep: acc.ep + m.ep,
        vz: acc.vz + m.vz,
        toDistribute: acc.toDistribute + m.toDistribute,
        doctorIncome: acc.doctorIncome + m.doctorIncome
      }), { quantity: 0, revenue: 0, expenses: 0, ep: 0, vz: 0, toDistribute: 0, doctorIncome: 0 })
    }));
  };

  const doctorsData = groupByDoctor();

  // Встановити початковий activeTab
  useEffect(() => {
    if (doctorsData.length > 0 && !activeTab) {
      setActiveTab(doctorsData[0].doctor_id);
    }
  }, [doctorsData, activeTab]);

  // Данні для charts
  const getExpensesChartData = (doctorData) => [
    { name: 'Витрати', value: doctorData.total.expenses, color: '#EF4444' },
    { name: 'ЄП (5%)', value: doctorData.total.ep, color: '#FF8C00' },
    { name: 'ВЗ (1%)', value: doctorData.total.vz, color: '#FFA500' }
  ];

  const getMonthlyChartData = (doctorData) =>
    doctorData.monthsArray.map((m, i) => ({
      name: monthNames[m.month - 1],
      value: m.doctorIncome,
      color: COLORS[i % COLORS.length]
    }));

  return (
    <div className="share-report-page">
      {/* Header */}
      <div className="share-header">
        <div className="share-logo">
          <img src="/logo.svg" alt="ME" />
          <span>ME of Ukraine</span>
        </div>
        <div className="share-expiry">
          <span className="expiry-label">Доступно:</span>
          <span className="expiry-days">{daysLeft}д</span>
        </div>
      </div>

      {/* Title */}
      <div className="share-title">
        <h1>{data.title}</h1>
        <p>{new Date(reportData.created_at).toLocaleDateString('uk-UA')}</p>
      </div>

      {/* Tabs по лікарях */}
      {doctorsData.length > 1 ? (
        <Tabs defaultValue={doctorsData[0].doctor_id} className="doctor-tabs">
          <TabsList className="tabs-list-share">
            {doctorsData.map(doc => (
              <TabsTrigger key={doc.doctor_id} value={doc.doctor_id}>
                {doc.short_name}
              </TabsTrigger>
            ))}
          </TabsList>
          
          {doctorsData.map(doc => (
            <TabsContent key={doc.doctor_id} value={doc.doctor_id}>
              {renderDoctorContent(doc)}
            </TabsContent>
          ))}
        </Tabs>
      ) : doctorsData.length === 1 ? (
        renderDoctorContent(doctorsData[0])
      ) : null}

      {/* Footer */}
      <div className="share-footer">
        <p>ME of Ukraine MedTrack</p>
        <p className="expiry-warning">
          Доступний до {new Date(reportData.expires_at).toLocaleDateString('uk-UA')}
        </p>
      </div>
    </div>
  );

  function renderDoctorContent(doctorData) {
    const expensesData = getExpensesChartData(doctorData);
    const monthlyData = getMonthlyChartData(doctorData);
    
    return (
      <div className="doctor-content">
        {/* Stats Grid */}
        <div className="share-stats-compact">
          <div className="stat-mini">
            <div className="stat-mini-label">Сума</div>
            <div className="stat-mini-value">{doctorData.total.revenue.toLocaleString('uk-UA')} ₴</div>
          </div>
          <div className="stat-mini">
            <div className="stat-mini-label">К-ть</div>
            <div className="stat-mini-value">{doctorData.total.quantity}</div>
          </div>
          <div className="stat-mini highlight-stat">
            <div className="stat-mini-label">Дохід</div>
            <div className="stat-mini-value">{doctorData.total.doctorIncome.toLocaleString('uk-UA')} ₴</div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="charts-row">
          {/* Pie: Витрати або Загальний */}
          <div className="chart-card">
            <div className="chart-header">
              <h4>{showOverviewChart ? 'Загальна картина' : 'Витрати та податки'}</h4>
              <button 
                className="btn-toggle-chart"
                onClick={() => setShowOverviewChart(!showOverviewChart)}
              >
                {showOverviewChart ? '💸 Витрати' : '📊 Загальне'}
              </button>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={showOverviewChart ? [
                    { name: 'Дохід лікаря', value: doctorData.total.doctorIncome, color: '#A78BFA' },
                    { name: 'Витрати', value: doctorData.total.expenses, color: '#EF4444' },
                    { name: 'ЄП', value: doctorData.total.ep, color: '#FF8C00' },
                    { name: 'ВЗ', value: doctorData.total.vz, color: '#FFA500' }
                  ] : expensesData}
                  cx="50%"
                  cy="50%"
                  innerRadius={showOverviewChart ? 0 : 50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {(showOverviewChart ? 
                    [
                      { name: 'Дохід лікаря', value: doctorData.total.doctorIncome, color: '#A78BFA' },
                      { name: 'Витрати', value: doctorData.total.expenses, color: '#EF4444' },
                      { name: 'ЄП', value: doctorData.total.ep, color: '#FF8C00' },
                      { name: 'ВЗ', value: doctorData.total.vz, color: '#FFA500' }
                    ] : expensesData
                  ).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value.toLocaleString('uk-UA')} ₴`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Pie: Дохід по місяцях */}
          {monthlyData.length > 1 && (
            <div className="chart-card">
              <h4>Дохід по місяцях</h4>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={monthlyData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                  >
                    {monthlyData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value.toLocaleString('uk-UA')} ₴`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="share-table-section">
          <div className="table-wrapper-compact">
            <table className="share-table">
              <thead>
                <tr>
                  <th>Місяць</th>
                  <th>К-ть</th>
                  <th>Сума</th>
                  <th>Витрати</th>
                  <th>ЄП</th>
                  <th>ВЗ</th>
                  <th>До розподілу</th>
                  <th>Дохід</th>
                </tr>
              </thead>
              <tbody>
                {doctorData.monthsArray.map(m => (
                  <tr key={`${m.year}-${m.month}`}>
                    <td><strong>{monthNames[m.month - 1]}</strong></td>
                    <td>{m.quantity}</td>
                    <td className="revenue-cell">{m.revenue.toLocaleString('uk-UA')}</td>
                    <td>{m.expenses.toLocaleString('uk-UA')}</td>
                    <td>{m.ep.toLocaleString('uk-UA')}</td>
                    <td>{m.vz.toLocaleString('uk-UA')}</td>
                    <td className="highlight-cell">{m.toDistribute.toLocaleString('uk-UA')}</td>
                    <td className="income-cell"><strong>{m.doctorIncome.toLocaleString('uk-UA')}</strong></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td><strong>ВСЬОГО:</strong></td>
                  <td><strong>{doctorData.total.quantity}</strong></td>
                  <td className="revenue-cell"><strong>{doctorData.total.revenue.toLocaleString('uk-UA')}</strong></td>
                  <td><strong>{doctorData.total.expenses.toLocaleString('uk-UA')}</strong></td>
                  <td><strong>{doctorData.total.ep.toLocaleString('uk-UA')}</strong></td>
                  <td><strong>{doctorData.total.vz.toLocaleString('uk-UA')}</strong></td>
                  <td className="highlight-cell"><strong>{doctorData.total.toDistribute.toLocaleString('uk-UA')}</strong></td>
                  <td className="income-cell"><strong>{doctorData.total.doctorIncome.toLocaleString('uk-UA')}</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    );
  }
};

export default ShareReport;
