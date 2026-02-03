import React, { useState, useMemo, useCallback } from 'react';
import axios from 'axios';
import './MonthlyServices.css';

// Hooks
import useMonthlyServicesData from '../hooks/useMonthlyServicesData';
import useDashboardCalculations from '../hooks/useDashboardCalculations';

// Components
import {
  RevenueModal,
  DoctorIncomeModal,
  ExpensesModal,
  CashBalanceModal,
  BankBalanceModal,
  AddServicesModal,
  DashboardCards,
  EntriesList
} from '../components/monthly-services';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const MonthlyServices = () => {
  // Data & Filters from custom hook
  const {
    services,
    doctors,
    allEntries,
    filteredEntries,
    displayedCashBalance,
    displayedBankBalance,
    loading,
    monthNames,
    selectedDoctor,
    setSelectedDoctor,
    selectedYear,
    setSelectedYear,
    selectedMonth,
    setSelectedMonth,
    availableYears,
    getAvailableMonths,
    resetFilters,
    hasActiveFilters,
    loadData
  } = useMonthlyServicesData();

  // Calculations from custom hook
  const {
    dashboardStats,
    getRevenueBreakdown,
    calculateExpensesBreakdown,
    getDoctorIncomeData
  } = useDashboardCalculations(
    filteredEntries, 
    allEntries, 
    services, 
    doctors, 
    selectedDoctor, 
    selectedYear, 
    selectedMonth, 
    monthNames
  );

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRevenueModal, setShowRevenueModal] = useState(false);
  const [showDoctorIncomeModal, setShowDoctorIncomeModal] = useState(false);
  const [showExpensesModal, setShowExpensesModal] = useState(false);
  const [showCashBalanceModal, setShowCashBalanceModal] = useState(false);
  const [showBankBalanceModal, setShowBankBalanceModal] = useState(false);

  // Entries list states
  const [sortBy, setSortBy] = useState('date-desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntries, setSelectedEntries] = useState(new Set());

  // Get sorted and filtered entries for the list
  const displayedEntries = useMemo(() => {
    let entries = [...filteredEntries];
    
    // Search filter
    if (searchQuery) {
      entries = entries.filter(entry => {
        const service = services.find(s => s.id === entry.service_id);
        const doctor = doctors.find(d => d.id === entry.doctor_id);
        const query = searchQuery.toLowerCase();
        
        return (
          service?.code?.toLowerCase().includes(query) ||
          service?.name?.toLowerCase().includes(query) ||
          doctor?.name?.toLowerCase().includes(query) ||
          doctor?.short_name?.toLowerCase().includes(query) ||
          monthNames[entry.month - 1]?.toLowerCase().includes(query)
        );
      });
    }
    
    // Sorting
    switch (sortBy) {
      case 'date-desc':
        entries.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        break;
      case 'date-asc':
        entries.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        break;
      case 'amount-desc':
        entries.sort((a, b) => b.total_revenue - a.total_revenue);
        break;
      case 'amount-asc':
        entries.sort((a, b) => a.total_revenue - b.total_revenue);
        break;
      case 'quantity-desc':
        entries.sort((a, b) => b.quantity - a.quantity);
        break;
      case 'quantity-asc':
        entries.sort((a, b) => a.quantity - b.quantity);
        break;
      default:
        break;
    }
    
    return entries;
  }, [filteredEntries, searchQuery, sortBy, services, doctors, monthNames]);

  // Entry selection handlers
  const handleSelectEntry = useCallback((entryId, checked) => {
    setSelectedEntries(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(entryId);
      } else {
        newSet.delete(entryId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback((newSelection) => {
    setSelectedEntries(newSelection);
  }, []);

  // Delete handlers
  const handleDeleteEntry = useCallback(async (entryId) => {
    if (window.confirm('Видалити цей запис?')) {
      try {
        await axios.delete(`${API_URL}/api/monthly-services/${entryId}`);
        loadData();
      } catch (error) {
        console.error('Delete error:', error);
        alert('Помилка видалення');
      }
    }
  }, [loadData]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedEntries.size === 0) {
      alert('Оберіть записи для видалення');
      return;
    }
    
    if (window.confirm(`Видалити ${selectedEntries.size} записів?`)) {
      try {
        for (const entryId of selectedEntries) {
          await axios.delete(`${API_URL}/api/monthly-services/${entryId}`);
        }
        setSelectedEntries(new Set());
        loadData();
      } catch (error) {
        console.error('Bulk delete error:', error);
        alert('Помилка видалення');
      }
    }
  }, [selectedEntries, loadData]);

  if (loading) {
    return (
      <div className="monthly-services-page loading">
        <div className="loading-spinner">Завантаження...</div>
      </div>
    );
  }

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

      {/* Filters */}
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

      {/* Dashboard Cards */}
      <DashboardCards
        dashboardStats={dashboardStats}
        displayedCashBalance={displayedCashBalance}
        displayedBankBalance={displayedBankBalance}
        selectedDoctor={selectedDoctor}
        doctors={doctors}
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
        monthNames={monthNames}
        onRevenueClick={() => setShowRevenueModal(true)}
        onDoctorIncomeClick={() => setShowDoctorIncomeModal(true)}
        onExpensesClick={() => setShowExpensesModal(true)}
        onCashBalanceClick={() => setShowCashBalanceModal(true)}
        onBankBalanceClick={() => setShowBankBalanceModal(true)}
      />

      {/* Entries List */}
      <EntriesList
        entries={displayedEntries}
        services={services}
        doctors={doctors}
        monthNames={monthNames}
        selectedEntries={selectedEntries}
        onSelectEntry={handleSelectEntry}
        onDeleteEntry={handleDeleteEntry}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortBy={sortBy}
        onSortChange={setSortBy}
        onSelectAll={handleSelectAll}
        onBulkDelete={handleBulkDelete}
      />

      {/* Modals */}
      <AddServicesModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        doctors={doctors}
        services={services}
        monthNames={monthNames}
        onSave={loadData}
      />

      <RevenueModal
        isOpen={showRevenueModal}
        onClose={() => setShowRevenueModal(false)}
        dashboardStats={dashboardStats}
        getRevenueBreakdown={getRevenueBreakdown}
        filteredEntries={filteredEntries}
        services={services}
        doctors={doctors}
        monthNames={monthNames}
      />

      <DoctorIncomeModal
        isOpen={showDoctorIncomeModal}
        onClose={() => setShowDoctorIncomeModal(false)}
        dashboardStats={dashboardStats}
        getDoctorIncomeData={getDoctorIncomeData}
        filteredEntries={filteredEntries}
        services={services}
        doctors={doctors}
        selectedDoctor={selectedDoctor}
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
        monthNames={monthNames}
      />

      <ExpensesModal
        isOpen={showExpensesModal}
        onClose={() => setShowExpensesModal(false)}
        calculateExpensesBreakdown={calculateExpensesBreakdown}
      />

      <CashBalanceModal
        isOpen={showCashBalanceModal}
        onClose={() => setShowCashBalanceModal(false)}
        monthNames={monthNames}
        onSave={loadData}
      />

      <BankBalanceModal
        isOpen={showBankBalanceModal}
        onClose={() => setShowBankBalanceModal(false)}
        monthNames={monthNames}
        onSave={loadData}
      />
    </div>
  );
};

export default MonthlyServices;
