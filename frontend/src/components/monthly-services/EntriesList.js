import React from 'react';

const EntriesList = ({
  entries,
  services,
  doctors,
  monthNames,
  selectedEntries,
  onSelectEntry,
  onDeleteEntry,
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  onSelectAll,
  onBulkDelete
}) => {
  const handleSelectAll = (checked) => {
    if (checked) {
      const allIds = new Set(entries.map(e => e.id));
      onSelectAll(allIds);
    } else {
      onSelectAll(new Set());
    }
  };

  return (
    <div className="card">
      <div className="entries-header">
        <h3>Надані послуги ({entries.length})</h3>
        
        {selectedEntries.size > 0 && (
          <button 
            className="btn-bulk-delete"
            onClick={onBulkDelete}
          >
            🗑️ Видалити ({selectedEntries.size})
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="entries-controls">
        {/* Search */}
        <div className="search-box">
          <input 
            type="text"
            placeholder="Пошук (код, назва, лікар, місяць)..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="search-input"
          />
        </div>

        {/* Sort */}
        <div className="sort-box">
          <select 
            value={sortBy} 
            onChange={(e) => onSortChange(e.target.value)}
            className="sort-select"
          >
            <option value="date-desc">Нові → Старі</option>
            <option value="date-asc">Старі → Нові</option>
            <option value="amount-desc">Сума ↓</option>
            <option value="amount-asc">Сума ↑</option>
            <option value="quantity-desc">Кількість ↓</option>
            <option value="quantity-asc">Кількість ↑</option>
          </select>
        </div>

        {/* Select All */}
        <div className="select-all-box">
          <label className="checkbox-label">
            <input 
              type="checkbox"
              checked={selectedEntries.size === entries.length && entries.length > 0}
              onChange={(e) => handleSelectAll(e.target.checked)}
            />
            <span>Вибрати всі</span>
          </label>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="empty-state">
          <p>Записів не знайдено</p>
        </div>
      ) : (
        <div className="entries-list">
          {entries.map(entry => {
            const service = services.find(s => s.id === entry.service_id);
            const doctor = doctors.find(d => d.id === entry.doctor_id);
            const isSelected = selectedEntries.has(entry.id);
            
            return (
              <div key={entry.id} className={`entry-card ${isSelected ? 'selected-entry' : ''}`}>
                <div className="entry-checkbox-wrapper">
                  <input 
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => onSelectEntry(entry.id, e.target.checked)}
                    className="entry-checkbox"
                  />
                </div>
                <div className="entry-content">
                  <div className="entry-header">
                    <div className="entry-service">
                      {service?.code && <span className="service-code-small">{service.code}</span>}
                      <span className="service-name">{service?.name || 'N/A'}</span>
                    </div>
                    <button 
                      className="btn-delete-entry" 
                      onClick={() => onDeleteEntry(entry.id)}
                    >
                      🗑️
                    </button>
                  </div>
                  <div className="entry-details">
                    <div className="entry-info">
                      <span className="doctor-badge">{doctor?.short_name || 'N/A'}</span>
                      <span className="entry-period">{monthNames[entry.month - 1]} {entry.year}</span>
                      <span className="entry-qty">× {entry.quantity}</span>
                    </div>
                    <div className="entry-amount">
                      <strong>{entry.total_revenue.toLocaleString('uk-UA')} ₴</strong>
                    </div>
                  </div>
                  <div className="entry-financials">
                    <div className="fin-item">
                      <span>Витрати:</span>
                      <span>{entry.total_expenses.toLocaleString('uk-UA')} ₴</span>
                    </div>
                    <div className="fin-item">
                      <span>Лікарю:</span>
                      <span>{entry.doctor_income.toLocaleString('uk-UA')} ₴</span>
                    </div>
                    <div className="fin-item highlight">
                      <span>Дохід орг:</span>
                      <strong>{entry.fop_income.toLocaleString('uk-UA')} ₴</strong>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EntriesList;
