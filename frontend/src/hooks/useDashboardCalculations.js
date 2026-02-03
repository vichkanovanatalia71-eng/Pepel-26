import { useMemo, useCallback } from 'react';

export const useDashboardCalculations = (filteredEntries, allEntries, services, doctors, selectedDoctor, selectedYear, selectedMonth, monthNames) => {
  
  // Dashboard Stats
  const dashboardStats = useMemo(() => {
    if (!filteredEntries.length) return null;

    const total_revenue = filteredEntries.reduce((sum, e) => sum + (e.total_revenue || 0), 0);
    const total_expenses = filteredEntries.reduce((sum, e) => sum + (e.total_expenses || 0), 0);
    const total_doctor_income = filteredEntries.reduce((sum, e) => sum + (e.doctor_income || 0), 0);
    const total_fop_income = filteredEntries.reduce((sum, e) => sum + (e.fop_income || 0), 0);
    const total_quantity = filteredEntries.reduce((sum, e) => sum + (e.quantity || 0), 0);

    return {
      total_revenue,
      total_expenses,
      total_doctor_income,
      total_fop_income,
      total_quantity
    };
  }, [filteredEntries]);

  // Revenue breakdown for modal
  const getRevenueBreakdown = useCallback(() => {
    const serviceStats = {};
    const doctorStats = {};
    const monthlyStats = {};
    
    filteredEntries.forEach(entry => {
      const service = services.find(s => s.id === entry.service_id);
      const doctor = doctors.find(d => d.id === entry.doctor_id);
      
      // By service
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
      
      // By doctor
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
      
      // By month
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
    
    // Comparison with previous month
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
  }, [filteredEntries, services, doctors, dashboardStats, monthNames]);

  // Expenses breakdown
  const calculateExpensesBreakdown = useCallback(() => {
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
  }, [filteredEntries, services]);

  // Doctor income data for modal
  const getDoctorIncomeData = useCallback(() => {
    const monthlyAggregate = {};
    
    filteredEntries.forEach(entry => {
      const monthKey = `${entry.year}-${entry.month}`;
      
      if (!monthlyAggregate[monthKey]) {
        monthlyAggregate[monthKey] = {
          month: entry.month,
          year: entry.year,
          quantity: 0,
          revenue: 0,
          expenses: 0,
          ep: 0,
          vz: 0,
          toDistribute: 0,
          doctorIncome: 0
        };
      }
      
      const ep = entry.total_revenue * 0.05;
      const vz = entry.total_revenue * 0.01;
      const toDistribute = entry.total_revenue - entry.total_expenses - ep - vz;
      
      monthlyAggregate[monthKey].quantity += entry.quantity;
      monthlyAggregate[monthKey].revenue += entry.total_revenue;
      monthlyAggregate[monthKey].expenses += entry.total_expenses;
      monthlyAggregate[monthKey].ep += ep;
      monthlyAggregate[monthKey].vz += vz;
      monthlyAggregate[monthKey].toDistribute += toDistribute;
      monthlyAggregate[monthKey].doctorIncome += entry.doctor_income;
    });
    
    const monthlyData = Object.values(monthlyAggregate).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
    
    // By doctor breakdown (when "All doctors" selected)
    const byDoctor = {};
    if (selectedDoctor === 'all') {
      filteredEntries.forEach(entry => {
        const doctor = doctors.find(d => d.id === entry.doctor_id);
        const docKey = entry.doctor_id;
        
        if (!byDoctor[docKey]) {
          byDoctor[docKey] = {
            doctor_id: docKey,
            doctor_name: doctor?.name || 'N/A',
            short_name: doctor?.short_name || 'N/A',
            months: {}
          };
        }
        
        const monthKey = `${entry.year}-${entry.month}`;
        if (!byDoctor[docKey].months[monthKey]) {
          byDoctor[docKey].months[monthKey] = {
            month: entry.month,
            year: entry.year,
            quantity: 0,
            revenue: 0,
            expenses: 0,
            ep: 0,
            vz: 0,
            toDistribute: 0,
            doctorIncome: 0
          };
        }
        
        const ep = entry.total_revenue * 0.05;
        const vz = entry.total_revenue * 0.01;
        const toDistribute = entry.total_revenue - entry.total_expenses - ep - vz;
        
        byDoctor[docKey].months[monthKey].quantity += entry.quantity;
        byDoctor[docKey].months[monthKey].revenue += entry.total_revenue;
        byDoctor[docKey].months[monthKey].expenses += entry.total_expenses;
        byDoctor[docKey].months[monthKey].ep += ep;
        byDoctor[docKey].months[monthKey].vz += vz;
        byDoctor[docKey].months[monthKey].toDistribute += toDistribute;
        byDoctor[docKey].months[monthKey].doctorIncome += entry.doctor_income;
      });
    }
    
    const doctorsData = Object.values(byDoctor).map(doc => ({
      ...doc,
      monthsArray: Object.values(doc.months).sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      })
    }));
    
    return { monthlyData, doctorsData };
  }, [filteredEntries, selectedDoctor, doctors]);

  return {
    dashboardStats,
    getRevenueBreakdown,
    calculateExpensesBreakdown,
    getDoctorIncomeData
  };
};

export default useDashboardCalculations;
