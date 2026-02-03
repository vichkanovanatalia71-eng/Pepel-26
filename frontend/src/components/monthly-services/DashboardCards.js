import React from 'react';

const DashboardCards = ({
  dashboardStats,
  displayedCashBalance,
  selectedDoctor,
  doctors,
  selectedYear,
  selectedMonth,
  monthNames,
  onRevenueClick,
  onDoctorIncomeClick,
  onExpensesClick,
  onCashBalanceClick
}) => {
  if (!dashboardStats) return null;

  const currentDoctor = doctors.find(d => d.id === selectedDoctor);

  return (
    <div className="summary-cards">
      <div 
        className="summary-card clickable" 
        onClick={onRevenueClick}
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
        onClick={onDoctorIncomeClick}
        data-testid="doctor-card"
      >
        <div className="summary-icon">👨‍⚕️</div>
        <div>
          <div className="summary-label">
            {selectedDoctor !== 'all' && currentDoctor
              ? `Дохід ${currentDoctor.short_name}`
              : 'Дохід лікарів'
            }
          </div>
          <div className="summary-value">{dashboardStats.total_doctor_income.toLocaleString('uk-UA')} ₴</div>
        </div>
        <div className="card-click-hint">👁️</div>
      </div>

      <div 
        className="summary-card clickable"
        onClick={onExpensesClick}
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

      <div 
        className="summary-card clickable cash-balance-card"
        onClick={onCashBalanceClick}
        data-testid="cash-balance-card"
      >
        <div className="summary-icon">💵</div>
        <div>
          <div className="summary-label">Готівка в касі</div>
          <div className="summary-value">
            {displayedCashBalance ? displayedCashBalance.amount.toLocaleString('uk-UA') : '0'} ₴
          </div>
          <div className="summary-count">
            {displayedCashBalance 
              ? (displayedCashBalance.isAggregate 
                  ? 'Сума за період' 
                  : `${monthNames[displayedCashBalance.month - 1]} ${displayedCashBalance.year}`)
              : 'Не вказано'}
          </div>
        </div>
        <div className="card-click-hint">✏️</div>
      </div>

      <div className="summary-card bank-card">
        <div className="summary-icon">🏦</div>
        <div>
          <div className="summary-label">Рахунок у банку</div>
          <div className="summary-value">— ₴</div>
          <div className="summary-count">Скоро</div>
        </div>
      </div>
    </div>
  );
};

export default DashboardCards;
