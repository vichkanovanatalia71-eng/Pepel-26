import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
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
  
  // Фільтри
  const [selectedDoctor, setSelectedDoctor] = useState('all');
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRevenueModal, setShowRevenueModal] = useState(false);
  const [modalDoctor, setModalDoctor] = useState('');
  const [modalMonth, setModalMonth] = useState(new Date().getMonth() + 1);
  const [modalYear, setModalYear] = useState(new Date().getFullYear());
  const [quantities, setQuantities] = useState({});
  const [revenueDetails, setRevenueDetails] = useState(null);

  const monthNames = [
    'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
    'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'
  ];

  // Initial load
  useEffect(() => {
    loadData();
  }, []);

  // Filter when filters change
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

  const openRevenueDetails = () => {
    try {
      const serviceBreakdown = {};
      const doctorBreakdown = {};
      const monthlyBreakdown = {};
      
      filteredEntries.forEach(entry => {
        const service = services.find(s => s.id === entry.service_id);
        const doctor = doctors.find(d => d.id === entry.doctor_id);
        
        // По послугах
        if (!serviceBreakdown[entry.service_id]) {
          serviceBreakdown[entry.service_id] = {
            code: service?.code || 'N/A',
            name: service?.name || 'N/A',
            price: service?.price || 0,
            quantity: 0,
            revenue: 0
          };
        }
        serviceBreakdown[entry.service_id].quantity += entry.quantity;
        serviceBreakdown[entry.service_id].revenue += entry.total_revenue;
        
        // По лікарях
        const docKey = entry.doctor_id;
        if (!doctorBreakdown[docKey]) {
          doctorBreakdown[docKey] = {
            name: doctor?.name || 'N/A',
            short_name: doctor?.short_name || 'N/A',
            revenue: 0,
            quantity: 0
          };
        }
        doctorBreakdown[docKey].revenue += entry.total_revenue;
        doctorBreakdown[docKey].quantity += entry.quantity;
        
        // По місяцях
        const monthKey = `${entry.year}-${entry.month}`;
        if (!monthlyBreakdown[monthKey]) {
          monthlyBreakdown[monthKey] = {
            month: entry.month,
            year: entry.year,
            revenue: 0
          };
        }
        monthlyBreakdown[monthKey].revenue += entry.total_revenue;
      });
      
      const servicesArray = Object.values(serviceBreakdown).sort((a, b) => b.revenue - a.revenue);
      const top5Services = servicesArray.slice(0, 5);
      const topByQuantity = [...servicesArray].sort((a, b) => b.quantity - a.quantity).slice(0, 5);
      const doctorsArray = Object.values(doctorBreakdown);
      const monthlyArray = Object.values(monthlyBreakdown).sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      });
      
      const avgCheck = dashboardStats?.total_quantity > 0 
        ? dashboardStats.total_revenue / dashboardStats.total_quantity 
        : 0;
      
      let comparison = null;
      if (monthlyArray.length >= 2) {
        const current = monthlyArray[monthlyArray.length - 1].revenue;
        const previous = monthlyArray[monthlyArray.length - 2].revenue;
        const change = ((current - previous) / previous) * 100;
        comparison = {
          current,
          previous,
          change,
          trend: change > 0 ? 'up' : 'down'
        };
      }
      
      setRevenueDetails({
        servicesBreakdown: servicesArray,
        top5Services,
        topByQuantity,
        doctorsBreakdown: doctorsArray,
        monthlyBreakdown: monthlyArray,
        avgCheck,
        comparison
      });
      
      setShowRevenueModal(true);
    } catch (error) {
      console.error('Error opening revenue details:', error);
      alert('Помилка відкриття статистики');
    }
  };

  const resetFilters = () => {
    setSelectedDoctor('all');
    setSelectedYear('all');
    setSelectedMonth('all');
  };

  const exportToExcel = () => {
    if (!revenueDetails || !dashboardStats) return;
    
    // Створення Excel файлу
    const wb = XLSX.utils.book_new();
    
    // Sheet 1: Breakdown по послугах
    const servicesData = [
      ['Код', 'Назва послуги', 'Ціна', 'Кількість', 'Оборот', '% від загального']
    ];
    
    revenueDetails.servicesBreakdown.forEach(service => {
      const percent = ((service.revenue / dashboardStats.total_revenue) * 100).toFixed(1);
      servicesData.push([
        service.code,
        service.name,
        service.price,
        service.quantity,
        service.revenue,
        `${percent}%`
      ]);
    });
    
    const ws1 = XLSX.utils.aoa_to_sheet(servicesData);
    XLSX.utils.book_append_sheet(wb, ws1, 'По послугах');
    
    // Sheet 2: По лікарях (якщо є)
    if (revenueDetails.doctorsBreakdown.length > 0) {
      const doctorsData = [
        ['Лікар', 'Оборот', 'Кількість послуг', '% від загального']
      ];
      
      revenueDetails.doctorsBreakdown.forEach(doctor => {
        const percent = ((doctor.revenue / dashboardStats.total_revenue) * 100).toFixed(1);
        doctorsData.push([
          doctor.name,
          doctor.revenue,
          doctor.quantity,
          `${percent}%`
        ]);
      });
      
      const ws2 = XLSX.utils.aoa_to_sheet(doctorsData);
      XLSX.utils.book_append_sheet(wb, ws2, 'По лікарях');
    }
    
    // Sheet 3: По місяцях
    if (revenueDetails.monthlyBreakdown.length > 0) {
      const monthlyData = [
        ['Місяць', 'Рік', 'Оборот']
      ];
      
      revenueDetails.monthlyBreakdown.forEach(item => {
        monthlyData.push([
          monthNames[item.month - 1],
          item.year,
          item.revenue
        ]);
      });
      
      const ws3 = XLSX.utils.aoa_to_sheet(monthlyData);
      XLSX.utils.book_append_sheet(wb, ws3, 'По місяцях');
    }
    
    // Завантажити файл
    const fileName = `Статистика_Оборот_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // Функція транслітерації українських символів
  const transliterate = (text) => {
    const map = {
      'а': 'a', 'б': 'b', 'в': 'v', 'г': 'h', 'ґ': 'g', 'д': 'd', 'е': 'e', 'є': 'ye',
      'ж': 'zh', 'з': 'z', 'и': 'y', 'і': 'i', 'ї': 'yi', 'й': 'y', 'к': 'k', 'л': 'l',
      'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
      'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ь': '', 'ю': 'yu',
      'я': 'ya',
      'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'H', 'Ґ': 'G', 'Д': 'D', 'Е': 'E', 'Є': 'Ye',
      'Ж': 'Zh', 'З': 'Z', 'И': 'Y', 'І': 'I', 'Ї': 'Yi', 'Й': 'Y', 'К': 'K', 'Л': 'L',
      'М': 'M', 'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
      'Ф': 'F', 'Х': 'Kh', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Shch', 'Ь': '', 'Ю': 'Yu',
      'Я': 'Ya', ''': "'", ''': "'"
    };
    
    return text.split('').map(char => map[char] || char).join('');
  };

  const exportToPDF = () => {
    if (!revenueDetails || !dashboardStats) return;

    const doc = new jsPDF('p', 'mm', 'a4');
    
    // Повний dark background
    doc.setFillColor(15, 15, 18);
    doc.rect(0, 0, 210, 297, 'F');
    
    let yPos = 20;
    
    // Заголовок
    doc.setTextColor(255, 165, 0);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('STATYSTYKA OBOROTU', 105, yPos, { align: 'center' });
    
    yPos += 12;
    
    // Загальна інформація
    doc.setFontSize(9);
    doc.setTextColor(200, 200, 200);
    const oborot = `Oborot: ${dashboardStats.total_revenue.toLocaleString('en-US').replace(/,/g, ' ')} UAH`;
    const posluh = `Posluh: ${dashboardStats.total_quantity}`;
    const check = `Ser. check: ${revenueDetails.avgCheck.toFixed(0)} UAH`;
    doc.text(oborot, 20, yPos);
    doc.text(posluh, 90, yPos);
    doc.text(check, 140, yPos);
    
    yPos += 10;
    
    // Топ-5
    doc.setFontSize(11);
    doc.setTextColor(255, 165, 0);
    doc.text('TOP-5 posluh:', 20, yPos);
    yPos += 6;
    
    autoTable(doc, {
      startY: yPos,
      head: [['#', 'Kod', 'Nazva', 'K-t', 'Oborot', '%']],
      body: revenueDetails.top5Services.map((s, i) => {
        // Транслітерація назви
        const name = transliterate(s.name).substring(0, 28);
        const revenue = s.revenue.toLocaleString('en-US').replace(/,/g, ' ');
        const percent = ((s.revenue / dashboardStats.total_revenue) * 100).toFixed(1);
        return [i + 1, s.code, name, s.quantity, revenue, `${percent}%`];
      }),
      theme: 'plain',
      styles: { 
        fillColor: [40, 40, 48], 
        textColor: [220, 220, 220],
        fontSize: 7,
        cellPadding: 2,
        lineColor: [60, 60, 60],
        lineWidth: 0.1
      },
      headStyles: { 
        fillColor: [255, 140, 0], 
        textColor: [15, 15, 18],
        fontStyle: 'bold',
        fontSize: 8
      },
      alternateRowStyles: { fillColor: [30, 30, 35] },
      margin: { left: 15, right: 15 }
    });
    
    yPos = doc.lastAutoTable.finalY + 6;
    
    // Популярність
    if (revenueDetails.topByQuantity) {
      doc.setFontSize(11);
      doc.setTextColor(167, 139, 250);
      doc.text('Naypopulyarnishi (za kilkistyu):', 20, yPos);
      yPos += 6;
      
      autoTable(doc, {
        startY: yPos,
        head: [['#', 'Kod', 'Nazva', 'Kilkist']],
        body: revenueDetails.topByQuantity.slice(0, 5).map((s, i) => [
          i + 1,
          s.code,
          transliterate(s.name).substring(0, 38),
          s.quantity
        ]),
        theme: 'plain',
        styles: { 
          fillColor: [40, 40, 48], 
          textColor: [220, 220, 220],
          fontSize: 7,
          cellPadding: 2
        },
        headStyles: { 
          fillColor: [147, 51, 234], 
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8
        },
        alternateRowStyles: { fillColor: [30, 30, 35] },
        margin: { left: 15, right: 15 }
      });
      
      yPos = doc.lastAutoTable.finalY + 6;
    }
    
    // По лікарях
    if (revenueDetails.doctorsBreakdown.length > 0) {
      doc.setFontSize(11);
      doc.setTextColor(255, 165, 0);
      doc.text('Po likaryakh:', 20, yPos);
      yPos += 6;
      
      autoTable(doc, {
        startY: yPos,
        head: [['Likar', 'Oborot (UAH)', 'Posluh', '%']],
        body: revenueDetails.doctorsBreakdown.map(d => [
          d.short_name,
          d.revenue.toLocaleString('en-US').replace(/,/g, ' '),
          d.quantity,
          `${((d.revenue / dashboardStats.total_revenue) * 100).toFixed(1)}%`
        ]),
        theme: 'plain',
        styles: { 
          fillColor: [40, 40, 48], 
          textColor: [220, 220, 220],
          fontSize: 7,
          cellPadding: 2
        },
        headStyles: { 
          fillColor: [255, 140, 0], 
          textColor: [15, 15, 18],
          fontStyle: 'bold',
          fontSize: 8
        },
        alternateRowStyles: { fillColor: [30, 30, 35] },
        margin: { left: 15, right: 15 }
      });
      
      yPos = doc.lastAutoTable.finalY + 6;
    }
    
    // Динаміка
    if (revenueDetails.monthlyBreakdown.length > 0 && yPos < 250) {
      doc.setFontSize(11);
      doc.setTextColor(255, 165, 0);
      doc.text('Dynamika po misyatsyakh:', 20, yPos);
      yPos += 6;
      
      autoTable(doc, {
        startY: yPos,
        head: [['Misyats', 'Rik', 'Oborot (UAH)']],
        body: revenueDetails.monthlyBreakdown.map(m => [
          transliterate(monthNames[m.month - 1]),
          m.year,
          m.revenue.toLocaleString('en-US').replace(/,/g, ' ')
        ]),
        theme: 'plain',
        styles: { 
          fillColor: [40, 40, 48], 
          textColor: [220, 220, 220],
          fontSize: 7,
          cellPadding: 2
        },
        headStyles: { 
          fillColor: [255, 140, 0], 
          textColor: [15, 15, 18],
          fontStyle: 'bold',
          fontSize: 8
        },
        alternateRowStyles: { fillColor: [30, 30, 35] },
        margin: { left: 15, right: 15 }
      });
    }
    
    // Footer
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text(`Stvoreno: ${new Date().toLocaleString('en-US')}`, 105, 285, { align: 'center' });
    doc.text('ME of Ukraine MedTrack', 105, 290, { align: 'center' });
    
    doc.save(`Statystyka_Oborot_${new Date().toISOString().split('T')[0]}.pdf`);
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
            onClick={openRevenueDetails}
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
          <div className="summary-card">
            <div className="summary-icon">👨‍⚕️</div>
            <div>
              <div className="summary-label">Дохід лікарів</div>
              <div className="summary-value">{dashboardStats.total_doctor_income.toLocaleString('uk-UA')} ₴</div>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-icon">📉</div>
            <div>
              <div className="summary-label">Витрати</div>
              <div className="summary-value">{dashboardStats.total_expenses.toLocaleString('uk-UA')} ₴</div>
            </div>
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

      {/* Список послуг */}
      <div className="card">
        <h3>Надані послуги ({filteredEntries.length})</h3>
        {filteredEntries.length === 0 ? (
          <div className="empty-state">
            <p>Записів не знайдено</p>
            <p className="empty-hint">Змініть фільтри або додайте послуги</p>
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
                      title="Видалити"
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
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto revenue-modal">
          <DialogHeader>
            <DialogTitle>💰 Детальна статистика обороту</DialogTitle>
          </DialogHeader>
          
          {revenueDetails && dashboardStats && (
            <div className="revenue-details">
              <div className="export-buttons">
                <button className="btn btn-secondary btn-sm" onClick={exportToExcel}>
                  📊 Excel
                </button>
                <button className="btn btn-secondary btn-sm" onClick={exportToPDF}>
                  📄 PDF
                </button>
              </div>

              {/* Stats row */}
              <div className="details-summary-row">
                <div className="detail-card-mini">
                  <div className="mini-label">Оборот</div>
                  <div className="mini-value">{dashboardStats.total_revenue.toLocaleString('uk-UA')} ₴</div>
                </div>
                <div className="detail-card-mini">
                  <div className="mini-label">Послуг</div>
                  <div className="mini-value">{dashboardStats.total_quantity}</div>
                </div>
                <div className="detail-card-mini highlight-mini">
                  <div className="mini-label">Середній чек</div>
                  <div className="mini-value">{revenueDetails.avgCheck.toFixed(0)} ₴</div>
                </div>
                {revenueDetails.comparison && (
                  <div className={`detail-card-mini ${revenueDetails.comparison.trend === 'up' ? 'success-mini' : 'danger-mini'}`}>
                    <div className="mini-label">Зміна</div>
                    <div className="mini-value">
                      {revenueDetails.comparison.trend === 'up' ? '↗' : '↘'} {Math.abs(revenueDetails.comparison.change).toFixed(1)}%
                    </div>
                  </div>
                )}
              </div>

              {/* Популярність */}
              <div className="details-section">
                <h4>📊 Найпопулярніші (за кількістю)</h4>
                <div className="popularity-grid">
                  {revenueDetails.topByQuantity.map((service, index) => (
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

              {/* Топ-5 */}
              <div className="details-section">
                <h4>🏆 Топ-5 за оборотом</h4>
                <div className="top-services-list">
                  {revenueDetails.top5Services.map((service, index) => (
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

              {/* Лікарі */}
              {revenueDetails.doctorsBreakdown.length > 1 && (
                <div className="details-section">
                  <h4>👥 Розподіл по лікарях</h4>
                  <div className="doctors-breakdown">
                    {revenueDetails.doctorsBreakdown.map(doctor => (
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

              {/* Динаміка */}
              {revenueDetails.monthlyBreakdown.length > 0 && (
                <div className="details-section">
                  <h4>📈 Динаміка по місяцях</h4>
                  <div className="monthly-chart">
                    {revenueDetails.monthlyBreakdown.map(item => (
                      <div key={`${item.year}-${item.month}`} className="month-bar-item">
                        <div className="month-label">{monthNames[item.month - 1]} {item.year}</div>
                        <div className="month-bar-container">
                          <div 
                            className="month-bar-fill" 
                            style={{ 
                              width: `${(item.revenue / Math.max(...revenueDetails.monthlyBreakdown.map(m => m.revenue))) * 100}%` 
                            }}
                          />
                          <span className="month-bar-value">{item.revenue.toLocaleString('uk-UA')} ₴</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MonthlyServices;
