import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './MonthlyServices.css';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const MonthlyServices = () => {
  const [services, setServices] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [monthlyEntries, setMonthlyEntries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ service_id: '', quantity: '' });

  useEffect(() => {
    fetchServices();
    fetchDoctors();
  }, []);

  useEffect(() => {
    if (selectedDoctor) {
      fetchMonthlyEntries();
      fetchSummary();
    }
  }, [selectedMonth, selectedYear, selectedDoctor]);

  const fetchServices = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/services`);
      setServices(response.data);
    } catch (error) {
      console.error('Error fetching services:', error);
    }
  };

  const fetchDoctors = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/doctors`);
      setDoctors(response.data);
      if (response.data.length > 0) {
        setSelectedDoctor(response.data[0].id);
      }
    } catch (error) {
      console.error('Error fetching doctors:', error);
    }
  };

  const fetchMonthlyEntries = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/monthly-services?month=${selectedMonth}&year=${selectedYear}&doctor_id=${selectedDoctor}`
      );
      setMonthlyEntries(response.data);
    } catch (error) {
      console.error('Error fetching monthly entries:', error);
    }
  };

  const fetchSummary = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/monthly-services/summary?month=${selectedMonth}&year=${selectedYear}&doctor_id=${selectedDoctor}`
      );
      setSummary(response.data);
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  };

  const handleAddEntry = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/api/monthly-services`, {
        month: selectedMonth,
        year: selectedYear,
        service_id: formData.service_id,
        doctor_id: selectedDoctor,
        quantity: parseInt(formData.quantity)
      });
      setFormData({ service_id: '', quantity: '' });
      setShowAddForm(false);
      fetchMonthlyEntries();
      fetchSummary();
    } catch (error) {
      console.error('Error adding entry:', error);
    }
  };

  const handleUpdateQuantity = async (entryId, newQuantity) => {
    try {
      await axios.put(`${API_URL}/api/monthly-services/${entryId}?quantity=${newQuantity}`);
      fetchMonthlyEntries();
      fetchSummary();
    } catch (error) {
      console.error('Error updating quantity:', error);
    }
  };

  const handleDeleteEntry = async (entryId) => {
    if (window.confirm('Видалити цей запис?')) {
      try {
        await axios.delete(`${API_URL}/api/monthly-services/${entryId}`);
        fetchMonthlyEntries();
        fetchSummary();
      } catch (error) {
        console.error('Error deleting entry:', error);
      }
    }
  };

  const monthNames = [
    'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
    'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'
  ];

  const currentDoctor = doctors.find(d => d.id === selectedDoctor);

  return (
    <div className="monthly-services-page" data-testid="monthly-services-page">
      <h1>📊 Щомісячний облік послуг</h1>

      <div className="filters-bar">
        <div className="filter-group">
          <label>Лікар:</label>
          <select 
            value={selectedDoctor} 
            onChange={(e) => setSelectedDoctor(e.target.value)}
            data-testid="doctor-filter"
          >
            {doctors.map(doctor => (
              <option key={doctor.id} value={doctor.id}>{doctor.name} ({doctor.short_name})</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>Місяць:</label>
          <select 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            data-testid="month-filter"
          >
            {monthNames.map((month, index) => (
              <option key={index} value={index + 1}>{month}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>Рік:</label>
          <input 
            type="number" 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            data-testid="year-filter"
          />
        </div>
      </div>

      {summary && (
        <div className="summary-cards">
          <div className="summary-card">
            <div className="summary-icon">💰</div>
            <div>
              <div className="summary-label">Загальний дохід</div>
              <div className="summary-value">{summary.total_revenue.toLocaleString('uk-UA')} ₴</div>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-icon">👨‍⚕️</div>
            <div>
              <div className="summary-label">Дохід лікаря</div>
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

      <div className="card">
        <div className="card-header">
          <h3>Послуги за {monthNames[selectedMonth - 1]} {selectedYear} - {currentDoctor?.short_name}</h3>
          <button className="btn btn-primary" onClick={() => setShowAddForm(!showAddForm)} data-testid="add-entry-btn">
            + Додати послугу
          </button>
        </div>

        {showAddForm && (
          <form className="add-entry-form" onSubmit={handleAddEntry}>
            <select 
              value={formData.service_id} 
              onChange={(e) => setFormData({ ...formData, service_id: e.target.value })}
              required
              data-testid="service-select"
            >
              <option value="">Оберіть послугу</option>
              {services.map(service => (
                <option key={service.id} value={service.id}>{service.name} - {service.price} ₴</option>
              ))}
            </select>
            <input 
              type="number" 
              placeholder="Кількість"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              required
              min="1"
              data-testid="quantity-input"
            />
            <button type="submit" className="btn btn-success">Додати</button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowAddForm(false)}>Скасувати</button>
          </form>
        )}

        {monthlyEntries.length === 0 ? (
          <div className="empty-state">
            <p>Послуг за цей період не додано</p>
            <p className="empty-hint">Додайте послуги, надані лікарем у цьому місяці</p>
          </div>
        ) : (
          <div className="entries-table-wrapper">
            <table className="entries-table">
              <thead>
                <tr>
                  <th>Послуга</th>
                  <th>Ціна</th>
                  <th>Кількість</th>
                  <th>Оборот</th>
                  <th>Лікарю</th>
                  <th>Витрати</th>
                  <th>Дохід орг.</th>
                  <th>Дії</th>
                </tr>
              </thead>
              <tbody>
                {monthlyEntries.map(entry => {
                  const service = services.find(s => s.id === entry.service_id);
                  return (
                    <tr key={entry.id} data-testid={`entry-row-${entry.id}`}>
                      <td>{service?.name || 'N/A'}</td>
                      <td>{service?.price.toLocaleString('uk-UA')} ₴</td>
                      <td>
                        <input 
                          type="number" 
                          value={entry.quantity}
                          onChange={(e) => handleUpdateQuantity(entry.id, e.target.value)}
                          className="quantity-input"
                          min="1"
                        />
                      </td>
                      <td><strong>{entry.total_revenue.toLocaleString('uk-UA')} ₴</strong></td>
                      <td>{entry.doctor_income.toLocaleString('uk-UA')} ₴</td>
                      <td>{entry.total_expenses.toLocaleString('uk-UA')} ₴</td>
                      <td className="fop-income">{entry.fop_income.toLocaleString('uk-UA')} ₴</td>
                      <td>
                        <button 
                          className="btn-delete-small" 
                          onClick={() => handleDeleteEntry(entry.id)}
                          title="Видалити"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <td colSpan="2"><strong>ВСЬОГО:</strong></td>
                  <td><strong>{summary?.total_quantity || 0}</strong></td>
                  <td><strong>{summary?.total_revenue.toLocaleString('uk-UA')} ₴</strong></td>
                  <td><strong>{summary?.total_doctor_income.toLocaleString('uk-UA')} ₴</strong></td>
                  <td><strong>{summary?.total_expenses.toLocaleString('uk-UA')} ₴</strong></td>
                  <td className="fop-income"><strong>{summary?.total_fop_income.toLocaleString('uk-UA')} ₴</strong></td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default MonthlyServices;
