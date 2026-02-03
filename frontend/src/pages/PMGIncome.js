import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import './PMGIncome.css';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const MONTH_NAMES = [
  'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
  'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'
];

const AGE_GROUPS = [
  { key: '0-5', label: '0-5 років', coefficient: 2.465 },
  { key: '6-17', label: '6-17 років', coefficient: 1.25 },
  { key: '18-39', label: '18-39 років', coefficient: 0.616 },
  { key: '40-64', label: '40-64 років', coefficient: 0.86 },
  { key: '65+', label: '65+ років', coefficient: 1.3 }
];

const COLORS = ['#FF8C00', '#FFA500', '#FFB347', '#FFCC80', '#FFE0B2'];
const DOCTOR_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];

const PMGIncome = () => {
  const [declarations, setDeclarations] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedDoctorForUpload, setSelectedDoctorForUpload] = useState('');
  
  // Form state for manual entry
  const [formMonth, setFormMonth] = useState(new Date().getMonth() + 1);
  const [formYear, setFormYear] = useState(new Date().getFullYear());
  const [formCapitationRate, setFormCapitationRate] = useState(1007.3);
  const [formDoctorsData, setFormDoctorsData] = useState([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [declRes, doctorsRes] = await Promise.all([
        axios.get(`${API_URL}/api/pmg-declarations`),
        axios.get(`${API_URL}/api/doctors`)
      ]);
      setDeclarations(declRes.data || []);
      setDoctors(doctorsRes.data || []);
      
      // Initialize form with doctors
      if (doctorsRes.data.length > 0 && formDoctorsData.length === 0) {
        setFormDoctorsData(doctorsRes.data.map(doc => ({
          doctor_id: doc.id,
          doctor_name: doc.name,
          age_groups: AGE_GROUPS.map(ag => ({
            age_group: ag.key,
            patients_count: 0,
            coefficient: ag.coefficient,
            amount: 0
          }))
        })));
      }
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter declarations
  const filteredDeclarations = useMemo(() => {
    let filtered = [...declarations];
    
    if (selectedYear !== 'all') {
      filtered = filtered.filter(d => d.year === selectedYear);
    }
    if (selectedMonth !== 'all') {
      filtered = filtered.filter(d => d.month === selectedMonth);
    }
    
    return filtered.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
  }, [declarations, selectedYear, selectedMonth]);

  // Calculate totals
  const totals = useMemo(() => {
    if (filteredDeclarations.length === 0) return null;
    
    const totalPatients = filteredDeclarations.reduce((sum, d) => sum + d.total_patients, 0);
    const totalAmount = filteredDeclarations.reduce((sum, d) => sum + d.total_amount, 0);
    const totalEP = filteredDeclarations.reduce((sum, d) => sum + d.total_ep, 0);
    const totalVZ = filteredDeclarations.reduce((sum, d) => sum + d.total_vz, 0);
    const netAmount = filteredDeclarations.reduce((sum, d) => sum + d.net_amount, 0);
    
    return { totalPatients, totalAmount, totalEP, totalVZ, netAmount };
  }, [filteredDeclarations]);

  // Data for charts
  const ageGroupChartData = useMemo(() => {
    if (filteredDeclarations.length === 0) return [];
    
    const grouped = {};
    AGE_GROUPS.forEach(ag => {
      grouped[ag.key] = { name: ag.label, patients: 0, amount: 0 };
    });
    
    filteredDeclarations.forEach(decl => {
      decl.doctors_data?.forEach(doc => {
        doc.age_groups?.forEach(ag => {
          if (grouped[ag.age_group]) {
            grouped[ag.age_group].patients += ag.patients_count || 0;
            grouped[ag.age_group].amount += ag.amount || 0;
          }
        });
      });
    });
    
    return Object.values(grouped);
  }, [filteredDeclarations]);

  const doctorChartData = useMemo(() => {
    if (filteredDeclarations.length === 0) return [];
    
    const grouped = {};
    
    filteredDeclarations.forEach(decl => {
      decl.doctors_data?.forEach(doc => {
        if (!grouped[doc.doctor_name]) {
          grouped[doc.doctor_name] = { name: doc.doctor_name, patients: 0, amount: 0 };
        }
        grouped[doc.doctor_name].patients += doc.total_patients || 0;
        grouped[doc.doctor_name].amount += doc.total_amount || 0;
      });
    });
    
    return Object.values(grouped);
  }, [filteredDeclarations]);

  const monthlyChartData = useMemo(() => {
    if (declarations.length === 0) return [];
    
    const filtered = selectedYear !== 'all' 
      ? declarations.filter(d => d.year === selectedYear)
      : declarations;
    
    return filtered
      .sort((a, b) => a.month - b.month)
      .map(d => ({
        name: MONTH_NAMES[d.month - 1],
        amount: d.total_amount,
        patients: d.total_patients
      }));
  }, [declarations, selectedYear]);

  // Handle manual form submission
  const handleManualSubmit = async () => {
    try {
      await axios.post(`${API_URL}/api/pmg-declarations`, {
        month: formMonth,
        year: formYear,
        capitation_rate: formCapitationRate,
        doctors_data: formDoctorsData
      });
      
      setShowAddModal(false);
      loadData();
    } catch (error) {
      console.error('Save error:', error);
      alert('Помилка збереження');
    }
  };

  // Handle Image upload
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!selectedDoctorForUpload) {
      alert('Спочатку оберіть лікаря');
      return;
    }
    
    setUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await axios.post(`${API_URL}/api/pmg-declarations/analyze-image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (response.data.success && response.data.parsed_data) {
        const parsed = response.data.parsed_data;
        
        // Find the doctor in form data and update their age groups
        const newDoctorsData = formDoctorsData.map(doc => {
          if (doc.doctor_id === selectedDoctorForUpload || 
              doc.doctor_name.toLowerCase().includes(parsed.doctor_name?.toLowerCase().split(' ')[0] || '')) {
            return {
              ...doc,
              age_groups: AGE_GROUPS.map(ag => {
                const parsedGroup = parsed.age_groups?.find(pg => pg.age_group === ag.key);
                return {
                  age_group: ag.key,
                  patients_count: parsedGroup?.patients_count || 0,
                  coefficient: ag.coefficient,
                  amount: 0
                };
              }),
              total_patients: parsed.total_declarations || 0
            };
          }
          return doc;
        });
        
        setFormDoctorsData(newDoctorsData);
        setShowUploadModal(false);
        setShowAddModal(true);
        
        const doctorName = doctors.find(d => d.id === selectedDoctorForUpload)?.name || parsed.doctor_name;
        alert(`✅ Зображення проаналізовано для ${doctorName}!\nЗнайдено: ${parsed.total_declarations || 0} декларацій.\nПеревірте дані та збережіть.`);
      } else {
        alert('Помилка аналізу зображення: ' + (response.data.error || 'Невідома помилка'));
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Помилка завантаження зображення');
    } finally {
      setUploading(false);
    }
  }; {
      console.error('Upload error:', error);
      alert('Помилка завантаження PDF');
    } finally {
      setUploading(false);
    }
  };

  // Update form patient count
  const updatePatientCount = (doctorIndex, ageGroupIndex, value) => {
    const newData = [...formDoctorsData];
    newData[doctorIndex].age_groups[ageGroupIndex].patients_count = parseInt(value) || 0;
    setFormDoctorsData(newData);
  };

  // Available years
  const availableYears = useMemo(() => {
    const years = [...new Set(declarations.map(d => d.year))];
    if (!years.includes(new Date().getFullYear())) {
      years.push(new Date().getFullYear());
    }
    return years.sort((a, b) => b - a);
  }, [declarations]);

  if (loading) {
    return (
      <div className="pmg-income-page loading">
        <div className="loading-spinner">Завантаження...</div>
      </div>
    );
  }

  return (
    <div className="pmg-income-page" data-testid="pmg-income-page">
      <div className="page-header">
        <h1>💰 Дохід за ПМГ (Декларації)</h1>
        <div className="header-actions">
          <button 
            className="btn btn-secondary"
            onClick={() => setShowUploadModal(true)}
            data-testid="upload-pdf-btn"
          >
            📄 Завантажити PDF
          </button>
          <button 
            className="btn btn-primary"
            onClick={() => setShowAddModal(true)}
            data-testid="add-declaration-btn"
          >
            + Додати вручну
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="pmg-filters">
        <div className="filter-group">
          <label>📅 Рік:</label>
          <div className="chips-group">
            <button 
              className={`chip ${selectedYear === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedYear('all')}
            >
              Всі
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
          <div className="filter-group">
            <label>📆 Місяць:</label>
            <div className="chips-group chips-scrollable">
              <button 
                className={`chip ${selectedMonth === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedMonth('all')}
              >
                Весь рік
              </button>
              {declarations
                .filter(d => d.year === selectedYear)
                .map(d => d.month)
                .filter((v, i, a) => a.indexOf(v) === i)
                .sort((a, b) => a - b)
                .map(month => (
                  <button
                    key={month}
                    className={`chip ${selectedMonth === month ? 'active' : ''}`}
                    onClick={() => setSelectedMonth(month)}
                  >
                    {MONTH_NAMES[month - 1]}
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      {totals && (
        <div className="pmg-kpi-cards">
          <div className="kpi-card">
            <div className="kpi-icon">👥</div>
            <div className="kpi-content">
              <div className="kpi-label">Активних декларацій</div>
              <div className="kpi-value">{totals.totalPatients.toLocaleString('uk-UA')}</div>
            </div>
          </div>
          
          <div className="kpi-card highlight">
            <div className="kpi-icon">💰</div>
            <div className="kpi-content">
              <div className="kpi-label">Сума за ПМГ</div>
              <div className="kpi-value">{totals.totalAmount.toLocaleString('uk-UA')} ₴</div>
            </div>
          </div>
          
          <div className="kpi-card">
            <div className="kpi-icon">📊</div>
            <div className="kpi-content">
              <div className="kpi-label">ЄП (5%)</div>
              <div className="kpi-value">{totals.totalEP.toLocaleString('uk-UA')} ₴</div>
            </div>
          </div>
          
          <div className="kpi-card">
            <div className="kpi-icon">🎖️</div>
            <div className="kpi-content">
              <div className="kpi-label">ВЗ (1%)</div>
              <div className="kpi-value">{totals.totalVZ.toLocaleString('uk-UA')} ₴</div>
            </div>
          </div>
          
          <div className="kpi-card success">
            <div className="kpi-icon">✅</div>
            <div className="kpi-content">
              <div className="kpi-label">Чистий дохід</div>
              <div className="kpi-value">{totals.netAmount.toLocaleString('uk-UA')} ₴</div>
            </div>
          </div>
        </div>
      )}

      {/* Charts Section */}
      {filteredDeclarations.length > 0 ? (
        <div className="pmg-charts-grid">
          {/* Age Groups Distribution - Pie Chart */}
          <div className="chart-card">
            <h3>👥 Розподіл за віковими групами</h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={ageGroupChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={100}
                    dataKey="patients"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {ageGroupChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value, name) => [value.toLocaleString('uk-UA'), 'Пацієнтів']}
                    contentStyle={{ background: '#1a1a1d', border: '1px solid #FF8C00' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-legend">
              {ageGroupChartData.map((item, index) => (
                <div key={item.name} className="legend-item">
                  <span className="legend-color" style={{ backgroundColor: COLORS[index] }}></span>
                  <span className="legend-label">{item.name}: {item.patients}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Doctor Distribution - Pie Chart */}
          {doctorChartData.length > 1 && (
            <div className="chart-card">
              <h3>👨‍⚕️ Розподіл по лікарях</h3>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={doctorChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={100}
                      dataKey="patients"
                      label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                    >
                      {doctorChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={DOCTOR_COLORS[index % DOCTOR_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value, name) => [value.toLocaleString('uk-UA'), 'Пацієнтів']}
                      contentStyle={{ background: '#1a1a1d', border: '1px solid #FF8C00' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-legend">
                {doctorChartData.map((item, index) => (
                  <div key={item.name} className="legend-item">
                    <span className="legend-color" style={{ backgroundColor: DOCTOR_COLORS[index] }}></span>
                    <span className="legend-label">{item.name.split(' ')[0]}: {item.patients}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Age Groups Bar Chart */}
          <div className="chart-card wide">
            <h3>📊 Кількість декларацій за віковими групами</h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={ageGroupChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="name" stroke="#888" fontSize={12} />
                  <YAxis stroke="#888" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ background: '#1a1a1d', border: '1px solid #FF8C00' }}
                    formatter={(value) => [value.toLocaleString('uk-UA'), 'Пацієнтів']}
                  />
                  <Bar dataKey="patients" fill="#FF8C00" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monthly Trend */}
          {monthlyChartData.length > 1 && (
            <div className="chart-card wide">
              <h3>📈 Динаміка по місяцях</h3>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={monthlyChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="name" stroke="#888" fontSize={12} />
                    <YAxis stroke="#888" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ background: '#1a1a1d', border: '1px solid #FF8C00' }}
                      formatter={(value, name) => [
                        value.toLocaleString('uk-UA') + (name === 'amount' ? ' ₴' : ''),
                        name === 'amount' ? 'Сума' : 'Пацієнтів'
                      ]}
                    />
                    <Legend />
                    <Bar dataKey="amount" name="Сума (₴)" fill="#FF8C00" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="patients" name="Пацієнтів" fill="#4ECDC4" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <h3>Немає даних</h3>
          <p>Додайте дані про декларації вручну або завантажте PDF звіт від НСЗУ</p>
          <div className="empty-actions">
            <button className="btn btn-secondary" onClick={() => setShowUploadModal(true)}>
              📄 Завантажити PDF
            </button>
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
              + Додати вручну
            </button>
          </div>
        </div>
      )}

      {/* Declarations Table */}
      {filteredDeclarations.length > 0 && (
        <div className="declarations-table-section">
          <h3>📋 Детальна таблиця</h3>
          <div className="declarations-table-wrapper">
            <table className="declarations-table">
              <thead>
                <tr>
                  <th>Період</th>
                  <th>Пацієнтів</th>
                  <th>Сума</th>
                  <th>ЄП (5%)</th>
                  <th>ВЗ (1%)</th>
                  <th>Чистий дохід</th>
                  <th>Джерело</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeclarations.map(decl => (
                  <tr key={decl.id}>
                    <td><strong>{MONTH_NAMES[decl.month - 1]} {decl.year}</strong></td>
                    <td>{decl.total_patients.toLocaleString('uk-UA')}</td>
                    <td className="amount-cell">{decl.total_amount.toLocaleString('uk-UA')} ₴</td>
                    <td>{decl.total_ep.toLocaleString('uk-UA')} ₴</td>
                    <td>{decl.total_vz.toLocaleString('uk-UA')} ₴</td>
                    <td className="highlight-cell">{decl.net_amount.toLocaleString('uk-UA')} ₴</td>
                    <td>
                      <span className={`source-badge ${decl.source}`}>
                        {decl.source === 'pdf' ? '📄 PDF' : '✏️ Вручну'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Upload PDF Modal */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>📄 Завантажити PDF звіт НСЗУ</DialogTitle>
          </DialogHeader>
          <div className="upload-modal-content">
            <p className="upload-hint">
              Завантажте PDF звіт від Національної служби здоров'я України. 
              AI проаналізує документ та автоматично заповнить дані.
            </p>
            
            <label className="upload-area">
              <input 
                type="file" 
                accept=".pdf"
                onChange={handlePdfUpload}
                disabled={uploading}
              />
              {uploading ? (
                <span className="uploading">🔄 Аналіз AI...</span>
              ) : (
                <span>📁 Оберіть PDF файл</span>
              )}
            </label>
            
            <button 
              className="btn btn-secondary full-width"
              onClick={() => setShowUploadModal(false)}
            >
              Скасувати
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual Entry Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>📝 Додати дані декларацій</DialogTitle>
          </DialogHeader>
          <div className="manual-entry-form">
            {/* Period & Rate */}
            <div className="form-row">
              <div className="form-group">
                <label>Місяць</label>
                <select value={formMonth} onChange={(e) => setFormMonth(parseInt(e.target.value))}>
                  {MONTH_NAMES.map((name, i) => (
                    <option key={i} value={i + 1}>{name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Рік</label>
                <input 
                  type="number" 
                  value={formYear} 
                  onChange={(e) => setFormYear(parseInt(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label>Капітаційна ставка (₴)</label>
                <input 
                  type="number" 
                  step="0.1"
                  value={formCapitationRate} 
                  onChange={(e) => setFormCapitationRate(parseFloat(e.target.value))}
                />
              </div>
            </div>

            {/* Doctors Data */}
            {formDoctorsData.map((doctor, docIndex) => (
              <div key={docIndex} className="doctor-entry-section">
                <h4>👨‍⚕️ {doctor.doctor_name}</h4>
                <div className="age-groups-grid">
                  {doctor.age_groups.map((ag, agIndex) => (
                    <div key={ag.age_group} className="age-group-input">
                      <label>{AGE_GROUPS.find(a => a.key === ag.age_group)?.label}</label>
                      <div className="input-with-coeff">
                        <input 
                          type="number"
                          min="0"
                          value={ag.patients_count}
                          onChange={(e) => updatePatientCount(docIndex, agIndex, e.target.value)}
                          placeholder="0"
                        />
                        <span className="coeff-badge">×{ag.coefficient}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="modal-actions">
              <button className="btn btn-success" onClick={handleManualSubmit}>
                ✓ Зберегти
              </button>
              <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                Скасувати
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PMGIncome;
