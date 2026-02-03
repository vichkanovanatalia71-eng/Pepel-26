import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const useMonthlyServicesData = () => {
  const [services, setServices] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [allEntries, setAllEntries] = useState([]);
  const [filteredEntries, setFilteredEntries] = useState([]);
  const [allCashBalances, setAllCashBalances] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedDoctor, setSelectedDoctor] = useState('all');
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');

  const monthNames = useMemo(() => [
    'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
    'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'
  ], []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [servicesRes, doctorsRes, entriesRes, cashRes] = await Promise.all([
        axios.get(`${API_URL}/api/services`),
        axios.get(`${API_URL}/api/doctors`),
        axios.get(`${API_URL}/api/monthly-services`),
        axios.get(`${API_URL}/api/cash-balance`).catch(() => ({ data: [] }))
      ]);

      setServices(servicesRes.data.sort((a, b) => (a.code || '').localeCompare(b.code || '')));
      setDoctors(doctorsRes.data);
      const sorted = entriesRes.data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setAllEntries(sorted);
      setAllCashBalances(cashRes.data || []);
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Apply filters
  useEffect(() => {
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
  }, [allEntries, selectedDoctor, selectedYear, selectedMonth]);

  const availableYears = useMemo(() => 
    [...new Set(allEntries.map(e => e.year))].sort((a, b) => b - a),
    [allEntries]
  );

  const getAvailableMonths = useCallback(() => {
    const monthsSet = new Set();
    const entries = selectedYear === 'all' 
      ? allEntries 
      : allEntries.filter(e => e.year === selectedYear);
    entries.forEach(e => monthsSet.add(e.month));
    return Array.from(monthsSet).sort((a, b) => a - b);
  }, [allEntries, selectedYear]);

  const resetFilters = useCallback(() => {
    setSelectedDoctor('all');
    setSelectedYear('all');
    setSelectedMonth('all');
  }, []);

  const hasActiveFilters = selectedDoctor !== 'all' || selectedYear !== 'all' || selectedMonth !== 'all';

  // Calculate displayed cash balance
  const displayedCashBalance = useMemo(() => {
    let filtered = [...allCashBalances];
    
    if (selectedYear !== 'all') {
      filtered = filtered.filter(b => b.year === selectedYear);
    }
    if (selectedMonth !== 'all') {
      filtered = filtered.filter(b => b.month === selectedMonth);
    }
    
    if (filtered.length === 0) return null;
    if (filtered.length === 1) return filtered[0];
    
    const total = filtered.reduce((sum, b) => sum + b.amount, 0);
    const latestPeriod = filtered.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    })[0];
    
    return {
      amount: total,
      month: latestPeriod.month,
      year: latestPeriod.year,
      isAggregate: true
    };
  }, [allCashBalances, selectedYear, selectedMonth]);

  return {
    // Data
    services,
    doctors,
    allEntries,
    filteredEntries,
    allCashBalances,
    displayedCashBalance,
    loading,
    monthNames,
    
    // Filters
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
    
    // Actions
    loadData
  };
};

export default useMonthlyServicesData;
