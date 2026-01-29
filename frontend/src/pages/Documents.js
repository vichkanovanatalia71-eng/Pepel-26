import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Documents.css';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Documents = () => {
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [docType, setDocType] = useState('expense');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/documents`);
      setDocuments(response.data);
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const handleFileSelect = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('doc_type', docType);
    formData.append('month', month);
    formData.append('year', year);

    try {
      const response = await axios.post(`${API_URL}/api/documents/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      console.log('Upload response:', response.data);
      setSelectedFile(null);
      fetchDocuments();
      
      if (response.data.ai_analysis) {
        alert('✅ Документ успішно завантажено та проаналізовано AI!');
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('❌ Помилка завантаження документа');
    } finally {
      setUploading(false);
    }
  };

  const docTypeNames = {
    'nhs_report': '📄 Звіт НСЗУ',
    'declaration_chart': '📊 Графік декларацій',
    'expense': '📉 Документ витрат'
  };

  const monthNames = [
    'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
    'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'
  ];

  return (
    <div className="documents-page" data-testid="documents-page">
      <h1>📄 Документи</h1>

      <div className="card upload-card" style={{ marginBottom: '24px' }}>
        <h3>Завантажити документ з AI аналізом</h3>
        <form onSubmit={handleUpload}>
          <div className="form-group">
            <label>Тип документа</label>
            <select 
              value={docType} 
              onChange={(e) => setDocType(e.target.value)}
              data-testid="doc-type-select"
            >
              <option value="expense">📉 Витрати (PDF/Фото)</option>
              <option value="nhs_report">📄 Звіт НСЗУ (PDF)</option>
              <option value="declaration_chart">📊 Графік декларацій (Зображення)</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
            <div className="form-group">
              <label>Місяць</label>
              <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} data-testid="doc-month-select">
                {monthNames.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Рік</label>
              <input 
                type="number" 
                value={year} 
                onChange={(e) => setYear(parseInt(e.target.value))}
                data-testid="doc-year-input"
              />
            </div>
          </div>

          <div className="drop-zone" onClick={() => document.getElementById('file-input').click()}>
            {selectedFile ? (
              <>
                <div className="file-icon">📎</div>
                <p><strong>{selectedFile.name}</strong></p>
                <p className="file-size">{(selectedFile.size / 1024).toFixed(2)} KB</p>
              </>
            ) : (
              <>
                <div className="upload-icon">📤</div>
                <p>Клікніть або перетягніть файл сюди</p>
                <p className="file-types">PDF, JPG, PNG до 10MB</p>
              </>
            )}
          </div>
          <input 
            id="file-input" 
            type="file" 
            onChange={handleFileSelect} 
            accept=".pdf,.jpg,.jpeg,.png"
            style={{ display: 'none' }}
            data-testid="file-input"
          />

          <button 
            type="submit" 
            className="btn btn-success" 
            disabled={!selectedFile || uploading}
            style={{ width: '100%', marginTop: '16px' }}
            data-testid="upload-btn"
          >
            {uploading ? '🤖 Аналіз AI...' : '⬆️ Завантажити та проаналізувати'}
          </button>
        </form>
      </div>

      <div className="card">
        <h3>Всі документи</h3>
        {documents.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📂</div>
            <p>Документів ще немає</p>
            <p className="empty-hint">Завантажте перший документ вище</p>
          </div>
        ) : (
          <div className="documents-grid">
            {documents.map((doc) => (
              <div key={doc.id} className="document-card" data-testid={`doc-card-${doc.id}`}>
                <div className="doc-header">
                  <span className="doc-type">{docTypeNames[doc.type]}</span>
                  <span className="doc-date">
                    {doc.month && doc.year ? `${monthNames[doc.month - 1]} ${doc.year}` : ''}
                  </span>
                </div>
                <div className="doc-name">{doc.file_name}</div>
                {doc.ai_analysis && doc.ai_analysis.success && (
                  <div className="ai-badge">✨ AI проаналізовано</div>
                )}
                <div className="doc-footer">
                  <span className="doc-created">
                    {new Date(doc.created_at).toLocaleDateString('uk-UA')}
                  </span>
                  <button 
                    className="btn-link" 
                    onClick={() => window.open(`${API_URL}/api/documents/${doc.id}/download`, '_blank')}
                    data-testid={`download-doc-${doc.id}`}
                  >
                    ⬇️ Завантажити
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Documents;
