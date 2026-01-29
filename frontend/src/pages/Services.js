import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import './Services.css';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Services = () => {
  const [services, setServices] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [formData, setFormData] = useState({ 
    code: '',
    name: '', 
    price: '', 
    expense_items: []
  });
  const [expandedService, setExpandedService] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState(null);

  const fetchServices = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/services`);
      setServices(response.data);
    } catch (error) {
      console.error('Error fetching services:', error);
    }
  };

  useEffect(() => {
    fetchServices(); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        code: formData.code || null,
        name: formData.name,
        price: parseFloat(formData.price),
        expense_items: formData.expense_items
      };

      if (editingService) {
        await axios.put(`${API_URL}/api/services/${editingService.id}`, payload);
      } else {
        await axios.post(`${API_URL}/api/services`, payload);
      }
      
      resetForm();
      fetchServices();
    } catch (error) {
      console.error('Error saving service:', error);
      alert('Помилка збереження послуги');
    }
  };

  const handleDeleteService = async (serviceId) => {
    setServiceToDelete(serviceId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!serviceToDelete) return;
    
    try {
      await axios.delete(`${API_URL}/api/services/${serviceToDelete}`);
      fetchServices();
      setDeleteDialogOpen(false);
      setServiceToDelete(null);
    } catch (error) {
      console.error('Error deleting service:', error);
      alert('Помилка видалення');
      setDeleteDialogOpen(false);
      setServiceToDelete(null);
    }
  };

  const resetForm = () => {
    setFormData({ code: '', name: '', price: '', expense_items: [] });
    setShowModal(false);
    setEditingService(null);
  };

  const handleEdit = (service) => {
    setEditingService(service);
    setFormData({
      code: service.code || '',
      name: service.name,
      price: service.price,
      expense_items: service.expense_items || []
    });
    setShowModal(true);
  };

  const addExpenseItem = () => {
    setFormData({
      ...formData,
      expense_items: [
        ...formData.expense_items,
        { material_name: '', quantity: 1, unit: 'шт', price_per_unit: 0, total_cost: 0 }
      ]
    });
  };

  const updateExpenseItem = (index, field, value) => {
    const items = [...formData.expense_items];
    
    // Конвертуємо числові поля
    if (field === 'quantity' || field === 'price_per_unit') {
      items[index][field] = value === '' ? 0 : parseFloat(value) || 0;
    } else {
      items[index][field] = value;
    }
    
    // Автоматичний розрахунок total_cost
    if (field === 'quantity' || field === 'price_per_unit') {
      const qty = parseFloat(items[index].quantity) || 0;
      const price = parseFloat(items[index].price_per_unit) || 0;
      items[index].total_cost = qty * price;
    }
    
    setFormData({ ...formData, expense_items: items });
  };

  const removeExpenseItem = (index) => {
    const items = formData.expense_items.filter((_, i) => i !== index);
    setFormData({ ...formData, expense_items: items });
  };

  const totalExpenses = formData.expense_items.reduce((sum, item) => sum + (item.total_cost || 0), 0);
  const price = parseFloat(formData.price || 0);
  const ep = price * 0.05;
  const vz = price * 0.01;
  const epVz = ep + vz;
  const expensesWithTax = totalExpenses + epVz;
  const incomeAfterTax = price - totalExpenses - epVz;
  const doctorShare = incomeAfterTax / 2;
  const organizationIncome = incomeAfterTax / 2;

  return (
    <div className="services-page" data-testid="services-page">
      <div className="page-header">
        <h1>🏥 Платні послуги</h1>
        <button 
          className="btn btn-primary" 
          onClick={() => {
            setEditingService(null);
            setFormData({ code: '', name: '', price: '', expense_items: [] });
            setShowModal(true);
          }} 
          data-testid="add-service-btn"
        >
          + Додати послугу
        </button>
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingService ? 'Редагувати послугу' : 'Нова послуга'}</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="modal-form">
            <div className="form-row">
              <div className="form-group">
                <label>Код послуги</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="001"
                  data-testid="service-code-input"
                />
              </div>
              <div className="form-group flex-2">
                <label>Назва послуги</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Консультація лікаря"
                  required
                  data-testid="service-name-input"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Ціна для клієнта (грн)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="500"
                  required
                  data-testid="service-price-input"
                />
              </div>
            </div>

            <div className="expense-items-section">
              <div className="section-header">
                <h4>Витрати на послугу</h4>
                <button type="button" className="btn btn-secondary btn-sm" onClick={addExpenseItem}>
                  + Додати матеріал
                </button>
              </div>

              {formData.expense_items.map((item, index) => (
                <div key={index} className="expense-item-row">
                  <input
                    type="text"
                    placeholder="Назва матеріалу"
                    value={item.material_name}
                    onChange={(e) => updateExpenseItem(index, 'material_name', e.target.value)}
                    className="material-name"
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="К-ть"
                    value={item.quantity}
                    onChange={(e) => updateExpenseItem(index, 'quantity', e.target.value)}
                    className="quantity"
                  />
                  <select
                    value={item.unit}
                    onChange={(e) => updateExpenseItem(index, 'unit', e.target.value)}
                    className="unit"
                  >
                    <option value="шт">шт</option>
                    <option value="пара">пара</option>
                    <option value="мл">мл</option>
                    <option value="г">г</option>
                    <option value="упак">упак</option>
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Ціна"
                    value={item.price_per_unit}
                    onChange={(e) => updateExpenseItem(index, 'price_per_unit', e.target.value)}
                    className="price"
                  />
                  <div className="total">{item.total_cost?.toFixed(2) || '0.00'} ₴</div>
                  <button 
                    type="button" 
                    className="btn-delete" 
                    onClick={() => removeExpenseItem(index)}
                    title="Видалити"
                  >
                    ✕
                  </button>
                </div>
              ))}

              {formData.expense_items.length === 0 && (
                <p className="empty-hint">Натисніть &ldquo;+ Додати матеріал&rdquo; щоб додати витрати</p>
              )}
            </div>

            <div className="calculation-summary">
              <div className="calc-row">
                <span>Загальні витрати:</span>
                <strong>{totalExpenses.toFixed(2)} ₴</strong>
              </div>
              <div className="calc-row">
                <span>ЄП (5%):</span>
                <strong>{ep.toFixed(2)} ₴</strong>
              </div>
              <div className="calc-row">
                <span>ВЗ (1%):</span>
                <strong>{vz.toFixed(2)} ₴</strong>
              </div>
              <div className="calc-row">
                <span>Витрати + ЄП + ВЗ:</span>
                <strong>{expensesWithTax.toFixed(2)} ₴</strong>
              </div>
              <div className="calc-row highlight">
                <span>Кошти лікаря (AUTO):</span>
                <strong className={doctorShare >= 0 ? 'positive' : 'negative'}>
                  {doctorShare.toFixed(2)} ₴
                </strong>
              </div>
              <div className="calc-row highlight">
                <span>Дохід організації (AUTO):</span>
                <strong className={organizationIncome >= 0 ? 'positive' : 'negative'}>
                  {organizationIncome.toFixed(2)} ₴
                </strong>
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-success" data-testid="save-service-btn">
                {editingService ? 'Зберегти зміни' : 'Створити послугу'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={resetForm}>
                Скасувати
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <div className="card">
        <h3>Всі послуги ({services.length})</h3>
        {services.length === 0 ? (
          <div className="empty-state">
            <p>Послуг ще не додано</p>
          </div>
        ) : (
          <div className="services-list">
            {services.map((service) => (
              <div key={service.id} className="service-card" data-testid={`service-card-${service.id}`}>
                <div className="service-header">
                  <div className="service-title">
                    {service.code && <span className="service-code">{service.code}</span>}
                    <h4>{service.name}</h4>
                  </div>
                  <div className="service-actions">
                    <button 
                      className="btn-icon" 
                      onClick={() => setExpandedService(expandedService === service.id ? null : service.id)}
                      title="Деталі"
                      data-testid={`expand-service-${service.id}`}
                    >
                      {expandedService === service.id ? '▲' : '▼'}
                    </button>
                    <button 
                      className="btn-icon" 
                      onClick={() => handleEdit(service)} 
                      title="Редагувати"
                      data-testid={`edit-service-${service.id}`}
                    >
                      ✏️
                    </button>
                    <button 
                      className="btn-icon" 
                      onClick={() => handleDeleteService(service.id)} 
                      title="Видалити"
                      data-testid={`delete-service-${service.id}`}
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                <div className="service-summary">
                  <div className="summary-item">
                    <span>Ціна (Оборот):</span>
                    <strong>{service.price.toLocaleString('uk-UA')} ₴</strong>
                  </div>
                  <div className="summary-item">
                    <span>Лікарю (AUTO):</span>
                    <span>{service.doctor_share.toLocaleString('uk-UA')} ₴</span>
                  </div>
                  <div className="summary-item">
                    <span>Витрати:</span>
                    <span>{service.total_expenses?.toLocaleString('uk-UA') || 0} ₴</span>
                  </div>
                  <div className="summary-item">
                    <span>Витрати+ЄП+ВЗ:</span>
                    <span>{service.expenses_with_tax?.toLocaleString('uk-UA') || 0} ₴</span>
                  </div>
                  <div className="summary-item highlight">
                    <span>Дохід організації:</span>
                    <strong className="positive">{service.fop_income?.toLocaleString('uk-UA') || 0} ₴</strong>
                  </div>
                </div>

                {expandedService === service.id && service.expense_items && service.expense_items.length > 0 && (
                  <div className="service-details">
                    <h5>Склад витрат:</h5>
                    <table className="expense-details-table">
                      <thead>
                        <tr>
                          <th>Матеріал</th>
                          <th>Кількість</th>
                          <th>Ціна за од.</th>
                          <th>Сума</th>
                        </tr>
                      </thead>
                      <tbody>
                        {service.expense_items.map((item, idx) => (
                          <tr key={idx}>
                            <td>{item.material_name}</td>
                            <td>{item.quantity} {item.unit}</td>
                            <td>{item.price_per_unit.toFixed(2)} ₴</td>
                            <td><strong>{item.total_cost.toFixed(2)} ₴</strong></td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan="3"><strong>Всього:</strong></td>
                          <td><strong>{service.total_expenses?.toFixed(2) || 0} ₴</strong></td>
                        </tr>
                        <tr>
                          <td colSpan="3">ЄП (5%):</td>
                          <td>{(service.price * 0.05).toFixed(2)} ₴</td>
                        </tr>
                        <tr>
                          <td colSpan="3">ВЗ (1%):</td>
                          <td>{(service.price * 0.01).toFixed(2)} ₴</td>
                        </tr>
                        <tr>
                          <td colSpan="3">З податками:</td>
                          <td><strong>{service.expenses_with_tax?.toFixed(2) || 0} ₴</strong></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Підтвердження видалення</AlertDialogTitle>
            <AlertDialogDescription>
              Ви впевнені, що хочете видалити цю послугу? Цю дію неможливо скасувати.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setServiceToDelete(null)}>
              Скасувати
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Видалити
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Services;
