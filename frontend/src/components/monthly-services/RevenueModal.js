import React from 'react';
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

const RevenueModal = ({ 
  isOpen, 
  onClose, 
  dashboardStats, 
  getRevenueBreakdown,
  filteredEntries,
  services,
  doctors,
  monthNames
}) => {
  
  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    
    // Sheet 1: Detailed breakdown
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
    
    // Sheet 2: By services
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
    
    // Sheet 3: By doctors
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
    
    // Sheet 4: By months
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

  if (!dashboardStats) return null;
  
  const breakdown = getRevenueBreakdown();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
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

          {/* Comparison with previous month */}
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

          {/* Top 5 by revenue */}
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

          {/* Popular by quantity */}
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

          {/* By doctors */}
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

          {/* Monthly chart */}
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
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RevenueModal;
