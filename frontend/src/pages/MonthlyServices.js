import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import './MonthlyServices.css';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const MonthlyServices = () => {
  const [services, setServices] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [allEntries, setAllEntries] = useState([]);
  const [filteredEntries, setFilteredEntries] = useState([]);
  const [dashboardStats, setDashboardStats] = useState(null);
  
  // Фільтри (всі працюють одночасно)
  const [selectedDoctor, setSelectedDoctor] = useState('all'); // 'all' | doctor_id
  const [selectedYear, setSelectedYear] = useState('all'); // 'all' | year
  const [selectedMonth, setSelectedMonth] = useState('all'); // 'all' | month
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRevenueModal, setShowRevenueModal] = useState(false);
  const [modalDoctor, setModalDoctor] = useState('');
  const [modalMonth, setModalMonth] = useState(new Date().getMonth() + 1);
  const [modalYear, setModalYear] = useState(new Date().getFullYear());
  const [quantities, setQuantities] = useState({});
  const [revenueDetails, setRevenueDetails] = useState(null);

  useEffect(() => {
    fetchServices();
    fetchDoctors();
    fetchAllEntries();
  }, []);

  useEffect(() => {
    if (allEntries.length > 0) {
      filterData();
    }
  }, [selectedDoctor, selectedYear, selectedMonth, allEntries]);

  const fetchServices = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/services`);
      setServices(response.data.sort((a, b) => (a.code || '').localeCompare(b.code || '')));
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchDoctors = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/doctors`);
      setDoctors(response.data);
      if (response.data.length > 0) {
        setModalDoctor(response.data[0].id);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchAllEntries = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/monthly-services`);
      const sorted = response.data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setAllEntries(sorted);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const filterData = () => {
    let filtered = [...allEntries];
    
    // Фільтр за лікарем
    if (selectedDoctor !== 'all') {
      filtered = filtered.filter(e => e.doctor_id === selectedDoctor);
    }
    
    // Фільтр за роком
    if (selectedYear !== 'all') {
      filtered = filtered.filter(e => e.year === selectedYear);
    }
    
    // Фільтр за місяцем
    if (selectedMonth !== 'all') {
      filtered = filtered.filter(e => e.month === selectedMonth);
    }
    
    setFilteredEntries(filtered);
    
    // Розрахунок dashboard
    const stats = {
      total_revenue: filtered.reduce((sum, e) => sum + (e.total_revenue || 0), 0),
      total_doctor_income: filtered.reduce((sum, e) => sum + (e.doctor_income || 0), 0),
      total_expenses: filtered.reduce((sum, e) => sum + (e.total_expenses || 0), 0),
      total_fop_income: filtered.reduce((sum, e) => sum + (e.fop_income || 0), 0),
      total_quantity: filtered.reduce((sum, e) => sum + (e.quantity || 0), 0),
      total_services: filtered.length
    };
    
    setDashboardStats(stats);
  };

  const handleBulkAdd = async () => {
    try {
      const entries = Object.entries(quantities)
        .filter(([_, qty]) => qty > 0)
        .map(([serviceId, qty]) => ({
          month: modalMonth,
          year: modalYear,
          service_id: serviceId,
          doctor_id: modalDoctor,
          quantity: parseInt(qty)
        }));
      
      if (entries.length === 0) {
        alert('Вкажіть кількість хоча б для однієї послуги');
        return;
      }
      
      for (const entry of entries) {
        await axios.post(`${API_URL}/api/monthly-services`, entry);
      }
      
      setQuantities({});
      setShowAddModal(false);
      fetchAllEntries();
    } catch (error) {
      console.error('Error:', error);
      alert('Помилка збереження');
    }
  };

  const handleDeleteEntry = async (entryId) => {
    if (window.confirm('Видалити цей запис?')) {
      try {
        await axios.delete(`${API_URL}/api/monthly-services/${entryId}`);
        fetchAllEntries();
      } catch (error) {
        console.error('Error:', error);
      }
    }
  };

  const openRevenueDetails = async () => {
    // Розрахунок детальної статистики по обороту
    const serviceBreakdown = {};
    const doctorBreakdown = {};
    const monthlyBreakdown = {};
    
    filteredEntries.forEach(entry => {
      const service = services.find(s => s.id === entry.service_id);
      const doctor = doctors.find(d => d.id === entry.doctor_id);
      
      // По послугах
      if (!serviceBreakdown[entry.service_id]) {
        serviceBreakdown[entry.service_id] = {
          code: service?.code || 'N/A',
          name: service?.name || 'N/A',
          price: service?.price || 0,
          quantity: 0,
          revenue: 0
        };
      }
      serviceBreakdown[entry.service_id].quantity += entry.quantity;
      serviceBreakdown[entry.service_id].revenue += entry.total_revenue;
      
      // По лікарях
      if (!doctorBreakdown[entry.doctor_id]) {
        doctorBreakdown[entry.doctor_id] = {
          name: doctor?.name || 'N/A',
          short_name: doctor?.short_name || 'N/A',
          revenue: 0,
          quantity: 0
        };
      }
      doctorBreakdown[entry.doctor_id].revenue += entry.total_revenue;
      doctorBreakdown[entry.doctor_id].quantity += entry.quantity;
      
      // По місяцях
      const monthKey = `${entry.year}-${entry.month}`;
      if (!monthlyBreakdown[monthKey]) {
        monthlyBreakdown[monthKey] = {
          month: entry.month,
          year: entry.year,
          revenue: 0
        };
      }
      monthlyBreakdown[monthKey].revenue += entry.total_revenue;
    });
    
    // Сортування
    const servicesArray = Object.values(serviceBreakdown).sort((a, b) => b.revenue - a.revenue);
    const top5Services = servicesArray.slice(0, 5);
    const topByQuantity = [...servicesArray].sort((a, b) => b.quantity - a.quantity).slice(0, 5);
    const doctorsArray = Object.values(doctorBreakdown);
    const monthlyArray = Object.values(monthlyBreakdown).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
    
    // Середній чек
    const avgCheck = dashboardStats.total_revenue / dashboardStats.total_quantity;
    
    // Порівняння з минулим періодом
    let comparison = null;
    if (monthlyArray.length >= 2) {
      const current = monthlyArray[monthlyArray.length - 1].revenue;
      const previous = monthlyArray[monthlyArray.length - 2].revenue;
      const change = ((current - previous) / previous) * 100;
      comparison = {
        current,
        previous,
        change,
        trend: change > 0 ? 'up' : 'down'
      };
    }
    
    // Отримати AI інсайти та прогноз
    try {
      const aiResponse = await axios.post(`${API_URL}/api/analytics/revenue-insights`, {
        services: servicesArray,
        doctors: doctorsArray,
        monthly: monthlyArray,
        stats: dashboardStats
      });
      
      setRevenueDetails({
        servicesBreakdown: servicesArray,
        top5Services,
        topByQuantity,
        doctorsBreakdown: doctorsArray,
        monthlyBreakdown: monthlyArray,
        avgCheck,
        comparison,
        aiInsights: aiResponse.data.insights,
        forecast: aiResponse.data.forecast
      });
    } catch (error) {
      console.error('AI analysis error:', error);
      // Без AI (fallback)
      setRevenueDetails({
        servicesBreakdown: servicesArray,
        top5Services,
        topByQuantity,
        doctorsBreakdown: doctorsArray,
        monthlyBreakdown: monthlyArray,
        avgCheck,
        comparison,
        aiInsights: null,
        forecast: null
      });
    }
    
    setShowRevenueModal(true);
  };

  const resetFilters = () => {
    setSelectedDoctor('all');
    setSelectedYear('all');
    setSelectedMonth('all');
  };

  const exportToExcel = () => {
    if (!revenueDetails) return;
    
    // Створення CSV (простий експорт)
    let csv = 'Код,Назва послуги,Ціна,Кількість,Оборот,%\n';
    revenueDetails.servicesBreakdown.forEach(service => {
      const percent = ((service.revenue / dashboardStats.total_revenue) * 100).toFixed(1);
      csv += `${service.code},"${service.name}",${service.price},${service.quantity},${service.revenue},${percent}%\n`;
    });
    
    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Оборот_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const exportToPDF = () => {
    alert('PDF експорт в розробці. Використовуйте Excel експорт.');
  };

  const monthNames = [
    'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
    'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'
  ];

  // Отримати доступні роки
  const availableYears = [...new Set(allEntries.map(e => e.year))].sort((a, b) => b - a);

  // Отримати доступні місяці для вибраного року (або всіх років якщо 'all')
  const getAvailableMonths = () => {
    const monthsSet = new Set();
    const entries = selectedYear === 'all' 
      ? allEntries 
      : allEntries.filter(e => e.year === selectedYear);
    
    entries.forEach(e => monthsSet.add(e.month));
    return Array.from(monthsSet).sort((a, b) => a - b);
  };

  const hasActiveFilters = selectedDoctor !== 'all' || selectedYear !== 'all' || selectedMonth !== 'all';

  return (
    <div className="monthly-services-page" data-testid="monthly-services-page">
      <div className="page-header">
        <h1>📊 Облік послуг</h1>
        <button 
          className="btn btn-primary" 
          onClick={() => setShowAddModal(true)} 
          data-testid="add-services-btn"
        >
          + Додати послуги
        </button>
      </div>

      {/* Фільтри - всі одночасно */}
      <div className="filters-panel">
        <div className="filters-header">
          <h3>Фільтри</h3>
          {hasActiveFilters && (
            <button className="btn-reset-filters" onClick={resetFilters} data-testid="reset-filters-btn">
              ✕ Скинути все
            </button>
          )}
        </div>

        {/* Фільтр: Лікар */}
        <div className="filter-section">
          <label className="filter-label">👨‍⚕️ Лікар:</label>
          <div className="chips-group">
            <button 
              className={`chip ${selectedDoctor === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedDoctor('all')}
              data-testid="chip-doctor-all"
            >
              Всі
            </button>
            {doctors.map(doc => (
              <button
                key={doc.id}
                className={`chip ${selectedDoctor === doc.id ? 'active' : ''}`}
                onClick={() => setSelectedDoctor(doc.id)}
                data-testid={`chip-doctor-${doc.id}`}
              >
                <span className="chip-full-name">{doc.name}</span>
                <span className="chip-short-name">{doc.short_name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Фільтр: Рік */}
        <div className="filter-section">
          <label className="filter-label">📅 Рік:</label>
          <div className="chips-group">
            <button 
              className={`chip ${selectedYear === 'all' ? 'active' : ''}`}
              onClick={() => {
                setSelectedYear('all');
                setSelectedMonth('all');
              }}
              data-testid="chip-year-all"
            >
              Весь період
            </button>
            {availableYears.map(year => (
              <button
                key={year}
                className={`chip ${selectedYear === year ? 'active' : ''}`}
                onClick={() => setSelectedYear(year)}
                data-testid={`chip-year-${year}`}
              >
                {year}
              </button>
            ))}
          </div>
        </div>

        {/* Фільтр: Місяць (показується якщо обрано рік) */}
        {selectedYear !== 'all' && (
          <div className="filter-section">
            <label className="filter-label">📆 Місяць:</label>
            <div className="chips-group chips-scrollable">
              <button 
                className={`chip ${selectedMonth === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedMonth('all')}
                data-testid="chip-month-all"
              >
                Весь рік
              </button>
              {getAvailableMonths().map((monthNum) => (
                <button
                  key={monthNum}
                  className={`chip ${selectedMonth === monthNum ? 'active' : ''}`}
                  onClick={() => setSelectedMonth(monthNum)}
                  data-testid={`chip-month-${monthNum}`}
                >
                  {monthNames[monthNum - 1]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Dashboard Statistics */}
      {dashboardStats && (
        <div className="summary-cards">
          <div 
            className="summary-card clickable" 
            onClick={openRevenueDetails}
            data-testid="revenue-card"
          >
            <div className="summary-icon">💰</div>
            <div>
              <div className="summary-label">Оборот</div>
              <div className="summary-value">{dashboardStats.total_revenue.toLocaleString('uk-UA')} ₴</div>
              <div className="summary-count">{dashboardStats.total_quantity} послуг</div>
            </div>
            <div className="card-click-hint">👁️</div>
          </div>
          <div className="summary-card">
            <div className="summary-icon">👨‍⚕️</div>
            <div>
              <div className="summary-label">Дохід лікарів</div>
              <div className="summary-value">{dashboardStats.total_doctor_income.toLocaleString('uk-UA')} ₴</div>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-icon">📉</div>
            <div>
              <div className="summary-label">Витрати</div>
              <div className="summary-value">{dashboardStats.total_expenses.toLocaleString('uk-UA')} ₴</div>
            </div>
          </div>
          <div className="summary-card highlight">
            <div className="summary-icon">💵</div>
            <div>
              <div className="summary-label">Дохід організації</div>
              <div className="summary-value">{dashboardStats.total_fop_income.toLocaleString('uk-UA')} ₴</div>
            </div>
          </div>
        </div>
      )}

      {/* Список наданих послуг */}
      <div className="card">
        <h3>Надані послуги ({filteredEntries.length})</h3>
        {filteredEntries.length === 0 ? (
          <div className="empty-state">
            <p>Записів за обраними фільтрами не знайдено</p>
            <p className="empty-hint">Спробуйте змінити фільтри або додати нові послуги</p>
          </div>
        ) : (
          <div className="entries-list">
            {filteredEntries.map(entry => {
              const service = services.find(s => s.id === entry.service_id);
              const doctor = doctors.find(d => d.id === entry.doctor_id);
              return (
                <div key={entry.id} className="entry-card" data-testid={`entry-${entry.id}`}>
                  <div className="entry-header">
                    <div className="entry-service">
                      {service?.code && <span className="service-code-small">{service.code}</span>}
                      <span className="service-name">{service?.name || 'N/A'}</span>
                    </div>
                    <button 
                      className="btn-delete-entry" 
                      onClick={() => handleDeleteEntry(entry.id)}
                      title="Видалити"
                    >
                      🗑️
                    </button>
                  </div>
                  <div className="entry-details">
                    <div className="entry-detail-item">
                      <span>Лікар:</span>
                      <strong>{doctor?.short_name || 'N/A'}</strong>
                    </div>
                    <div className="entry-detail-item">
                      <span>Період:</span>
                      <strong>{monthNames[entry.month - 1]} {entry.year}</strong>
                    </div>
                    <div className="entry-detail-item">
                      <span>Кількість:</span>
                      <strong className="quantity-badge">{entry.quantity} шт</strong>
                    </div>
                  </div>
                  <div className="entry-financial">
                    <div className="fin-item">
                      <span>Оборот:</span>
                      <strong>{entry.total_revenue.toLocaleString('uk-UA')} ₴</strong>
                    </div>
                    <div className="fin-item">
                      <span>Лікарю:</span>
                      <span>{entry.doctor_income.toLocaleString('uk-UA')} ₴</span>
                    </div>
                    <div className="fin-item highlight">
                      <span>Дохід орг:</span>
                      <strong>{entry.fop_income.toLocaleString('uk-UA')} ₴</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal для додавання послуг */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Додати надані послуги</DialogTitle>
          </DialogHeader>
          
          <div className="modal-form">
            <div className="selection-section">
              <div className="form-group">
                <label>Лікар</label>
                <select 
                  value={modalDoctor} 
                  onChange={(e) => setModalDoctor(e.target.value)}
                  data-testid="modal-doctor-select"
                >
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.short_name})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Місяць</label>
                <select 
                  value={modalMonth} 
                  onChange={(e) => setModalMonth(parseInt(e.target.value))}
                  data-testid="modal-month-select"
                >
                  {monthNames.map((m, i) => (
                    <option key={i} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Рік</label>
                <input 
                  type="number" 
                  value={modalYear} 
                  onChange={(e) => setModalYear(parseInt(e.target.value))}
                  data-testid="modal-year-input"
                />
              </div>
            </div>

            <div className="services-grid-modal">
              <h4 style={{ marginBottom: '12px', color: '#FFA500', fontSize: '14px' }}>
                Всі послуги (оберіть та вкажіть кількість):
              </h4>
              
              <div className="services-scroll-container">
                {services.map(service => (
                  <div key={service.id} className="service-input-row">
                    <div className="service-info">
                      <span className="service-code-badge">{service.code}</span>
                      <div className="service-details-compact">
                        <span className="service-name-small">{service.name}</span>
                        <span className="price-label">{service.price} ₴</span>
                      </div>
                    </div>
                    <input 
                      type="number"
                      min="0"
                      value={quantities[service.id] || ''}
                      onChange={(e) => setQuantities({
                        ...quantities,
                        [service.id]: parseInt(e.target.value) || 0
                      })}
                      placeholder="0"
                      className="qty-input"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-actions">
              <button 
                className="btn btn-success" 
                onClick={handleBulkAdd}
              >
                Зберегти обрані
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  setShowAddModal(false);
                  setQuantities({});
                }}
              >
                Скасувати
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal детальної статистики ОБОРОТ */}
      <Dialog open={showRevenueModal} onOpenChange={setShowRevenueModal}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto revenue-modal">
          <DialogHeader>
            <DialogTitle>💰 Детальна статистика обороту</DialogTitle>
          </DialogHeader>
          
          {revenueDetails && (
            <div className="revenue-details">
              {/* Загальна інформація */}
              <div className="details-summary-row">
                <div className="detail-card-mini">
                  <div className="mini-label">Загальний оборот</div>
                  <div className="mini-value">{dashboardStats.total_revenue.toLocaleString('uk-UA')} ₴</div>
                </div>
                <div className="detail-card-mini">
                  <div className="mini-label">Кількість послуг</div>
                  <div className="mini-value">{dashboardStats.total_quantity}</div>
                </div>
                <div className="detail-card-mini highlight-mini">
                  <div className="mini-label">Середній чек</div>
                  <div className="mini-value">{revenueDetails.avgCheck.toFixed(2)} ₴</div>
                </div>
                {revenueDetails.comparison && (
                  <div className={`detail-card-mini ${revenueDetails.comparison.trend === 'up' ? 'success-mini' : 'danger-mini'}`}>
                    <div className="mini-label">Зміна</div>
                    <div className="mini-value">
                      {revenueDetails.comparison.trend === 'up' ? '↗' : '↘'} {Math.abs(revenueDetails.comparison.change).toFixed(1)}%
                    </div>
                  </div>
                )}
              </div>

              {/* Топ-5 послуг */}
              <div className="details-section">
                <h4>🏆 Топ-5 найприбутковіших послуг</h4>
                <div className="top-services-list">
                  {revenueDetails.top5Services.map((service, index) => (
                    <div key={service.code} className="top-service-item">
                      <div className="top-rank">#{index + 1}</div>
                      <div className="top-service-info">
                        <div className="top-service-name">
                          <span className="service-code-badge-small">{service.code}</span>
                          {service.name}
                        </div>
                        <div className="top-service-stats">
                          {service.quantity} шт × {service.price}₴ = <strong>{service.revenue.toLocaleString('uk-UA')} ₴</strong>
                        </div>
                      </div>
                      <div className="top-service-percent">
                        {((service.revenue / dashboardStats.total_revenue) * 100).toFixed(1)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Breakdown всіх послуг */}
              <div className="details-section">
                <h4>📋 Всі послуги (сортовано за оборотом)</h4>
                <div className="services-breakdown-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Код</th>
                        <th>Назва послуги</th>
                        <th>Ціна</th>
                        <th>К-ть</th>
                        <th>Оборот</th>
                        <th>%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {revenueDetails.servicesBreakdown.map(service => (
                        <tr key={service.code}>
                          <td><span className="code-badge-table">{service.code}</span></td>
                          <td>{service.name}</td>
                          <td>{service.price.toLocaleString('uk-UA')} ₴</td>
                          <td><strong>{service.quantity}</strong></td>
                          <td className="revenue-cell"><strong>{service.revenue.toLocaleString('uk-UA')} ₴</strong></td>
                          <td>
                            <div className="percent-bar">
                              <div 
                                className="percent-fill" 
                                style={{ width: `${(service.revenue / dashboardStats.total_revenue) * 100}%` }}
                              />
                              <span className="percent-text">
                                {((service.revenue / dashboardStats.total_revenue) * 100).toFixed(1)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Розподіл по лікарях */}
              {revenueDetails.doctorsBreakdown.length > 1 && (
                <div className="details-section">
                  <h4>👥 Розподіл обороту по лікарях</h4>
                  <div className="doctors-breakdown">
                    {revenueDetails.doctorsBreakdown.map(doctor => (
                      <div key={doctor.short_name} className="doctor-revenue-card">
                        <div className="doctor-header">
                          <div className="doctor-name-badge">{doctor.short_name}</div>
                          <div className="doctor-full-name">{doctor.name}</div>
                        </div>
                        <div className="doctor-stats-row">
                          <div className="doctor-stat">
                            <span>Оборот:</span>
                            <strong>{doctor.revenue.toLocaleString('uk-UA')} ₴</strong>
                          </div>
                          <div className="doctor-stat">
                            <span>Послуг:</span>
                            <strong>{doctor.quantity} шт</strong>
                          </div>
                          <div className="doctor-stat highlight">
                            <span>% від загального:</span>
                            <strong>{((doctor.revenue / dashboardStats.total_revenue) * 100).toFixed(1)}%</strong>
                          </div>
                        </div>
                        <div className="progress-bar-container">
                          <div 
                            className="progress-bar-fill" 
                            style={{ width: `${(doctor.revenue / dashboardStats.total_revenue) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Динаміка по місяцях */}
              {revenueDetails.monthlyBreakdown.length > 1 && (
                <div className="details-section">
                  <h4>📈 Динаміка обороту по місяцях</h4>
                  <div className="monthly-chart">
                    {revenueDetails.monthlyBreakdown.map(item => (
                      <div key={`${item.year}-${item.month}`} className="month-bar-item">
                        <div className="month-label">{monthNames[item.month - 1]} {item.year}</div>
                        <div className="month-bar-container">
                          <div 
                            className="month-bar-fill" 
                            style={{ 
                              width: `${(item.revenue / Math.max(...revenueDetails.monthlyBreakdown.map(m => m.revenue))) * 100}%` 
                            }}
                          />
                          <span className="month-bar-value">{item.revenue.toLocaleString('uk-UA')} ₴</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MonthlyServices;
