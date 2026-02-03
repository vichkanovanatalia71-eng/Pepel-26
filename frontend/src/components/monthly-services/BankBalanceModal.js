import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const BankBalanceModal = ({ 
  isOpen, 
  onClose, 
  monthNames,
  onSave
}) => {
  const [bankBalanceMonth, setBankBalanceMonth] = useState(new Date().getMonth() + 1);
  const [bankBalanceYear, setBankBalanceYear] = useState(new Date().getFullYear());
  const [bankAmount, setBankAmount] = useState('');
  const [currentBankBalance, setCurrentBankBalance] = useState(null);

  const loadBankBalanceForPeriod = async (month, year) => {
    try {
      const res = await axios.get(`${API_URL}/api/bank-balance/${month}/${year}`);
      if (res.data.exists) {
        setBankAmount(res.data.data.amount);
        setCurrentBankBalance(res.data.data);
      } else {
        setBankAmount('');
        setCurrentBankBalance(null);
      }
    } catch (error) {
      console.error('Error:', error);
      setBankAmount('');
      setCurrentBankBalance(null);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadBankBalanceForPeriod(bankBalanceMonth, bankBalanceYear);
    }
  }, [isOpen, bankBalanceMonth, bankBalanceYear]);

  const saveBankBalance = async () => {
    try {
      await axios.post(`${API_URL}/api/bank-balance`, {
        month: bankBalanceMonth,
        year: bankBalanceYear,
        amount: parseFloat(bankAmount)
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
          <DialogTitle>🏦 Рахунок у банку</DialogTitle>
        </DialogHeader>
        <div className="cash-balance-content">
          {/* Period selector */}
          <div className="cash-period-selector">
            <div className="form-group">
              <label>Місяць</label>
              <select 
                value={bankBalanceMonth} 
                onChange={(e) => {
                  const newMonth = parseInt(e.target.value);
                  setBankBalanceMonth(newMonth);
                  loadBankBalanceForPeriod(newMonth, bankBalanceYear);
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
                value={bankBalanceYear} 
                onChange={(e) => {
                  const newYear = parseInt(e.target.value);
                  setBankBalanceYear(newYear);
                  loadBankBalanceForPeriod(bankBalanceMonth, newYear);
                }}
              />
            </div>
          </div>
          
          {currentBankBalance && (
            <div className="existing-cash-highlight bank-highlight">
              <span>Поточна сума:</span>
              <strong>{currentBankBalance.amount.toLocaleString('uk-UA')} ₴</strong>
            </div>
          )}
          
          <div className="form-group">
            <label>Залишок на рахунку</label>
            <input 
              type="number"
              step="0.01"
              value={bankAmount}
              onChange={(e) => setBankAmount(e.target.value)}
              placeholder="Введіть суму..."
              className="cash-input"
            />
          </div>
          
          <div className="modal-actions">
            <button className="btn btn-success" onClick={saveBankBalance}>
              ✓ Зберегти
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={() => {
                onClose();
                setBankAmount('');
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

export default BankBalanceModal;
