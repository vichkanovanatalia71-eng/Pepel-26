import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CashBalanceModal = ({ 
  isOpen, 
  onClose, 
  monthNames,
  onSave
}) => {
  const [cashBalanceMonth, setCashBalanceMonth] = useState(new Date().getMonth() + 1);
  const [cashBalanceYear, setCashBalanceYear] = useState(new Date().getFullYear());
  const [cashAmount, setCashAmount] = useState('');
  const [currentCashBalance, setCurrentCashBalance] = useState(null);

  const loadCashBalanceForPeriod = async (month, year) => {
    try {
      const res = await axios.get(`${API_URL}/api/cash-balance/${month}/${year}`);
      if (res.data.exists) {
        setCashAmount(res.data.data.amount);
        setCurrentCashBalance(res.data.data);
      } else {
        setCashAmount('');
        setCurrentCashBalance(null);
      }
    } catch (error) {
      console.error('Error:', error);
      setCashAmount('');
      setCurrentCashBalance(null);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCashBalanceForPeriod(cashBalanceMonth, cashBalanceYear);
    }
  }, [isOpen, cashBalanceMonth, cashBalanceYear]);

  const saveCashBalance = async () => {
    try {
      await axios.post(`${API_URL}/api/cash-balance`, {
        month: cashBalanceMonth,
        year: cashBalanceYear,
        amount: parseFloat(cashAmount)
      });
      
      onSave();
      onClose();
    } catch (error) {
      console.error('Save error:', error);
      alert('Помилка збереження');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md cash-balance-modal">
        <DialogHeader>
          <DialogTitle>💵 Готівка в касі</DialogTitle>
        </DialogHeader>
        <div className="cash-balance-content">
          {/* Period selector */}
          <div className="cash-period-selector">
            <div className="form-group">
              <label>Місяць</label>
              <select 
                value={cashBalanceMonth} 
                onChange={(e) => {
                  const newMonth = parseInt(e.target.value);
                  setCashBalanceMonth(newMonth);
                  loadCashBalanceForPeriod(newMonth, cashBalanceYear);
                }}
              >
                {monthNames.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Рік</label>
              <input 
                type="number" 
                value={cashBalanceYear} 
                onChange={(e) => {
                  const newYear = parseInt(e.target.value);
                  setCashBalanceYear(newYear);
                  loadCashBalanceForPeriod(cashBalanceMonth, newYear);
                }}
              />
            </div>
          </div>
          
          {currentCashBalance && (
            <div className="existing-cash-highlight">
              <span>Поточна сума:</span>
              <strong>{currentCashBalance.amount.toLocaleString('uk-UA')} ₴</strong>
            </div>
          )}
          
          <div className="form-group">
            <label>Сума готівки в касі</label>
            <input 
              type="number"
              step="0.01"
              value={cashAmount}
              onChange={(e) => setCashAmount(e.target.value)}
              placeholder="Введіть суму..."
              className="cash-input"
            />
          </div>
          
          <div className="modal-actions">
            <button className="btn btn-success" onClick={saveCashBalance}>
              ✓ Зберегти
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={() => {
                onClose();
                setCashAmount('');
              }}
            >
              Скасувати
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CashBalanceModal;
