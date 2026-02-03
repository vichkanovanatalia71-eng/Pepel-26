import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './PMGSettings.css';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const PMGSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [capitationRate, setCapitationRate] = useState(1007.3);
  const [coefficients, setCoefficients] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/pmg-settings`);
      setCapitationRate(response.data.capitation_rate);
      setCoefficients(response.data.age_coefficients);
      setHasChanges(false);
    } catch (error) {
      console.error('Error loading settings:', error);
      alert('Помилка завантаження налаштувань');
    } finally {
      setLoading(false);
    }
  };

  const handleCapitationChange = (value) => {
    setCapitationRate(parseFloat(value) || 0);
    setHasChanges(true);
  };

  const handleCoefficientChange = (index, value) => {
    const newCoefficients = [...coefficients];
    newCoefficients[index].coefficient = parseFloat(value) || 0;
    setCoefficients(newCoefficients);
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!hasChanges) {
      alert('Немає змін для збереження');
      return;
    }

    setSaving(true);
    try {
      await axios.put(`${API_URL}/api/pmg-settings`, {
        capitation_rate: capitationRate,
        age_coefficients: coefficients
      });
      
      setHasChanges(false);
      alert('✅ Налаштування збережено!');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Помилка збереження налаштувань');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (window.confirm('Скасувати всі незбережені зміни?')) {
      loadSettings();
    }
  };

  if (loading) {
    return (
      <div className="pmg-settings-page loading">
        <div className="loading-spinner">Завантаження...</div>
      </div>
    );
  }

  return (
    <div className="pmg-settings-page" data-testid="pmg-settings-page">
      <div className="page-header">
        <h1>⚙️ Капітаційна ставка та коефіцієнти</h1>
        {hasChanges && (
          <div className="unsaved-badge">Є незбережені зміни</div>
        )}
      </div>

      <div className="settings-description">
        <p>
          Налаштуйте капітаційну ставку та коефіцієнти для розрахунку доходу за ПМГ декларації.
          Ці значення використовуються при обчисленні суми оплати за декларації.
        </p>
      </div>

      {/* Capitation Rate */}
      <div className="settings-card">
        <div className="settings-card-header">
          <h3>💰 Капітаційна ставка</h3>
          <p className="card-description">Базова місячна ставка за одну декларацію</p>
        </div>
        <div className="settings-card-body">
          <div className="capitation-input-group">
            <input
              type="number"
              step="0.1"
              value={capitationRate}
              onChange={(e) => handleCapitationChange(e.target.value)}
              className="capitation-input"
              data-testid="capitation-rate-input"
            />
            <span className="input-unit">₴</span>
          </div>
          <p className="input-hint">
            Формула розрахунку: Кількість пацієнтів × Коефіцієнт × Капітаційна ставка / 12
          </p>
        </div>
      </div>

      {/* Age Coefficients */}
      <div className="settings-card">
        <div className="settings-card-header">
          <h3>📊 Коефіцієнти за віковими групами</h3>
          <p className="card-description">Коригуючі коефіцієнти для різних вікових категорій пацієнтів</p>
        </div>
        <div className="settings-card-body">
          <div className="coefficients-list">
            {coefficients.map((coef, index) => (
              <div key={coef.age_group} className="coefficient-row">
                <div className="coefficient-label">
                  <span className="age-group-badge">{coef.age_group}</span>
                  <span className="age-group-name">{coef.label}</span>
                </div>
                <div className="coefficient-input-group">
                  <input
                    type="number"
                    step="0.001"
                    value={coef.coefficient}
                    onChange={(e) => handleCoefficientChange(index, e.target.value)}
                    className="coefficient-input"
                    data-testid={`coefficient-input-${coef.age_group}`}
                  />
                  <span className="input-multiplier">×</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="settings-actions">
        <button
          className="btn btn-success"
          onClick={handleSave}
          disabled={!hasChanges || saving}
          data-testid="save-settings-btn"
        >
          {saving ? '⏳ Збереження...' : '✓ Зберегти зміни'}
        </button>
        <button
          className="btn btn-secondary"
          onClick={handleReset}
          disabled={!hasChanges || saving}
        >
          ↺ Скасувати
        </button>
      </div>

      {/* Example Calculation */}
      <div className="settings-card info-card">
        <div className="settings-card-header">
          <h3>📝 Приклад розрахунку</h3>
        </div>
        <div className="settings-card-body">
          <div className="example-calculation">
            <p className="example-title">Для пацієнта віком 0-5 років:</p>
            <div className="calculation-formula">
              <span className="formula-part">1 пацієнт</span>
              <span className="formula-operator">×</span>
              <span className="formula-part highlight">{coefficients[0]?.coefficient || 2.465}</span>
              <span className="formula-operator">×</span>
              <span className="formula-part highlight">{capitationRate.toFixed(1)} ₴</span>
              <span className="formula-operator">÷</span>
              <span className="formula-part">12 місяців</span>
              <span className="formula-operator">=</span>
              <span className="formula-result">
                {((coefficients[0]?.coefficient || 2.465) * capitationRate / 12).toFixed(2)} ₴/міс
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PMGSettings;
