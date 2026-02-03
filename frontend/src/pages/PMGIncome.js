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

// Default age groups - will be loaded from settings
const DEFAULT_AGE_GROUPS = [
  { key: '0-5', label: 'від 0 до 5 років', coefficient: 2.465 },
  { key: '6-17', label: 'від 6 до 17 років', coefficient: 1.25 },
  { key: '18-39', label: 'від 18 до 39 років', coefficient: 0.616 },
  { key: '40-64', label: 'від 40 до 64 років', coefficient: 0.86 },
  { key: '65+', label: 'понад 65 років', coefficient: 1.3 }
];

const COLORS = ['#FF8C00', '#FFA500', '#FFB347', '#FFCC80', '#FFE0B2'];
const DOCTOR_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];

const PMGIncome = () => {
  const [declarations, setDeclarations] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedDoctorFilter, setSelectedDoctorFilter] = useState('all');
  
  // PMG Settings from database
  const [ageGroups, setAgeGroups] = useState(DEFAULT_AGE_GROUPS);
  const [capitationRate, setCapitationRate] = useState(1007.3);
  
  // Unified modal state
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  
  // Form state
  const [formDoctor, setFormDoctor] = useState('');
  const [formMonth, setFormMonth] = useState(new Date().getMonth() + 1);
  const [formYear, setFormYear] = useState(new Date().getFullYear());
  const [formCapitationRate, setFormCapitationRate] = useState(1007.3);
  const [formAgeGroups, setFormAgeGroups] = useState(
    DEFAULT_AGE_GROUPS.map(ag => ({
      age_group: ag.key,
      patients_count: 0,
      not_verified: 0,
      coefficient: ag.coefficient
    }))
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const [declRes, doctorsRes, settingsRes] = await Promise.all([
        axios.get(`${API_URL}/api/pmg-declarations`),
        axios.get(`${API_URL}/api/doctors`),
        axios.get(`${API_URL}/api/pmg-settings`)
      ]);
      setDeclarations(declRes.data || []);
      setDoctors(doctorsRes.data || []);
      
      // Load PMG settings
      if (settingsRes.data) {
        const ageCoefs = settingsRes.data.age_coefficients.map(c => ({
          key: c.age_group,
          label: c.label,
          coefficient: c.coefficient
        }));
        setAgeGroups(ageCoefs);
        setCapitationRate(settingsRes.data.capitation_rate);
        setFormCapitationRate(settingsRes.data.capitation_rate);
      }
      
      // Set default doctor
      if (doctorsRes.data.length > 0 && !formDoctor) {
        setFormDoctor(doctorsRes.data[0].id);
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

  // Filter declarations by period
  const filteredByPeriod = useMemo(() => {
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

  // Filter declarations - also filter doctors_data by selected doctor
  const filteredDeclarations = useMemo(() => {
    if (selectedDoctorFilter === 'all') {
      return filteredByPeriod;
    }
    
    // Filter doctors_data inside each declaration
    return filteredByPeriod.map(decl => ({
      ...decl,
      doctors_data: decl.doctors_data?.filter(doc => doc.doctor_id === selectedDoctorFilter) || [],
      total_patients: decl.doctors_data?.filter(doc => doc.doctor_id === selectedDoctorFilter)
        .reduce((sum, doc) => sum + (doc.total_patients || 0), 0) || 0,
      total_amount: decl.doctors_data?.filter(doc => doc.doctor_id === selectedDoctorFilter)
        .reduce((sum, doc) => sum + (doc.total_amount || 0), 0) || 0
    })).filter(decl => decl.doctors_data.length > 0);
  }, [filteredByPeriod, selectedDoctorFilter]);

  // Recalculate taxes for filtered data
  const filteredWithTaxes = useMemo(() => {
    return filteredDeclarations.map(decl => ({
      ...decl,
      total_ep: decl.total_amount * 0.05,
      total_vz: decl.total_amount * 0.01,
      net_amount: decl.total_amount * 0.94
    }));
  }, [filteredDeclarations]);

  // Calculate totals
  const totals = useMemo(() => {
    if (filteredWithTaxes.length === 0) return null;
    
    // Фінансові дані сумуються за всі періоди
    const totalAmount = filteredDeclarations.reduce((sum, d) => sum + d.total_amount, 0);
    const totalEP = filteredDeclarations.reduce((sum, d) => sum + d.total_ep, 0);
    const totalVZ = filteredDeclarations.reduce((sum, d) => sum + d.total_vz, 0);
    const netAmount = filteredDeclarations.reduce((sum, d) => sum + d.net_amount, 0);
    
    // Кількість декларацій - тільки з останнього періоду (сума по всіх лікарях)
    // Знаходимо останній період
    const latestDeclaration = filteredDeclarations[0]; // вже відсортовано від нового до старого
    const latestMonth = latestDeclaration.month;
    const latestYear = latestDeclaration.year;
    
    // Сумуємо декларації тільки за останній період (по всіх лікарях)
    const latestPeriodDeclarations = filteredDeclarations.filter(
      d => d.month === latestMonth && d.year === latestYear
    );
    const totalPatients = latestPeriodDeclarations.reduce((sum, d) => sum + d.total_patients, 0);
    
    return { 
      totalPatients, 
      totalAmount, 
      totalEP, 
      totalVZ, 
      netAmount,
      latestPeriod: `${MONTH_NAMES[latestMonth - 1]} ${latestYear}`
    };
  }, [filteredDeclarations]);

  // Data for charts - використовуємо тільки останній період для кількості декларацій
  const latestPeriodDeclarations = useMemo(() => {
    if (filteredDeclarations.length === 0) return [];
    
    const latest = filteredDeclarations[0];
    return filteredDeclarations.filter(
      d => d.month === latest.month && d.year === latest.year
    );
  }, [filteredDeclarations]);

  const ageGroupChartData = useMemo(() => {
    if (latestPeriodDeclarations.length === 0) return [];
    
    const grouped = {};
    ageGroups.forEach(ag => {
      grouped[ag.key] = { name: ag.label, patients: 0, amount: 0 };
    });
    
    latestPeriodDeclarations.forEach(decl => {
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
  }, [latestPeriodDeclarations, ageGroups]);

  const doctorChartData = useMemo(() => {
    if (latestPeriodDeclarations.length === 0) return [];
    
    const grouped = {};
    
    latestPeriodDeclarations.forEach(decl => {
      decl.doctors_data?.forEach(doc => {
        if (!grouped[doc.doctor_name]) {
          grouped[doc.doctor_name] = { name: doc.doctor_name, patients: 0, amount: 0 };
        }
        grouped[doc.doctor_name].patients += doc.total_patients || 0;
        grouped[doc.doctor_name].amount += doc.total_amount || 0;
      });
    });
    
    return Object.values(grouped);
  }, [latestPeriodDeclarations]);

  // Reset form when opening modal
  const openEntryModal = () => {
    setEditMode(false);
    setFormAgeGroups(ageGroups.map(ag => ({
      age_group: ag.key,
      patients_count: 0,
      not_verified: 0,
      coefficient: ag.coefficient
    })));
    setFormCapitationRate(capitationRate);
    if (doctors.length > 0) {
      setFormDoctor(doctors[0].id);
    }
    setFormMonth(new Date().getMonth() + 1);
    setFormYear(new Date().getFullYear());
    setShowEntryModal(true);
  };

  // Open edit modal with existing data
  const openEditModal = async (month, year, doctorId) => {
    try {
      const response = await axios.get(`${API_URL}/api/pmg-declarations/${month}/${year}/${doctorId}`);
      const data = response.data;
      
      setEditMode(true);
      setFormDoctor(doctorId);
      setFormMonth(month);
      setFormYear(year);
      setFormCapitationRate(data.capitation_rate);
      
      // Load age groups data with current coefficients
      const ageGroupsData = ageGroups.map(ag => {
        const existingGroup = data.doctor_data.age_groups?.find(g => g.age_group === ag.key);
        return {
          age_group: ag.key,
          patients_count: existingGroup?.patients_count || 0,
          not_verified: existingGroup?.not_verified || 0,
          coefficient: ag.coefficient
        };
      });
      
      setFormAgeGroups(ageGroupsData);
      setShowEntryModal(true);
    } catch (error) {
      console.error('Load error:', error);
      alert('Помилка завантаження даних');
    }
  };

  // Delete doctor data from declaration
  const handleDelete = async (month, year, doctorId, doctorName) => {
    if (!window.confirm(`Видалити дані лікаря ${doctorName} за ${MONTH_NAMES[month - 1]} ${year}?`)) {
      return;
    }
    
    try {
      await axios.delete(`${API_URL}/api/pmg-declarations/${month}/${year}/${doctorId}`);
      loadData();
      alert('✅ Дані видалено!');
    } catch (error) {
      console.error('Delete error:', error);
      alert('Помилка видалення');
    }
  };

  // Handle Image upload
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!formDoctor) {
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
        
        // Update age groups for selected doctor
        const newAgeGroups = ageGroups.map(ag => {
          const parsedGroup = parsed.age_groups?.find(pg => pg.age_group === ag.key);
          return {
            age_group: ag.key,
            patients_count: parsedGroup?.patients_count || 0,
            not_verified: 0,
            coefficient: ag.coefficient
          };
        });
        
        setFormAgeGroups(newAgeGroups);
        
        const totalPatients = newAgeGroups.reduce((sum, ag) => sum + ag.patients_count, 0);
        const doctorName = doctors.find(d => d.id === formDoctor)?.name || '';
        
        alert(`✅ Зображення проаналізовано!\n\nЛікар: ${doctorName}\nЗнайдено: ${totalPatients} декларацій\n\nПеревірте дані та збережіть.`);
      } else {
        alert('Помилка аналізу: ' + (response.data.error || 'Невідома помилка'));
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Помилка завантаження');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // Update patient count
  const updatePatientCount = (index, value) => {
    const newGroups = [...formAgeGroups];
    newGroups[index].patients_count = parseInt(value) || 0;
    setFormAgeGroups(newGroups);
  };

  // Update not verified count
  const updateNotVerifiedCount = (index, value) => {
    const newGroups = [...formAgeGroups];
    newGroups[index].not_verified = parseFloat(value) || 0;
    setFormAgeGroups(newGroups);
  };

  // Save declaration
  const handleSave = async () => {
    if (!formDoctor) {
      alert('Оберіть лікаря');
      return;
    }
    
    const totalPatients = formAgeGroups.reduce((sum, ag) => sum + ag.patients_count, 0);
    if (totalPatients === 0) {
      alert('Введіть кількість декларацій');
      return;
    }
    
    const doctorName = doctors.find(d => d.id === formDoctor)?.name || '';
    
    try {
      // Check if declaration exists for this month/year
      const existingRes = await axios.get(`${API_URL}/api/pmg-declarations/${formMonth}/${formYear}`);
      
      let doctorsData = [];
      
      if (existingRes.data.exists) {
        // Update existing declaration
        doctorsData = existingRes.data.data.doctors_data.filter(d => d.doctor_id !== formDoctor);
      }
      
      // Add/update selected doctor's data
      doctorsData.push({
        doctor_id: formDoctor,
        doctor_name: doctorName,
        age_groups: formAgeGroups
      });
      
      await axios.post(`${API_URL}/api/pmg-declarations`, {
        month: formMonth,
        year: formYear,
        capitation_rate: formCapitationRate,
        doctors_data: doctorsData
      });
      
      setShowEntryModal(false);
      loadData();
      alert(`✅ Дані збережено для ${doctorName}!`);
    } catch (error) {
      console.error('Save error:', error);
      alert('Помилка збереження');
    }
  };

  // Available years
  const availableYears = useMemo(() => {
    const years = [...new Set(declarations.map(d => d.year))];
    if (!years.includes(new Date().getFullYear())) {
      years.push(new Date().getFullYear());
    }
    return years.sort((a, b) => b - a);
  }, [declarations]);

  // Get selected doctor name
  const selectedDoctorName = doctors.find(d => d.id === formDoctor)?.name || '';

  // Calculate form totals (all patients, including unverified)
  const formTotalPatients = formAgeGroups.reduce((sum, ag) => sum + ag.patients_count, 0);

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
        <button 
          className="btn btn-primary"
          onClick={openEntryModal}
          data-testid="add-declaration-btn"
        >
          + Додати дані
        </button>
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
        
        {doctors.length > 0 && (
          <div className="filter-group">
            <label>👨‍⚕️ Лікар:</label>
            <div className="chips-group">
              <button 
                className={`chip ${selectedDoctorFilter === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedDoctorFilter('all')}
              >
                Всі лікарі
              </button>
              {doctors.map(doctor => (
                <button
                  key={doctor.id}
                  className={`chip ${selectedDoctorFilter === doctor.id ? 'active' : ''}`}
                  onClick={() => setSelectedDoctorFilter(doctor.id)}
                  data-testid={`doctor-filter-${doctor.id}`}
                >
                  {doctor.name}
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
              <div className="kpi-period">на {totals.latestPeriod}</div>
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
                    formatter={(value) => [value.toLocaleString('uk-UA'), 'Пацієнтів']}
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
                      label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                    >
                      {doctorChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={DOCTOR_COLORS[index % DOCTOR_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value) => [value.toLocaleString('uk-UA'), 'Пацієнтів']}
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
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <h3>Немає даних</h3>
          <p>Додайте дані про декларації вручну або завантажте скріншот з дашборду НСЗУ</p>
          <button className="btn btn-primary" onClick={openEntryModal}>
            + Додати дані
          </button>
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
                  <th>Лікар</th>
                  <th>Пацієнтів</th>
                  <th>Сума</th>
                  <th>ЄП (5%)</th>
                  <th>ВЗ (1%)</th>
                  <th>Чистий дохід</th>
                  <th>Дії</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeclarations.map(decl => 
                  decl.doctors_data?.map(doctor => (
                    <tr key={`${decl.id}-${doctor.doctor_id}`}>
                      <td><strong>{MONTH_NAMES[decl.month - 1]} {decl.year}</strong></td>
                      <td>{doctor.doctor_name}</td>
                      <td>{doctor.total_patients.toLocaleString('uk-UA')}</td>
                      <td className="amount-cell">{doctor.total_amount.toLocaleString('uk-UA')} ₴</td>
                      <td>{(doctor.total_amount * 0.05).toLocaleString('uk-UA')} ₴</td>
                      <td>{(doctor.total_amount * 0.01).toLocaleString('uk-UA')} ₴</td>
                      <td className="highlight-cell">{(doctor.total_amount * 0.94).toLocaleString('uk-UA')} ₴</td>
                      <td>
                        <div className="action-buttons">
                          <button 
                            className="action-btn edit"
                            onClick={() => openEditModal(decl.month, decl.year, doctor.doctor_id)}
                            title="Редагувати"
                          >
                            ✏️
                          </button>
                          <button 
                            className="action-btn delete"
                            onClick={() => handleDelete(decl.month, decl.year, doctor.doctor_id, doctor.doctor_name)}
                            title="Видалити"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Unified Entry Modal */}
      <Dialog open={showEntryModal} onOpenChange={setShowEntryModal}>
        <DialogContent className="max-w-lg entry-modal max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editMode ? '✏️ Редагування даних декларацій' : '📝 Внесення даних декларацій'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="entry-modal-content">
            {/* Doctor Selection */}
            <div className="entry-section">
              <label className="entry-label">👨‍⚕️ Лікар</label>
              <select 
                value={formDoctor} 
                onChange={(e) => setFormDoctor(e.target.value)}
                className="entry-select"
                disabled={editMode}
              >
                {doctors.map(doc => (
                  <option key={doc.id} value={doc.id}>{doc.name}</option>
                ))}
              </select>
            </div>

            {/* Period Selection */}
            <div className="entry-row">
              <div className="entry-section">
                <label className="entry-label">📅 Місяць</label>
                <select 
                  value={formMonth} 
                  onChange={(e) => setFormMonth(parseInt(e.target.value))}
                  className="entry-select"
                  disabled={editMode}
                >
                  {MONTH_NAMES.map((name, i) => (
                    <option key={i} value={i + 1}>{name}</option>
                  ))}
                </select>
              </div>
              <div className="entry-section">
                <label className="entry-label">📅 Рік</label>
                <input 
                  type="number"
                  value={formYear}
                  onChange={(e) => setFormYear(parseInt(e.target.value))}
                  className="entry-input"
                  disabled={editMode}
                />
              </div>
            </div>

            {/* Upload Image - only in add mode */}
            {!editMode && (
              <div className="entry-section">
                <label className="entry-label">📷 Завантажити скріншот НСЗУ</label>
                <label className={`upload-btn ${uploading ? 'uploading' : ''}`}>
                  <input 
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploading}
                  />
                  {uploading ? (
                    <span>🤖 AI аналізує...</span>
                  ) : (
                    <span>📷 Обрати зображення</span>
                  )}
                </label>
                <p className="upload-hint-small">AI автоматично заповнить дані з скріншоту</p>
              </div>
            )}

            {/* Divider */}
            <div className="entry-divider">
              <span>{editMode ? 'Оновити дані' : 'або введіть вручну'}</span>
            </div>

            {/* Age Groups */}
            <div className="entry-section">
              <label className="entry-label">👥 Кількість декларацій за віком</label>
              <div className="age-groups-list">
                {formAgeGroups.map((ag, index) => (
                  <div key={ag.age_group} className="age-group-row-extended">
                    <div className="age-group-info">
                      <span className="age-label">{ageGroups[index]?.label || ag.age_group}</span>
                      <span className="age-coeff">×{ag.coefficient}</span>
                    </div>
                    <div className="age-inputs-group-simple">
                      <div className="age-input-wrapper-large">
                        <label className="input-micro-label">Декларацій</label>
                        <input 
                          type="number"
                          min="0"
                          value={ag.patients_count || ''}
                          onChange={(e) => updatePatientCount(index, e.target.value)}
                          placeholder="0"
                          className="age-input"
                        />
                      </div>
                      <div className="age-input-wrapper-large">
                        <label className="input-micro-label">Неверифіковані</label>
                        <input 
                          type="number"
                          min="0"
                          step="0.1"
                          max={ag.patients_count}
                          value={ag.not_verified || ''}
                          onChange={(e) => updateNotVerifiedCount(index, e.target.value)}
                          placeholder="0"
                          className="age-input warning-subtle"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="input-hint">
                💡 Неверифіковані декларації враховуються в загальній кількості, але не оплачуються
              </p>
            </div>

            {/* Total */}
            {formTotalPatients > 0 && (
              <div className="entry-total">
                <span>Всього декларацій:</span>
                <strong>{formTotalPatients.toLocaleString('uk-UA')}</strong>
              </div>
            )}

            {/* Actions */}
            <div className="entry-actions">
              <button 
                className="btn btn-success"
                onClick={handleSave}
                disabled={formTotalPatients === 0}
              >
                {editMode ? '✓ Оновити' : '✓ Зберегти'}
              </button>
              <button 
                className="btn btn-secondary"
                onClick={() => setShowEntryModal(false)}
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

export default PMGIncome;
