import React from 'react';
import axios from 'axios';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const DoctorIncomeModal = ({ 
  isOpen, 
  onClose, 
  dashboardStats,
  getDoctorIncomeData,
  filteredEntries,
  services,
  doctors,
  selectedDoctor,
  selectedYear,
  selectedMonth,
  monthNames
}) => {

  const handleShare = async () => {
    try {
      const reportData = {
        title: selectedDoctor !== 'all' && doctors.find(d => d.id === selectedDoctor)
          ? `Дохід ${doctors.find(d => d.id === selectedDoctor)?.name}`
          : 'Дохід лікарів',
        filter: {
          doctor: selectedDoctor,
          year: selectedYear,
          month: selectedMonth
        },
        entries: filteredEntries,
        services: services,
        doctors: doctors
      };
      
      const response = await axios.post(`${API_URL}/api/reports/share`, { data: reportData });
      const shareUrl = `${window.location.origin}/share/${response.data.share_token}`;
      
      try {
        await navigator.clipboard.writeText(shareUrl);
        alert(`✅ Посилання скопійовано!\n\n${shareUrl}\n\nДоступне до: ${new Date(response.data.expires_at).toLocaleDateString('uk-UA')}`);
      } catch (clipError) {
        prompt('Скопіюйте посилання (Ctrl+C):', shareUrl);
      }
    } catch (error) {
      console.error('Share error:', error);
      alert('Помилка створення посилання');
    }
  };

  if (!dashboardStats) return null;
  
  const { monthlyData, doctorsData } = getDoctorIncomeData();
  const currentDoctor = doctors.find(d => d.id === selectedDoctor);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto revenue-modal">
        <DialogHeader>
          <DialogTitle>
            👨‍⚕️ {selectedDoctor !== 'all' && currentDoctor
              ? `Дохід ${currentDoctor.name}`
              : 'Дохід лікарів'
            }
          </DialogTitle>
        </DialogHeader>
        <div className="revenue-details">
          {/* Share button */}
          <div className="export-buttons">
            <button 
              className="btn btn-primary btn-sm"
              onClick={handleShare}
            >
              📤 Поділитись
            </button>
          </div>

          {/* General table */}
          <div className="details-section">
            <h4>{selectedDoctor === 'all' ? 'Загальна таблиця (всі лікарі)' : ''}</h4>
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
                  {monthlyData.map(monthData => (
                    <tr key={`${monthData.year}-${monthData.month}`}>
                      <td><strong>{monthNames[monthData.month - 1]} {monthData.year}</strong></td>
                      <td>{monthData.quantity}</td>
                      <td className="revenue-cell">{monthData.revenue.toLocaleString('uk-UA')} ₴</td>
                      <td>{monthData.expenses.toLocaleString('uk-UA')} ₴</td>
                      <td>{monthData.ep.toLocaleString('uk-UA')} ₴</td>
                      <td>{monthData.vz.toLocaleString('uk-UA')} ₴</td>
                      <td className="highlight-cell">{monthData.toDistribute.toLocaleString('uk-UA')} ₴</td>
                      <td className="income-cell"><strong>{monthData.doctorIncome.toLocaleString('uk-UA')} ₴</strong></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td><strong>ВСЬОГО:</strong></td>
                    <td><strong>{monthlyData.reduce((s, m) => s + m.quantity, 0)}</strong></td>
                    <td className="revenue-cell"><strong>{monthlyData.reduce((s, m) => s + m.revenue, 0).toLocaleString('uk-UA')} ₴</strong></td>
                    <td><strong>{monthlyData.reduce((s, m) => s + m.expenses, 0).toLocaleString('uk-UA')} ₴</strong></td>
                    <td><strong>{monthlyData.reduce((s, m) => s + m.ep, 0).toLocaleString('uk-UA')} ₴</strong></td>
                    <td><strong>{monthlyData.reduce((s, m) => s + m.vz, 0).toLocaleString('uk-UA')} ₴</strong></td>
                    <td className="highlight-cell"><strong>{monthlyData.reduce((s, m) => s + m.toDistribute, 0).toLocaleString('uk-UA')} ₴</strong></td>
                    <td className="income-cell"><strong>{monthlyData.reduce((s, m) => s + m.doctorIncome, 0).toLocaleString('uk-UA')} ₴</strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          
          {/* Breakdown by each doctor */}
          {doctorsData.map(doctorData => (
            <div key={doctorData.doctor_id} className="details-section doctor-section">
              <h4>
                <span className="doctor-name-badge-inline">{doctorData.short_name}</span>
                {doctorData.doctor_name}
              </h4>
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
                    {doctorData.monthsArray.map(monthData => (
                      <tr key={`${monthData.year}-${monthData.month}`}>
                        <td><strong>{monthNames[monthData.month - 1]} {monthData.year}</strong></td>
                        <td>{monthData.quantity}</td>
                        <td className="revenue-cell">{monthData.revenue.toLocaleString('uk-UA')} ₴</td>
                        <td>{monthData.expenses.toLocaleString('uk-UA')} ₴</td>
                        <td>{monthData.ep.toLocaleString('uk-UA')} ₴</td>
                        <td>{monthData.vz.toLocaleString('uk-UA')} ₴</td>
                        <td className="highlight-cell">{monthData.toDistribute.toLocaleString('uk-UA')} ₴</td>
                        <td className="income-cell"><strong>{monthData.doctorIncome.toLocaleString('uk-UA')} ₴</strong></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td><strong>ВСЬОГО {doctorData.short_name}:</strong></td>
                      <td><strong>{doctorData.monthsArray.reduce((s, m) => s + m.quantity, 0)}</strong></td>
                      <td className="revenue-cell"><strong>{doctorData.monthsArray.reduce((s, m) => s + m.revenue, 0).toLocaleString('uk-UA')} ₴</strong></td>
                      <td><strong>{doctorData.monthsArray.reduce((s, m) => s + m.expenses, 0).toLocaleString('uk-UA')} ₴</strong></td>
                      <td><strong>{doctorData.monthsArray.reduce((s, m) => s + m.ep, 0).toLocaleString('uk-UA')} ₴</strong></td>
                      <td><strong>{doctorData.monthsArray.reduce((s, m) => s + m.vz, 0).toLocaleString('uk-UA')} ₴</strong></td>
                      <td className="highlight-cell"><strong>{doctorData.monthsArray.reduce((s, m) => s + m.toDistribute, 0).toLocaleString('uk-UA')} ₴</strong></td>
                      <td className="income-cell"><strong>{doctorData.monthsArray.reduce((s, m) => s + m.doctorIncome, 0).toLocaleString('uk-UA')} ₴</strong></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DoctorIncomeModal;
