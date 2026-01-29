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
  const [dashboardStats, setDashboardStats] = useState(null);
  
  // Фільтри (за замовчуванням - весь період + всі лікарі)
  const [filterDoctor, setFilterDoctor] = useState('all'); // 'all' | doctor_id
  const [filterPeriod, setFilterPeriod] = useState('all'); // 'all' | 'month'
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalDoctor, setModalDoctor] = useState('');
  const [modalMonth, setModalMonth] = useState(new Date().getMonth() + 1);
  const [modalYear, setModalYear] = useState(new Date().getFullYear());
  const [quantities, setQuantities] = useState({});

  useEffect(() => {
    fetchServices();
    fetchDoctors();
  }, []);

  useEffect(() => {
    if (doctors.length > 0) {
      fetchFilteredData();
    }
  }, [filterDoctor, filterPeriod, filterMonth, filterYear, doctors]);

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

  const fetchFilteredData = async () => {
    try {
      // Отримати всі записи
      const response = await axios.get(`${API_URL}/api/monthly-services`);
      let entries = response.data;
      
      // Фільтрувати за лікарем
      if (filterDoctor !== 'all') {
        entries = entries.filter(e => e.doctor_id === filterDoctor);
      }
      
      // Фільтрувати за періодом
      if (filterPeriod === 'month') {
        entries = entries.filter(e => e.month === filterMonth && e.year === filterYear);
      }
      
      // Сортувати від нових до старих
      entries.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      setMonthlyEntries(entries);
      
      // Розрахунок dashboard
      const stats = {
        total_revenue: entries.reduce((sum, e) => sum + (e.total_revenue || 0), 0),
        total_doctor_income: entries.reduce((sum, e) => sum + (e.doctor_income || 0), 0),
        total_expenses: entries.reduce((sum, e) => sum + (e.total_expenses || 0), 0),
        total_fop_income: entries.reduce((sum, e) => sum + (e.fop_income || 0), 0),
        total_quantity: entries.reduce((sum, e) => sum + (e.quantity || 0), 0),
        total_services: entries.length
      };
      
      setDashboardStats(stats);
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
      
      if (entries.length === 0) {
        alert('Вкажіть кількість хоча б для однієї послуги');
        return;
      }
      
      for (const entry of entries) {
        await axios.post(`${API_URL}/api/monthly-services`, entry);
      }
      
      setQuantities({});
      setShowAddModal(false);
      fetchFilteredData();
    } catch (error) {
      console.error('Error:', error);
      alert('Помилка збереження');
    }
  };

  const handleDeleteEntry = async (entryId) => {
    if (window.confirm('Видалити цей запис?')) {
      try {
        await axios.delete(`${API_URL}/api/monthly-services/${entryId}`);
        fetchFilteredData();
      } catch (error) {
        console.error('Error:', error);
      }
    }
  };

  const monthNames = [
    'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
    'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'
  ];

  const getFilterLabel = () => {
    let label = '';
    
    if (filterDoctor === 'all') {
      label = 'Всі лікарі';
    } else {
      const doc = doctors.find(d => d.id === filterDoctor);
      label = doc?.short_name || 'Лікар';
    }
    
    if (filterPeriod === 'all') {
      label += ' • Весь період';
    } else {
      label += ` • ${monthNames[filterMonth - 1]} ${filterYear}`;
    }
    
    return label;
  };

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

      {/* Фільтри */}
      <div className="filters-section">
        <div className="filter-row">
          <div className="filter-group-inline">
            <label>Лікар:</label>
            <select 
              value={filterDoctor} 
              onChange={(e) => setFilterDoctor(e.target.value)}
              data-testid="filter-doctor"
              className="filter-select"
            >
              <option value="all">Всі лікарі</option>
              {doctors.map(d => (
                <option key={d.id} value={d.id}>{d.name} ({d.short_name})</option>
              ))}
            </select>
          </div>
          
          <div className="filter-group-inline">
            <label>Період:</label>
            <select 
              value={filterPeriod} 
              onChange={(e) => setFilterPeriod(e.target.value)}
              data-testid="filter-period"
              className="filter-select"
            >
              <option value="all">Весь період</option>
              <option value="month">По місяцю</option>
            </select>
          </div>
          
          {filterPeriod === 'month' && (
            <>
              <select 
                value={filterMonth} 
                onChange={(e) => setFilterMonth(parseInt(e.target.value))}
                className="filter-select-small"
              >
                {monthNames.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
              <input 
                type="number" 
                value={filterYear} 
                onChange={(e) => setFilterYear(parseInt(e.target.value))}
                className="filter-input-year"
              />
            </>
          )}
        </div>
        
        <div className="filter-label-active">
          Відображення: <strong>{getFilterLabel()}</strong>
        </div>
      </div>

      {/* Dashboard Statistics */}
      {dashboardStats && (
        <div className="summary-cards">
          <div className="summary-card">
            <div className="summary-icon">💰</div>
            <div>
              <div className="summary-label">Оборот</div>
              <div className="summary-value">{dashboardStats.total_revenue.toLocaleString('uk-UA')} ₴</div>
              <div className="summary-count">{dashboardStats.total_quantity} послуг</div>
            </div>
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
        <h3>Надані послуги ({monthlyEntries.length})</h3>
        {monthlyEntries.length === 0 ? (
          <div className="empty-state">
            <p>Записів ще немає</p>
            <p className="empty-hint">Натисніть "+ Додати послуги" щоб додати</p>
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
                      data-testid={`delete-entry-${entry.id}`}
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

            {/* Список всіх послуг для введення кількостей */}
            <div className="services-grid-modal">
              <h4 style={{ marginBottom: '12px', color: '#FFA500', fontSize: '14px' }}>
                Оберіть послуги та вкажіть кількість:
              </h4>
              
              <div className="services-scroll-container">
                {services.map(service => (
                  <div key={service.id} className="service-input-row" data-testid={`service-row-${service.id}`}>
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
                      data-testid={`qty-${service.id}`}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-actions">
              <button 
                type="button"
                className="btn btn-success" 
                onClick={handleBulkAdd}
                data-testid="save-bulk-btn"
              >
                Зберегти обрані послуги
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
