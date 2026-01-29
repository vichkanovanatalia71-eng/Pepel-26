import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Services = () => {
  const [services, setServices] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ 
    name: '', 
    price: '', 
    doctor_share: '', 
    expenses: '' 
  });

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/services`);
      setServices(response.data);
    } catch (error) {
      console.error('Error fetching services:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/api/services`, {
        ...formData,
        price: parseFloat(formData.price),
        doctor_share: parseFloat(formData.doctor_share || 0),
        expenses: parseFloat(formData.expenses || 0)
      });
      setFormData({ name: '', price: '', doctor_share: '', expenses: '' });
      setShowForm(false);
      fetchServices();
    } catch (error) {
      console.error('Error creating service:', error);
    }
  };

  return (
    <div data-testid="services-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1>🏥 Платні послуги</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)} data-testid="add-service-btn">
          + Додати послугу
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <h3>Нова послуга</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Назва послуги</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Консультація лікаря"
                required
                data-testid="service-name-input"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div className="form-group">
                <label>Ціна (грн)</label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="500"
                  required
                  data-testid="service-price-input"
                />
              </div>
              <div className="form-group">
                <label>Частка лікаря (грн)</label>
                <input
                  type="number"
                  value={formData.doctor_share}
                  onChange={(e) => setFormData({ ...formData, doctor_share: e.target.value })}
                  placeholder="300"
                  data-testid="service-share-input"
                />
              </div>
              <div className="form-group">
                <label>Витрати (грн)</label>
                <input
                  type="number"
                  value={formData.expenses}
                  onChange={(e) => setFormData({ ...formData, expenses: e.target.value })}
                  placeholder="50"
                  data-testid="service-expenses-input"
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="submit" className="btn btn-success" data-testid="save-service-btn">Зберегти</button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)} data-testid="cancel-service-btn">Скасувати</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        {services.length === 0 ? (
          <div className="empty-state">
            <p>Послуг ще не додано</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Назва</th>
                  <th>Ціна</th>
                  <th>Частка лікаря</th>
                  <th>Витрати</th>
                  <th>Дохід ФОП</th>
                </tr>
              </thead>
              <tbody>
                {services.map((service) => (
                  <tr key={service.id} data-testid={`service-row-${service.id}`}>
                    <td>{service.name}</td>
                    <td>{service.price.toLocaleString('uk-UA')} ₴</td>
                    <td>{service.doctor_share.toLocaleString('uk-UA')} ₴</td>
                    <td>{service.expenses.toLocaleString('uk-UA')} ₴</td>
                    <td className="badge badge-success">
                      {(service.price - service.doctor_share - service.expenses).toLocaleString('uk-UA')} ₴
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Services;