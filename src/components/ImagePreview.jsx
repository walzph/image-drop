import React, { useRef } from 'react';
import './ImagePreview.css';

function ImagePreview({ files, onRemoveFile, onAddMore, onStartUpload, onCancel }) {
  const addMoreInputRef = useRef(null);

  const handleAddMoreClick = () => {
    addMoreInputRef.current?.click();
  };

  const handleAddMoreChange = (e) => {
    const newFiles = Array.from(e.target.files).filter(file => file.type.startsWith('image/'));
    if (newFiles.length > 0) {
      onAddMore(newFiles);
    }
    e.target.value = ''; // Reset input
  };

  return (
    <div className="preview-container">
      <h3>Selected Images</h3>
      
      <div className="preview-grid">
        {files.map((file, index) => (
          <div key={index} className="preview-item">
            <img 
              src={URL.createObjectURL(file)} 
              alt={file.name}
              className="preview-image"
            />
            <button 
              className="preview-remove"
              onClick={() => onRemoveFile(index)}
              aria-label="Remove image"
            >
              ×
            </button>
            <div className="preview-filename">
              {file.name}
            </div>
          </div>
        ))}
      </div>
      
      <div className="button-row upload-controls">
        <button className="btn" onClick={onStartUpload}>
          <span className="btn-icon">☁️</span>
          Upload Images
        </button>
        <button className="btn btn-secondary" onClick={handleAddMoreClick}>
          <span className="btn-icon">➕</span>
          Add More
        </button>
        <button className="btn btn-secondary" onClick={onCancel}>
          <span className="btn-icon">✖️</span>
          Cancel
        </button>
      </div>
      
      <input 
        ref={addMoreInputRef}
        type="file" 
        multiple 
accept="image/*,image/jpeg,image/png,image/heic,image/heif" 
        style={{ display: 'none' }}
        onChange={handleAddMoreChange}
      />
    </div>
  );
}

export default ImagePreview;