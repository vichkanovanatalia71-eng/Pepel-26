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
  const [monthlyEntries, setMonthlyEntries] = useState([]);
  const [allTimeSummary, setAllTimeSummary] = useState(null);
  const [monthSummary, setMonthSummary] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showFilter, setShowFilter] = useState(false);
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalDoctor, setModalDoctor] = useState('');
  const [modalMonth, setModalMonth] = useState(new Date().getMonth() + 1);
  const [modalYear, setModalYear] = useState(new Date().getFullYear());
  const [quantities, setQuantities] = useState({});

  useEffect(() => {
    fetchServices();
    fetchDoctors();
    fetchAllEntries();
  }, []);

  useEffect(() => {
    fetchAllEntries();
  }, [selectedMonth, selectedYear, showFilter]);

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
      // Всі записи
      const allResponse = await axios.get(`${API_URL}/api/monthly-services`);
      const allEntries = allResponse.data.sort((a, b) => {
        const dateA = new Date(a.created_at);
        const dateB = new Date(b.created_at);
        return dateB - dateA; // Від нових до старих
      });
      
      // Фільтрувати якщо потрібно
      const filtered = showFilter 
        ? allEntries.filter(e => e.month === selectedMonth && e.year === selectedYear)
        : allEntries;
      
      setMonthlyEntries(filtered);
      
      // Dashboard за весь період
      const totalRevenue = allEntries.reduce((sum, e) => sum + (e.total_revenue || 0), 0);
      const totalDoctorIncome = allEntries.reduce((sum, e) => sum + (e.doctor_income || 0), 0);
      const totalExpenses = allEntries.reduce((sum, e) => sum + (e.total_expenses || 0), 0);
      const totalFopIncome = allEntries.reduce((sum, e) => sum + (e.fop_income || 0), 0);
      
      setAllTimeSummary({
        total_revenue: totalRevenue,
        total_doctor_income: totalDoctorIncome,
        total_expenses: totalExpenses,
        total_fop_income: totalFopIncome
      });
      
      // Статистика по місяцю якщо фільтр активний
      if (showFilter && filtered.length > 0) {
        const monthRevenue = filtered.reduce((sum, e) => sum + (e.total_revenue || 0), 0);
        const monthDoctorIncome = filtered.reduce((sum, e) => sum + (e.doctor_income || 0), 0);
        const monthExpenses = filtered.reduce((sum, e) => sum + (e.total_expenses || 0), 0);
        const monthFopIncome = filtered.reduce((sum, e) => sum + (e.fop_income || 0), 0);
        
        setMonthSummary({
          total_revenue: monthRevenue,
          total_doctor_income: monthDoctorIncome,
          total_expenses: monthExpenses,
          total_fop_income: monthFopIncome
        });
      }
    } catch (error) {
      console.error('Error:', error);
    }
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

  const monthNames = [
    'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
    'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'
  ];

  const summary = showFilter ? monthSummary : allTimeSummary;

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

      {/* Dashboard за весь період */}
      {summary && (
        <div className="summary-cards">
          <div className="summary-card">
            <div className="summary-icon">💰</div>
            <div>
              <div className="summary-label">Оборот {showFilter ? `(${monthNames[selectedMonth-1]})` : '(Весь період)'}</div>
              <div className="summary-value">{summary.total_revenue.toLocaleString('uk-UA')} ₴</div>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-icon">👨‍⚕️</div>
            <div>
              <div className="summary-label">Дохід лікарів</div>
              <div className="summary-value">{summary.total_doctor_income.toLocaleString('uk-UA')} ₴</div>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-icon">📉</div>
            <div>
              <div className="summary-label">Витрати</div>
              <div className="summary-value">{summary.total_expenses.toLocaleString('uk-UA')} ₴</div>
            </div>
          </div>
          <div className="summary-card highlight">
            <div className="summary-icon">💵</div>
            <div>
              <div className="summary-label">Дохід організації</div>
              <div className="summary-value">{summary.total_fop_income.toLocaleString('uk-UA')} ₴</div>
            </div>
          </div>
        </div>
      )}

      {/* Фільтр по місяцях */}
      <div className="filter-toggle">
        <button 
          className={`filter-btn ${showFilter ? 'active' : ''}`}
          onClick={() => setShowFilter(!showFilter)}
          data-testid="toggle-filter-btn"
        >
          {showFilter ? '📅 Показати весь період' : '📅 Фільтр по місяцю'}
        </button>
        
        {showFilter && (
          <div className="month-filter">
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))}>
              {monthNames.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
            <input 
              type="number" 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              style={{ width: '100px' }}
            />
          </div>
        )}
      </div>

      {/* Список послуг від нових до старих */}
      <div className="card">
        <h3>Надані послуги ({monthlyEntries.length})</h3>
        {monthlyEntries.length === 0 ? (
          <div className="empty-state">
            <p>Записів ще немає</p>
          </div>
        ) : (
          <div className="entries-list">
            {monthlyEntries.map(entry => {
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
            {/* Вибір лікаря та періоду */}
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

            {/* Список всіх послуг */}
            <div className="services-grid-modal">
              <h4 style={{ gridColumn: '1 / -1', marginBottom: '12px', color: '#FFA500' }}>
                Оберіть послуги та вкажіть кількість:
              </h4>
              
              {services.map(service => (
                <div key={service.id} className="service-input-row" data-testid={`service-${service.id}`}>
                  <div className="service-info">
                    <span className="service-code-badge">{service.code}</span>
                    <span className="service-name-small">{service.name}</span>
                  </div>
                  <div className="service-price-qty">
                    <span className="price-label">{service.price} ₴</span>
                    <input 
                      type="number"
                      min="0"
                      value={quantities[service.id] || ''}
                      onChange={(e) => setQuantities({
                        ...quantities,
                        [service.id]: parseInt(e.target.value) || 0
                      })}
                      placeholder="К-ть"
                      className="qty-input"
                      data-testid={`qty-${service.id}`}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="modal-actions">
              <button 
                type="button"
                className="btn btn-success" 
                onClick={handleBulkAdd}
                data-testid="save-bulk-btn"
              >
                Зберегти
              </button>
              <button 
                type="button"
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
    </div>
  );
};

export default MonthlyServices;
