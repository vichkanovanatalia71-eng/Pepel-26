import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Doctors = () => {
  const [doctors, setDoctors] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', short_name: '' });

  useEffect(() => {
    fetchDoctors();
  }, []);

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
      await axios.post(`${API_URL}/api/doctors`, formData);
      setFormData({ name: '', short_name: '' });
      setShowForm(false);
      fetchDoctors();
    } catch (error) {
      console.error('Error creating doctor:', error);
    }
  };

  return (
    <div data-testid="doctors-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1>👥 Лікарі</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)} data-testid="add-doctor-btn">
          + Додати лікаря
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <h3>Новий лікар</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Повне ім'я</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Пепеляшко Лілія Миколаївна"
                required
                data-testid="doctor-name-input"
              />
            </div>
            <div className="form-group">
              <label>Коротке ім'я (абревіатура)</label>
              <input
                type="text"
                value={formData.short_name}
                onChange={(e) => setFormData({ ...formData, short_name: e.target.value })}
                placeholder="ПЛМ"
                required
                data-testid="doctor-shortname-input"
              />
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="submit" className="btn btn-success" data-testid="save-doctor-btn">Зберегти</button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)} data-testid="cancel-doctor-btn">Скасувати</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        {doctors.length === 0 ? (
          <div className="empty-state">
            <p>Лікарів ще не додано</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Повне ім'я</th>
                  <th>Абревіатура</th>
                  <th>Дата додавання</th>
                </tr>
              </thead>
              <tbody>
                {doctors.map((doctor) => (
                  <tr key={doctor.id} data-testid={`doctor-row-${doctor.id}`}>
                    <td>{doctor.name}</td>
                    <td><span className="badge badge-success">{doctor.short_name}</span></td>
                    <td>{new Date(doctor.created_at).toLocaleDateString('uk-UA')}</td>
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

export default Doctors;