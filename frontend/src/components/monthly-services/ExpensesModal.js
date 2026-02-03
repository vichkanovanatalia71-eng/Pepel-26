import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

const ExpensesModal = ({ 
  isOpen, 
  onClose, 
  calculateExpensesBreakdown
}) => {
  
  const expensesData = calculateExpensesBreakdown();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto revenue-modal">
        <DialogHeader>
          <DialogTitle>📉 Детальна статистика витрат</DialogTitle>
        </DialogHeader>
        <div className="revenue-details">
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
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExpensesModal;
