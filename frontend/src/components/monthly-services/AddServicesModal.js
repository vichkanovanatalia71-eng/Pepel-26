import React, { useState } from 'react';
import axios from 'axios';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const AddServicesModal = ({ 
  isOpen, 
  onClose, 
  doctors,
  services,
  monthNames,
  onSave
}) => {
  const [selectionCollapsed, setSelectionCollapsed] = useState(false);
  const [modalDoctor, setModalDoctor] = useState(doctors[0]?.id || '');
  const [modalMonth, setModalMonth] = useState(new Date().getMonth() + 1);
  const [modalYear, setModalYear] = useState(new Date().getFullYear());
  const [quantities, setQuantities] = useState({});
  const [uploadedImage, setUploadedImage] = useState(null);
  const [aiProcessing, setAiProcessing] = useState(false);

  // Update doctor when doctors list changes
  React.useEffect(() => {
    if (doctors.length > 0 && !modalDoctor) {
      setModalDoctor(doctors[0].id);
    }
  }, [doctors, modalDoctor]);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setUploadedImage(file);
    setAiProcessing(true);
    
    try {
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await axios.post(`${API_URL}/api/services/analyze-image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (response.data.parsed_services) {
        const newQuantities = { ...quantities };
        response.data.parsed_services.forEach(item => {
          const service = services.find(s => 
            s.code === item.code || 
            s.name.toLowerCase().includes(item.name?.toLowerCase())
          );
          if (service && item.quantity > 0) {
            newQuantities[service.id] = item.quantity;
          }
        });
        setQuantities(newQuantities);
      }
    } catch (error) {
      console.error('AI analysis error:', error);
      alert('Помилка аналізу зображення');
    } finally {
      setAiProcessing(false);
    }
  };

  const handleBulkAdd = async () => {
    const servicesToAdd = Object.entries(quantities)
      .filter(([_, qty]) => qty > 0)
      .map(([serviceId, quantity]) => ({
        service_id: serviceId,
        doctor_id: modalDoctor,
        month: modalMonth,
        year: modalYear,
        quantity: parseInt(quantity)
      }));

    if (servicesToAdd.length === 0) {
      alert('Оберіть хоча б одну послугу');
      return;
    }

    try {
      for (const entry of servicesToAdd) {
        await axios.post(`${API_URL}/api/monthly-services`, entry);
      }
      
      setQuantities({});
      setSelectionCollapsed(false);
      onSave();
      onClose();
    } catch (error) {
      console.error('Save error:', error);
      alert('Помилка збереження');
    }
  };

  const handleClose = () => {
    setQuantities({});
    setSelectionCollapsed(false);
    setUploadedImage(null);
    onClose();
  };

  const selectedCount = Object.keys(quantities).filter(id => quantities[id] > 0).length;
  const currentDoctor = doctors.find(d => d.id === modalDoctor);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto revenue-modal add-services-modal">
        <DialogHeader>
          <DialogTitle>Додати надані послуги</DialogTitle>
        </DialogHeader>
        
        <div className="modal-form">
          {/* Sticky header with collapse */}
          <div className="selection-section sticky-selection">
            {!selectionCollapsed ? (
              <>
                <div className="form-group">
                  <label>Лікар</label>
                  <select value={modalDoctor} onChange={(e) => setModalDoctor(e.target.value)}>
                    {doctors.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.short_name})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Місяць</label>
                  <select value={modalMonth} onChange={(e) => setModalMonth(parseInt(e.target.value))}>
                    {monthNames.map((m, i) => (
                      <option key={i} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Рік</label>
                  <input 
                    type="number" 
                    value={modalYear} 
                    onChange={(e) => setModalYear(parseInt(e.target.value))}
                  />
                </div>
                <button 
                  type="button"
                  className="btn-collapse-selection"
                  onClick={() => setSelectionCollapsed(true)}
                >
                  ✓ Підтвердити
                </button>
              </>
            ) : (
              <div className="selection-collapsed">
                <div className="collapsed-info">
                  <span className="collapsed-badge">
                    {currentDoctor?.short_name || 'Лікар'}
                  </span>
                  <span className="collapsed-period">
                    {monthNames[modalMonth - 1]} {modalYear}
                  </span>
                </div>
                <button 
                  type="button"
                  className="btn-expand-selection"
                  onClick={() => setSelectionCollapsed(false)}
                >
                  Змінити
                </button>
              </div>
            )}
          </div>

          {/* Selected services badge */}
          {selectedCount > 0 && (
            <div className="selected-services-badge">
              Вибрано: <strong>{selectedCount}</strong> послуг
            </div>
          )}

          {/* AI Upload */}
          <div className="ai-upload-section">
            <label className="upload-image-btn">
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleImageUpload}
                style={{ display: 'none' }}
              />
              {aiProcessing ? (
                <span>🤖 Аналіз AI...</span>
              ) : (
                <span>📷 Завантажити зображення з послугами</span>
              )}
            </label>
            {uploadedImage && !aiProcessing && (
              <div className="uploaded-image-info">
                ✓ {uploadedImage.name}
              </div>
            )}
          </div>

          <div className="services-grid-modal">
            <div className="services-header-mobile">
              <h4>Всі послуги ({services.length}):</h4>
              <button 
                type="button"
                className="btn-show-selected"
                onClick={() => {
                  if (selectedCount > 0) {
                    document.querySelector('.services-scroll-container')?.scrollTo(0, 0);
                  }
                }}
              >
                {selectedCount > 0 
                  ? '✓ Показати вибрані' 
                  : 'Оберіть послуги'
                }
              </button>
            </div>
            
            <div className="services-scroll-container">
              {/* Selected services first */}
              {services
                .filter(s => quantities[s.id] > 0)
                .map(service => (
                  <div key={service.id} className="service-input-row selected-service-row">
                    <div className="service-name-row">
                      <span className="service-name-small">{service.name}</span>
                    </div>
                    <div className="service-details-row">
                      <span className="service-code-badge">{service.code}</span>
                      <span className="price-label">{service.price} ₴</span>
                      <input 
                        type="number"
                        min="0"
                        value={quantities[service.id] || ''}
                        onChange={(e) => setQuantities({
                          ...quantities,
                          [service.id]: parseInt(e.target.value) || 0
                        })}
                        placeholder="0"
                        className="qty-input qty-input-filled"
                      />
                    </div>
                  </div>
                ))
              }
              
              {/* Remaining services */}
              {services
                .filter(s => !quantities[s.id] || quantities[s.id] === 0)
                .map(service => (
                  <div key={service.id} className="service-input-row">
                    <div className="service-name-row">
                      <span className="service-name-small">{service.name}</span>
                    </div>
                    <div className="service-details-row">
                      <span className="service-code-badge">{service.code}</span>
                      <span className="price-label">{service.price} ₴</span>
                      <input 
                        type="number"
                        min="0"
                        value={quantities[service.id] || ''}
                        onChange={(e) => setQuantities({
                          ...quantities,
                          [service.id]: parseInt(e.target.value) || 0
                        })}
                        placeholder="0"
                        className="qty-input"
                      />
                    </div>
                  </div>
                ))
              }
            </div>
          </div>

          {/* Sticky footer on mobile */}
          <div className="modal-actions sticky-actions">
            <button className="btn btn-success" onClick={handleBulkAdd}>
              Зберегти ({selectedCount})
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={handleClose}
            >
              Скасувати
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddServicesModal;
