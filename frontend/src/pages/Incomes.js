import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Incomes = () => {
  const [incomes, setIncomes] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ 
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    doctor_id: '',
    declarations: { '0-5': 0, '6-17': 0, '18-39': 0, '40-64': 0, '65+': 0 },
    capitalization_rate: 0,
    total_nhs_income: 0,
    paid_services_income: 0
  });

  useEffect(() => {
    fetchIncomes();
    fetchDoctors();
  }, []);

  const fetchIncomes = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/incomes`);
      setIncomes(response.data);
    } catch (error) {
      console.error('Error fetching incomes:', error);
    }
  };

  const fetchDoctors = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/doctors`);
      setDoctors(response.data);
    } catch (error) {
      console.error('Error fetching doctors:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/api/incomes`, formData);
      setShowForm(false);
      fetchIncomes();
    } catch (error) {
      console.error('Error creating income:', error);
    }
  };

  const monthNames = [
    'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
    'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'
  ];

  return (
    <div data-testid="incomes-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1>💰 Доходи</h1>
        <button className="btn btn-success" onClick={() => setShowForm(!showForm)} data-testid="add-income-btn">
          + Додати дохід
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <h3>Новий дохід</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div className="form-group">
                <label>Місяць</label>
                <select 
                  value={formData.month} 
                  onChange={(e) => setFormData({ ...formData, month: parseInt(e.target.value) })}
                  data-testid="income-month-select"
                >
                  {monthNames.map((month, index) => (
                    <option key={index} value={index + 1}>{month}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Рік</label>
                <input
                  type="number"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                  data-testid="income-year-input"
                />
              </div>
              <div className="form-group">
                <label>Лікар</label>
                <select 
                  value={formData.doctor_id} 
                  onChange={(e) => setFormData({ ...formData, doctor_id: e.target.value })}
                  required
                  data-testid="income-doctor-select"
                >
                  <option value="">Оберіть лікаря</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>{doctor.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <h4 style={{ marginTop: '16px', marginBottom: '12px' }}>Декларації по віковим групам</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
              {Object.keys(formData.declarations).map((ageGroup) => (
                <div className="form-group" key={ageGroup}>
                  <label>{ageGroup} років</label>
                  <input
                    type="number"
                    value={formData.declarations[ageGroup]}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      declarations: { ...formData.declarations, [ageGroup]: parseInt(e.target.value) || 0 }
                    })}
                    data-testid={`income-decl-${ageGroup}`}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '16px' }}>
              <div className="form-group">
                <label>Капіталізаційна ставка</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.capitalization_rate}
                  onChange={(e) => setFormData({ ...formData, capitalization_rate: parseFloat(e.target.value) })}
                  data-testid="income-cap-rate-input"
                />
              </div>
              <div className="form-group">
                <label>Дохід від НСЗУ (грн)</label>
                <input
                  type="number"
                  value={formData.total_nhs_income}
                  onChange={(e) => setFormData({ ...formData, total_nhs_income: parseFloat(e.target.value) })}
                  data-testid="income-nhs-input"
                />
              </div>
              <div className="form-group">
                <label>Дохід від платних послуг (грн)</label>
                <input
                  type="number"
                  value={formData.paid_services_income}
                  onChange={(e) => setFormData({ ...formData, paid_services_income: parseFloat(e.target.value) })}
                  data-testid="income-services-input"
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button type="submit" className="btn btn-success" data-testid="save-income-btn">Зберегти</button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)} data-testid="cancel-income-btn">Скасувати</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        {incomes.length === 0 ? (
          <div className="empty-state">
            <p>Доходів ще не додано</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Місяць</th>
                  <th>Лікар</th>
                  <th>Декларації</th>
                  <th>НСЗУ</th>
                  <th>Платні послуги</th>
                  <th>Загалом</th>
                </tr>
              </thead>
              <tbody>
                {incomes.map((income) => {
                  const totalDeclarations = Object.values(income.declarations).reduce((a, b) => a + b, 0);
                  const totalIncome = income.total_nhs_income + income.paid_services_income;
                  const doctor = doctors.find(d => d.id === income.doctor_id);
                  
                  return (
                    <tr key={income.id} data-testid={`income-row-${income.id}`}>
                      <td>{monthNames[income.month - 1]} {income.year}</td>
                      <td>{doctor?.short_name || income.doctor_id}</td>
                      <td><span className="badge badge-success">{totalDeclarations}</span></td>
                      <td>{income.total_nhs_income.toLocaleString('uk-UA')} ₴</td>
                      <td>{income.paid_services_income.toLocaleString('uk-UA')} ₴</td>
                      <td><strong>{totalIncome.toLocaleString('uk-UA')} ₴</strong></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Incomes;