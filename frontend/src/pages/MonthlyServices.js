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

  const getRevenueBreakdown = () => {
    const serviceStats = {};
    const doctorStats = {};
    const monthlyStats = {};
    
    filteredEntries.forEach(entry => {
      const service = services.find(s => s.id === entry.service_id);
      const doctor = doctors.find(d => d.id === entry.doctor_id);
      
      // По послугах
      const serviceKey = entry.service_id;
      if (!serviceStats[serviceKey]) {
        serviceStats[serviceKey] = {
          code: service?.code || '',
          name: service?.name || '',
          price: service?.price || 0,
          quantity: 0,
          revenue: 0
        };
      }
      serviceStats[serviceKey].quantity += entry.quantity;
      serviceStats[serviceKey].revenue += entry.total_revenue;
      
      // По лікарях
      if (doctor) {
        if (!doctorStats[entry.doctor_id]) {
          doctorStats[entry.doctor_id] = {
            name: doctor.name,
            short_name: doctor.short_name,
            revenue: 0,
            quantity: 0
          };
        }
        doctorStats[entry.doctor_id].revenue += entry.total_revenue;
        doctorStats[entry.doctor_id].quantity += entry.quantity;
      }
      
      // По місяцях
      const monthKey = `${entry.year}-${String(entry.month).padStart(2, '0')}`;
      if (!monthlyStats[monthKey]) {
        monthlyStats[monthKey] = {
          month: entry.month,
          year: entry.year,
          revenue: 0
        };
      }
      monthlyStats[monthKey].revenue += entry.total_revenue;
    });
    
    const servicesArray = Object.values(serviceStats).sort((a, b) => b.revenue - a.revenue);
    const byQuantity = [...servicesArray].sort((a, b) => b.quantity - a.quantity);
    const doctorsArray = Object.values(doctorStats);
    const monthlyArray = Object.values(monthlyStats).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
    
    const avgCheck = (dashboardStats?.total_quantity || 0) > 0 
      ? (dashboardStats?.total_revenue || 0) / dashboardStats.total_quantity 
      : 0;
    
    // Порівняння з попереднім місяцем
    let comparison = null;
    if (monthlyArray.length >= 2) {
      const current = monthlyArray[monthlyArray.length - 1];
      const previous = monthlyArray[monthlyArray.length - 2];
      const change = ((current.revenue - previous.revenue) / previous.revenue) * 100;
      comparison = {
        currentMonth: monthNames[current.month - 1],
        currentRevenue: current.revenue,
        previousMonth: monthNames[previous.month - 1],
        previousRevenue: previous.revenue,
        change: change,
        trend: change > 0 ? 'up' : 'down',
        isPositive: change > 0
      };
    }
    
    return {
      top5: servicesArray.slice(0, 5),
      topByQuantity: byQuantity.slice(0, 5),
      allServices: servicesArray,
      doctors: doctorsArray,
      monthly: monthlyArray,
      avgCheck,
      comparison
    };
  };

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    
    // Sheet 1: Детальний breakdown
    const detailedData = [
      [
        'Код', 'Назва послуги', 'Лікар', 'Місяць', 'Рік', 'Кількість',
        'Ціна', 'Сума послуг', 'Витрати', 'ЄП (5%)', 'ВЗ (1%)', 
        'До розподілу', 'Дохід лікаря', 'Дохід організації'
      ]
    ];
    
    let totalQuantity = 0;
    let totalRevenue = 0;
    let totalExpenses = 0;
    let totalEP = 0;
    let totalVZ = 0;
    let totalToDistribute = 0;
    let totalDoctorIncome = 0;
    let totalOrgIncome = 0;
    
    filteredEntries.forEach(entry => {
      const service = services.find(s => s.id === entry.service_id);
      const doctor = doctors.find(d => d.id === entry.doctor_id);
      
      const ep = entry.total_revenue * 0.05;
      const vz = entry.total_revenue * 0.01;
      const toDistribute = entry.total_revenue - entry.total_expenses - ep - vz;
      
      detailedData.push([
        service?.code || '',
        service?.name || '',
        doctor?.name || '',
        monthNames[entry.month - 1],
        entry.year,
        entry.quantity,
        service?.price || 0,
        entry.total_revenue,
        entry.total_expenses,
        ep,
        vz,
        toDistribute,
        entry.doctor_income,
        entry.fop_income
      ]);
      
      totalQuantity += entry.quantity;
      totalRevenue += entry.total_revenue;
      totalExpenses += entry.total_expenses;
      totalEP += ep;
      totalVZ += vz;
      totalToDistribute += toDistribute;
      totalDoctorIncome += entry.doctor_income;
      totalOrgIncome += entry.fop_income;
    });
    
    // ВСЬОГО рядок
    detailedData.push([
      '', 'ВСЬОГО:', '', '', '',
      totalQuantity,
      '',
      totalRevenue,
      totalExpenses,
      totalEP,
      totalVZ,
      totalToDistribute,
      totalDoctorIncome,
      totalOrgIncome
    ]);
    
    const ws1 = XLSX.utils.aoa_to_sheet(detailedData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Детальний звіт');
    
    // Sheet 2: По послугах
    const breakdown = getRevenueBreakdown();
    const servicesData = [
      ['Код', 'Назва', 'Кількість', 'Сума', '% від загального']
    ];
    
    let servicesTotal = 0;
    let quantityTotal = 0;
    
    breakdown.allServices.forEach(service => {
      const percent = (service.revenue / dashboardStats.total_revenue * 100).toFixed(1);
      servicesData.push([
        service.code,
        service.name,
        service.quantity,
        service.revenue,
        `${percent}%`
      ]);
      servicesTotal += service.revenue;
      quantityTotal += service.quantity;
    });
    
    servicesData.push(['', 'ВСЬОГО:', quantityTotal, servicesTotal, '100%']);
    
    const ws2 = XLSX.utils.aoa_to_sheet(servicesData);
    XLSX.utils.book_append_sheet(wb, ws2, 'По послугах');
    
    // Sheet 3: По лікарях
    if (breakdown.doctors.length > 0) {
      const doctorsData = [
        ['Лікар', 'Сума послуг', 'Кількість', '% від загального']
      ];
      
      let doctorsRevTotal = 0;
      let doctorsQtyTotal = 0;
      
      breakdown.doctors.forEach(doctor => {
        const percent = (doctor.revenue / dashboardStats.total_revenue * 100).toFixed(1);
        doctorsData.push([
          doctor.name,
          doctor.revenue,
          doctor.quantity,
          `${percent}%`
        ]);
        doctorsRevTotal += doctor.revenue;
        doctorsQtyTotal += doctor.quantity;
      });
      
      doctorsData.push(['ВСЬОГО:', doctorsRevTotal, doctorsQtyTotal, '100%']);
      
      const ws3 = XLSX.utils.aoa_to_sheet(doctorsData);
      XLSX.utils.book_append_sheet(wb, ws3, 'По лікарях');
    }
    
    // Sheet 4: По місяцях
    if (breakdown.monthly.length > 0) {
      const monthlyData = [
        ['Місяць', 'Рік', 'Сума послуг']
      ];
      
      let monthlyTotal = 0;
      
      breakdown.monthly.forEach(item => {
        monthlyData.push([
          monthNames[item.month - 1],
          item.year,
          item.revenue
        ]);
        monthlyTotal += item.revenue;
      });
      
      monthlyData.push(['ВСЬОГО:', '', monthlyTotal]);
      
      const ws4 = XLSX.utils.aoa_to_sheet(monthlyData);
      XLSX.utils.book_append_sheet(wb, ws4, 'По місяцях');
    }
    
    const fileName = `Статистика_Оборот_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const calculateExpensesBreakdown = () => {
    const materialsMap = {};
    let totalEP = 0;
    let totalVZ = 0;
    
    filteredEntries.forEach(entry => {
      const service = services.find(s => s.id === entry.service_id);
      
      if (service?.expense_items) {
        service.expense_items.forEach(item => {
          if (!materialsMap[item.material_name]) {
            materialsMap[item.material_name] = {
              material_name: item.material_name,
              unit: item.unit,
              total_quantity: 0,
              total_cost: 0
            };
          }
          
          materialsMap[item.material_name].total_quantity += item.quantity * entry.quantity;
          materialsMap[item.material_name].total_cost += item.total_cost * entry.quantity;
        });
      }
      
      totalEP += entry.total_revenue * 0.05;
      totalVZ += entry.total_revenue * 0.01;
    });
    
    const materials = Object.values(materialsMap).sort((a, b) => b.total_cost - a.total_cost);
    const totalMaterials = materials.reduce((sum, m) => sum + m.total_cost, 0);
    
    return { materials, totalMaterials, totalEP, totalVZ, totalExpenses: totalMaterials + totalEP + totalVZ };
  };

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
        <h1>💳 Платні послуги</h1>
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
              <div className="summary-label">Наданих послуг</div>
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
                      <span>Сума:</span>
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
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto revenue-modal">
          <DialogHeader>
            <DialogTitle>💰 Детальна статистика наданих послуг</DialogTitle>
          </DialogHeader>
          <div className="revenue-details">
            <div className="export-buttons">
              <button className="btn btn-secondary btn-sm" onClick={exportToExcel}>
                📊 Експорт Excel
              </button>
            </div>

            {dashboardStats && (() => {
              const breakdown = getRevenueBreakdown();
              return (
                <>
                  <div className="details-summary-row">
                    <div className="detail-card-mini">
                      <div className="mini-label">Наданих послуг</div>
                      <div className="mini-value">{dashboardStats.total_revenue.toLocaleString('uk-UA')} ₴</div>
                    </div>
                    <div className="detail-card-mini">
                      <div className="mini-label">Послуг</div>
                      <div className="mini-value">{dashboardStats.total_quantity}</div>
                    </div>
                    <div className="detail-card-mini highlight-mini">
                      <div className="mini-label">Середній чек</div>
                      <div className="mini-value">{breakdown.avgCheck.toFixed(0)} ₴</div>
                    </div>
                    {breakdown.comparison && (
                      <div className={`detail-card-mini ${breakdown.comparison.isPositive ? 'success-mini' : 'danger-mini'}`}>
                        <div className="mini-label">Динаміка</div>
                        <div className="mini-value">
                          {breakdown.comparison.trend === 'up' ? '↗' : '↘'} {Math.abs(breakdown.comparison.change).toFixed(1)}%
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Порівняння з попереднім місяцем */}
                  {breakdown.comparison && (
                    <div className={`comparison-alert ${breakdown.comparison.isPositive ? 'positive-alert' : 'negative-alert'}`}>
                      <div className="comparison-icon">
                        {breakdown.comparison.isPositive ? '📈' : '📉'}
                      </div>
                      <div className="comparison-text">
                        <strong>
                          {breakdown.comparison.isPositive ? 'Позитивна динаміка!' : 'Негативна динаміка'}
                        </strong>
                        <p>
                          {breakdown.comparison.currentMonth}: {breakdown.comparison.currentRevenue.toLocaleString('uk-UA')} ₴ 
                          {' '}({breakdown.comparison.isPositive ? 'більше' : 'менше'} на{' '}
                          {Math.abs(breakdown.comparison.change).toFixed(1)}% ніж{' '}
                          {breakdown.comparison.previousMonth}: {breakdown.comparison.previousRevenue.toLocaleString('uk-UA')} ₴)
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Топ-5 за оборотом */}
                  <div className="details-section">
                    <h4>🏆 Топ-5 послуг за оборотом</h4>
                    <div className="top-services-list">
                      {breakdown.top5.map((service, index) => (
                        <div key={service.code} className="top-service-item">
                          <div className="top-rank">#{index + 1}</div>
                          <div className="top-service-info">
                            <div className="top-service-name">
                              <span className="service-code-badge-small">{service.code}</span>
                              {service.name}
                            </div>
                            <div className="top-service-stats">
                              {service.quantity} шт × {service.price}₴ = <strong>{service.revenue.toLocaleString('uk-UA')} ₴</strong>
                            </div>
                          </div>
                          <div className="top-service-percent">
                            {((service.revenue / dashboardStats.total_revenue) * 100).toFixed(1)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Популярність за кількістю */}
                  <div className="details-section">
                    <h4>📊 Найпопулярніші (за кількістю)</h4>
                    <div className="popularity-grid">
                      {breakdown.topByQuantity.map((service, index) => (
                        <div key={service.code} className="popularity-item">
                          <div className="pop-rank">#{index + 1}</div>
                          <div className="pop-info">
                            <div className="pop-name">
                              <span className="service-code-badge-small">{service.code}</span>
                              {service.name}
                            </div>
                            <div className="pop-count"><strong>{service.quantity}</strong> шт</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Розподіл по лікарях */}
                  {breakdown.doctors.length > 1 && (
                    <div className="details-section">
                      <h4>👥 Розподіл по лікарях</h4>
                      <div className="doctors-breakdown">
                        {breakdown.doctors.map(doctor => (
                          <div key={doctor.short_name} className="doctor-revenue-card">
                            <div className="doctor-header">
                              <div className="doctor-name-badge">{doctor.short_name}</div>
                              <div className="doctor-full-name">{doctor.name}</div>
                            </div>
                            <div className="doctor-stats-row">
                              <div className="doctor-stat">
                                <span>Оборот:</span>
                                <strong>{doctor.revenue.toLocaleString('uk-UA')} ₴</strong>
                              </div>
                              <div className="doctor-stat">
                                <span>Послуг:</span>
                                <strong>{doctor.quantity} шт</strong>
                              </div>
                              <div className="doctor-stat highlight">
                                <span>%:</span>
                                <strong>{((doctor.revenue / dashboardStats.total_revenue) * 100).toFixed(1)}%</strong>
                              </div>
                            </div>
                            <div className="progress-bar-container">
                              <div 
                                className="progress-bar-fill" 
                                style={{ width: `${(doctor.revenue / dashboardStats.total_revenue) * 100}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Динаміка по місяцях */}
                  {breakdown.monthly.length > 0 && (
                    <div className="details-section">
                      <h4>📈 Динаміка по місяцях</h4>
                      <div className="monthly-chart">
                        {breakdown.monthly.map(item => (
                          <div key={`${item.year}-${item.month}`} className="month-bar-item">
                            <div className="month-label">{monthNames[item.month - 1]} {item.year}</div>
                            <div className="month-bar-container">
                              <div 
                                className="month-bar-fill" 
                                style={{ 
                                  width: `${(item.revenue / Math.max(...breakdown.monthly.map(m => m.revenue))) * 100}%` 
                                }}
                              />
                              <span className="month-bar-value">{item.revenue.toLocaleString('uk-UA')} ₴</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal ДОХІД ЛІКАРІВ */}
      <Dialog open={showDoctorIncomeModal} onOpenChange={setShowDoctorIncomeModal}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto revenue-modal">
          <DialogHeader>
            <DialogTitle>
              👨‍⚕️ {selectedDoctor !== 'all' && doctors.find(d => d.id === selectedDoctor)
                ? `Дохід ${doctors.find(d => d.id === selectedDoctor)?.name}`
                : 'Дохід лікарів'
              }
            </DialogTitle>
          </DialogHeader>
          <div className="revenue-details">
            {dashboardStats && (
              <div className="details-section">
                <div className="doctor-income-table-wrapper">
                  <table className="doctor-income-table">
                    <thead>
                      <tr>
                        <th>Місяць</th>
                        <th>К-ть</th>
                        <th>Сума</th>
                        <th>Витрати</th>
                        <th>ЄП (5%)</th>
                        <th>ВЗ (1%)</th>
                        <th>До розподілу</th>
                        <th>Дохід лікаря</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEntries.map(entry => {
                        const ep = entry.total_revenue * 0.05;
                        const vz = entry.total_revenue * 0.01;
                        const toDistribute = entry.total_revenue - entry.total_expenses - ep - vz;
                        return (
                          <tr key={entry.id}>
                            <td><strong>{monthNames[entry.month - 1]} {entry.year}</strong></td>
                            <td>{entry.quantity}</td>
                            <td className="revenue-cell">{entry.total_revenue.toLocaleString('uk-UA')} ₴</td>
                            <td>{entry.total_expenses.toLocaleString('uk-UA')} ₴</td>
                            <td>{ep.toLocaleString('uk-UA')} ₴</td>
                            <td>{vz.toLocaleString('uk-UA')} ₴</td>
                            <td className="highlight-cell">{toDistribute.toLocaleString('uk-UA')} ₴</td>
                            <td className="income-cell"><strong>{entry.doctor_income.toLocaleString('uk-UA')} ₴</strong></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal ВИТРАТИ */}
      <Dialog open={showExpensesModal} onOpenChange={setShowExpensesModal}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto revenue-modal">
          <DialogHeader>
            <DialogTitle>📉 Детальна статистика витрат</DialogTitle>
          </DialogHeader>
          <div className="revenue-details">
            {(() => {
              const expensesData = calculateExpensesBreakdown();
              return (
                <>
                  <div className="details-summary-row">
                    <div className="detail-card-mini">
                      <div className="mini-label">Витрати на матеріали</div>
                      <div className="mini-value">{expensesData.totalMaterials.toLocaleString('uk-UA')} ₴</div>
                    </div>
                    <div className="detail-card-mini">
                      <div className="mini-label">ЄП (5%)</div>
                      <div className="mini-value">{expensesData.totalEP.toLocaleString('uk-UA')} ₴</div>
                    </div>
                    <div className="detail-card-mini">
                      <div className="mini-label">ВЗ (1%)</div>
                      <div className="mini-value">{expensesData.totalVZ.toLocaleString('uk-UA')} ₴</div>
                    </div>
                    <div className="detail-card-mini highlight-mini">
                      <div className="mini-label">Всього</div>
                      <div className="mini-value">{expensesData.totalExpenses.toLocaleString('uk-UA')} ₴</div>
                    </div>
                  </div>

                  <div className="details-section">
                    <h4>💸 Топ-10 матеріалів (агреговано)</h4>
                    <div className="materials-table-wrapper">
                      <table className="materials-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Назва матеріалу</th>
                            <th>Од.</th>
                            <th>К-ть</th>
                            <th>Сума</th>
                            <th>%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {expensesData.materials.slice(0, 10).map((material, index) => (
                            <tr key={material.material_name}>
                              <td>{index + 1}</td>
                              <td><strong>{material.material_name}</strong></td>
                              <td>{material.unit}</td>
                              <td>{material.total_quantity.toFixed(1)}</td>
                              <td className="revenue-cell">{material.total_cost.toLocaleString('uk-UA')} ₴</td>
                              <td>{((material.total_cost / expensesData.totalMaterials) * 100).toFixed(1)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="details-section">
                    <h4>🧾 Податки</h4>
                    <div className="taxes-breakdown">
                      <div className="tax-item">
                        <div className="tax-label">Єдиний податок (ЄП) - 5%</div>
                        <div className="tax-value">{expensesData.totalEP.toLocaleString('uk-UA')} ₴</div>
                        <div className="tax-note">Розраховано від загального обороту</div>
                      </div>
                      <div className="tax-item">
                        <div className="tax-label">Військовий збір (ВЗ) - 1%</div>
                        <div className="tax-value">{expensesData.totalVZ.toLocaleString('uk-UA')} ₴</div>
                        <div className="tax-note">Розраховано від загального обороту</div>
                      </div>
                      <div className="tax-item total-tax">
                        <div className="tax-label">Разом податки</div>
                        <div className="tax-value">{(expensesData.totalEP + expensesData.totalVZ).toLocaleString('uk-UA')} ₴</div>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MonthlyServices;
