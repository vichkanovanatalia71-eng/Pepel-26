import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
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
  
  const [selectedDoctor, setSelectedDoctor] = useState('all');
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRevenueModal, setShowRevenueModal] = useState(false);
  const [showDoctorIncomeModal, setShowDoctorIncomeModal] = useState(false);
  const [showExpensesModal, setShowExpensesModal] = useState(false);
  const [modalDoctor, setModalDoctor] = useState('');
  const [modalMonth, setModalMonth] = useState(new Date().getMonth() + 1);
  const [modalYear, setModalYear] = useState(new Date().getFullYear());
  const [quantities, setQuantities] = useState({});

  const monthNames = [
    'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
    'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'
  ];

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [allEntries, selectedDoctor, selectedYear, selectedMonth]);

  const loadData = async () => {
    try {
      const [servicesRes, doctorsRes, entriesRes] = await Promise.all([
        axios.get(`${API_URL}/api/services`),
        axios.get(`${API_URL}/api/doctors`),
        axios.get(`${API_URL}/api/monthly-services`)
      ]);

      setServices(servicesRes.data.sort((a, b) => (a.code || '').localeCompare(b.code || '')));
      setDoctors(doctorsRes.data);
      const sorted = entriesRes.data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setAllEntries(sorted);

      if (doctorsRes.data.length > 0) {
        setModalDoctor(doctorsRes.data[0].id);
      }
    } catch (error) {
      console.error('Load error:', error);
    }
  };

  const applyFilters = () => {
    let filtered = [...allEntries];
    
    if (selectedDoctor !== 'all') {
      filtered = filtered.filter(e => e.doctor_id === selectedDoctor);
    }
    
    if (selectedYear !== 'all') {
      filtered = filtered.filter(e => e.year === selectedYear);
    }
    
    if (selectedMonth !== 'all') {
      filtered = filtered.filter(e => e.month === selectedMonth);
    }
    
    setFilteredEntries(filtered);
    
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
      loadData();
    } catch (error) {
      console.error('Error:', error);
      alert('Помилка збереження');
    }
  };

  const handleDeleteEntry = async (entryId) => {
    if (window.confirm('Видалити цей запис?')) {
      try {
        await axios.delete(`${API_URL}/api/monthly-services/${entryId}`);
        loadData();
      } catch (error) {
        console.error('Error:', error);
      }
    }
  };

  const resetFilters = () => {
    setSelectedDoctor('all');
    setSelectedYear('all');
    setSelectedMonth('all');
  };

  const openRevenueModal = () => setShowRevenueModal(true);
  const openDoctorIncomeModal = () => setShowDoctorIncomeModal(true);
  const openExpensesModal = () => setShowExpensesModal(true);

  const availableYears = [...new Set(allEntries.map(e => e.year))].sort((a, b) => b - a);

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

      {/* Фільтри */}
      <div className="filters-panel">
        <div className="filters-header">
          <h3>Фільтри</h3>
          {hasActiveFilters && (
            <button className="btn-reset-filters" onClick={resetFilters}>
              ✕ Скинути все
            </button>
          )}
        </div>

        <div className="filter-section">
          <label className="filter-label">👨‍⚕️ Лікар:</label>
          <div className="chips-group">
            <button 
              className={`chip ${selectedDoctor === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedDoctor('all')}
            >
              Всі
            </button>
            {doctors.map(doc => (
              <button
                key={doc.id}
                className={`chip ${selectedDoctor === doc.id ? 'active' : ''}`}
                onClick={() => setSelectedDoctor(doc.id)}
              >
                <span className="chip-full-name">{doc.name}</span>
                <span className="chip-short-name">{doc.short_name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="filter-section">
          <label className="filter-label">📅 Рік:</label>
          <div className="chips-group">
            <button 
              className={`chip ${selectedYear === 'all' ? 'active' : ''}`}
              onClick={() => {
                setSelectedYear('all');
                setSelectedMonth('all');
              }}
            >
              Весь період
            </button>
            {availableYears.map(year => (
              <button
                key={year}
                className={`chip ${selectedYear === year ? 'active' : ''}`}
                onClick={() => setSelectedYear(year)}
              >
                {year}
              </button>
            ))}
          </div>
        </div>

        {selectedYear !== 'all' && (
          <div className="filter-section">
            <label className="filter-label">📆 Місяць:</label>
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
                >
                  {monthNames[monthNum - 1]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Dashboard */}
      {dashboardStats && (
        <div className="summary-cards">
          <div 
            className="summary-card clickable" 
            onClick={openRevenueModal}
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
          <div 
            className="summary-card clickable"
            onClick={openDoctorIncomeModal}
            data-testid="doctor-card"
          >
            <div className="summary-icon">👨‍⚕️</div>
            <div>
              <div className="summary-label">
                {selectedDoctor !== 'all' && doctors.find(d => d.id === selectedDoctor)
                  ? `Дохід ${doctors.find(d => d.id === selectedDoctor)?.short_name}`
                  : 'Дохід лікарів'
                }
              </div>
              <div className="summary-value">{dashboardStats.total_doctor_income.toLocaleString('uk-UA')} ₴</div>
            </div>
            <div className="card-click-hint">👁️</div>
          </div>
          <div 
            className="summary-card clickable"
            onClick={openExpensesModal}
            data-testid="expenses-card"
          >
            <div className="summary-icon">📉</div>
            <div>
              <div className="summary-label">Витрати</div>
              <div className="summary-value">{dashboardStats.total_expenses.toLocaleString('uk-UA')} ₴</div>
            </div>
            <div className="card-click-hint">👁️</div>
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

      {/* Список */}
      <div className="card">
        <h3>Надані послуги ({filteredEntries.length})</h3>
        {filteredEntries.length === 0 ? (
          <div className="empty-state">
            <p>Записів не знайдено</p>
          </div>
        ) : (
          <div className="entries-list">
            {filteredEntries.map(entry => {
              const service = services.find(s => s.id === entry.service_id);
              const doctor = doctors.find(d => d.id === entry.doctor_id);
              return (
                <div key={entry.id} className="entry-card">
                  <div className="entry-header">
                    <div className="entry-service">
                      {service?.code && <span className="service-code-small">{service.code}</span>}
                      <span className="service-name">{service?.name || 'N/A'}</span>
                    </div>
                    <button 
                      className="btn-delete-entry" 
                      onClick={() => handleDeleteEntry(entry.id)}
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

      {/* Modal додавання */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Додати надані послуги</DialogTitle>
          </DialogHeader>
          
          <div className="modal-form">
            <div className="selection-section">
              <div className="form-group">
                <label>Лікар</label>
                <select value={modalDoctor} onChange={(e) => setModalDoctor(e.target.value)}>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.short_name})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Місяць</label>
                <select value={modalMonth} onChange={(e) => setModalMonth(parseInt(e.target.value))}>
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
                />
              </div>
            </div>

            <div className="services-grid-modal">
              <h4>Всі послуги:</h4>
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
              <button className="btn btn-success" onClick={handleBulkAdd}>
                Зберегти
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

      {/* Modal ОБОРОТ */}
      <Dialog open={showRevenueModal} onOpenChange={setShowRevenueModal}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>💰 Детальна статистика обороту</DialogTitle>
          </DialogHeader>
          <div className="revenue-details">
            <p>Детальна статистика в розробці...</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal ДОХІД ЛІКАРІВ */}
      <Dialog open={showDoctorIncomeModal} onOpenChange={setShowDoctorIncomeModal}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>👨‍⚕️ Дохід лікарів</DialogTitle>
          </DialogHeader>
          <div className="revenue-details">
            <p>Детальна статистика в розробці...</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal ВИТРАТИ */}
      <Dialog open={showExpensesModal} onOpenChange={setShowExpensesModal}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>📉 Витрати</DialogTitle>
          </DialogHeader>
          <div className="revenue-details">
            <p>Детальна статистика в розробці...</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MonthlyServices;
