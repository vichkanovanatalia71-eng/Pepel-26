import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Expenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ 
    date: new Date().toISOString().split('T')[0],
    category: '',
    amount: '',
    description: ''
  });

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/expenses`);
      setExpenses(response.data);
    } catch (error) {
      console.error('Error fetching expenses:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/api/expenses`, {
        ...formData,
        date: new Date(formData.date).toISOString(),
        amount: parseFloat(formData.amount)
      });
      setFormData({ date: new Date().toISOString().split('T')[0], category: '', amount: '', description: '' });
      setShowForm(false);
      fetchExpenses();
    } catch (error) {
      console.error('Error creating expense:', error);
    }
  };

  const categories = [
    'Комунальні послуги',
    'Інтернет',
    'Телефон',
    'Медикаменти та медтовари',
    'Канцтовари',
    'Оренда',
    'Кредит',
    'Зарплата',
    'Податки',
    'Інше'
  ];

  return (
    <div data-testid="expenses-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1>📉 Витрати</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)} data-testid="add-expense-btn">
          + Додати витрату
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <h3>Нова витрата</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div className="form-group">
                <label>Дата</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                  data-testid="expense-date-input"
                />
              </div>
              <div className="form-group">
                <label>Категорія</label>
                <select 
                  value={formData.category} 
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  required
                  data-testid="expense-category-select"
                >
                  <option value="">Оберіть категорію</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Сума (грн)</label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="2500"
                  required
                  data-testid="expense-amount-input"
                />
              </div>
            </div>
            <div className="form-group">
              <label>Опис</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Додаткова інформація..."
                rows="3"
                data-testid="expense-description-input"
              />
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="submit" className="btn btn-success" data-testid="save-expense-btn">Зберегти</button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)} data-testid="cancel-expense-btn">Скасувати</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        {expenses.length === 0 ? (
          <div className="empty-state">
            <p>Витрат ще не додано</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Категорія</th>
                  <th>Сума</th>
                  <th>Опис</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id} data-testid={`expense-row-${expense.id}`}>
                    <td>{new Date(expense.date).toLocaleDateString('uk-UA')}</td>
                    <td><span className="badge badge-danger">{expense.category}</span></td>
                    <td><strong>{expense.amount.toLocaleString('uk-UA')} ₴</strong></td>
                    <td>{expense.description}</td>
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

export default Expenses;