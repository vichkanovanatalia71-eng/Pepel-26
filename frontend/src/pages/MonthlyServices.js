import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import './MonthlyServices.css';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const MonthlyServices = () => {
  const [services, setServices] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [allEntries, setAllEntries] = useState([]);
  const [filteredEntries, setFilteredEntries] = useState([]);
  const [dashboardStats, setDashboardStats] = useState(null);
  
  const [activeTab, setActiveTab] = useState('general'); // 'general' | 'by-doctor' | 'by-month'
  const [selectedDoctor, setSelectedDoctor] = useState('all');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  
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
    fetchAllEntries();
  }, []);

  useEffect(() => {
    filterData();
  }, [activeTab, selectedDoctor, selectedYear, selectedMonth, allEntries]);

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
    
    if (activeTab === 'by-doctor') {
      if (selectedDoctor !== 'all') {
        filtered = filtered.filter(e => e.doctor_id === selectedDoctor);
      }
    } else if (activeTab === 'by-month') {
      filtered = filtered.filter(e => e.year === selectedYear);
      if (selectedMonth !== 'all') {
        filtered = filtered.filter(e => e.month === selectedMonth);
      }
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

  // Отримати доступні місяці для вибраного року
  const getAvailableMonths = () => {
    const monthsSet = new Set();
    allEntries
      .filter(e => e.year === selectedYear)
      .forEach(e => monthsSet.add(e.month));
    return Array.from(monthsSet).sort((a, b) => a - b);
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

  const monthNames = [
    'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
    'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'
  ];

  const availableYears = [...new Set(allEntries.map(e => e.year))].sort((a, b) => b - a);
  if (availableYears.length === 0) availableYears.push(new Date().getFullYear());

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

      {/* Tabs для різних видів аналітики */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="tabs-container">
        <TabsList className="tabs-list">
          <TabsTrigger value="general" data-testid="tab-general">📈 Загально</TabsTrigger>
          <TabsTrigger value="by-doctor" data-testid="tab-by-doctor">👨‍⚕️ По лікарях</TabsTrigger>
          <TabsTrigger value="by-month" data-testid="tab-by-month">📅 По місяцях</TabsTrigger>
        </TabsList>

        {/* Tab: Загально */}
        <TabsContent value="general">
          <div className="tab-info">Всі послуги за весь період</div>
        </TabsContent>

        {/* Tab: По лікарях */}
        <TabsContent value="by-doctor">
          <div className="chips-container">
            <label className="chips-label">Лікар:</label>
            <div className="chips-group">
              <button 
                className={`chip ${selectedDoctor === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedDoctor('all')}
                data-testid="chip-all-doctors"
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
                  {doc.short_name}
                </button>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Tab: По місяцях */}
        <TabsContent value="by-month">
          <div className="chips-container">
            <label className="chips-label">Рік:</label>
            <div className="chips-group">
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
          <div className="chips-container">
            <label className="chips-label">Місяць:</label>
            <div className="chips-group chips-scrollable">
              <button 
                className={`chip ${selectedMonth === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedMonth('all')}
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
        </TabsContent>
      </Tabs>

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
        <h3>Надані послуги ({filteredEntries.length})</h3>
        {filteredEntries.length === 0 ? (
          <div className="empty-state">
            <p>Записів ще немає</p>
            <p className="empty-hint">Натисніть "+ Додати послуги"</p>
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
    </div>
  );
};

export default MonthlyServices;
