import React from 'react';
import { CheckCircle, Camera, X, Clock, AlertCircle } from 'lucide-react';
import './UploadProgress.css';

function UploadProgress({ progress, isComplete, isUploading, onReset, onCancel }) {
  const totalFiles = progress.length;
  const completedFiles = progress.filter(item => item.status === 'complete').length;
  const progressPercentage = totalFiles > 0 ? (completedFiles / totalFiles) * 100 : 0;

  return (
    <div className="progress-container">
      {isComplete && (
        <div className="success-message">
          <h3><CheckCircle className="inline-icon" size={20} /> Upload Complete!</h3>
          <p>All images have been uploaded successfully.</p>
          <div className="button-row">
            <button className="btn" onClick={onReset}>
              <Camera className="btn-icon" size={16} />
              Back to Gallery
            </button>
          </div>
        </div>
      )}
      
      {!isComplete && (
        <div className="progress-header">
          <div>Uploading images...</div>
          <div className="progress-stats">
            {completedFiles} of {totalFiles} complete
          </div>
        </div>
      )}
      
      {isUploading && onCancel && (
        <div className="button-row" style={{ marginBottom: '15px' }}>
          <button className="btn btn-secondary" onClick={onCancel}>
            <X className="btn-icon" size={16} />
            Cancel
          </button>
        </div>
      )}
      
      <div className="progress-bar">
        <div 
          className="progress-fill" 
          style={{ width: `${progressPercentage}%` }}
        />
      </div>
      
      <div className="file-list">
        {progress.map((item, index) => (
          <div key={index} className={`file-item ${item.status}`}>
            <span className="file-icon">
              {item.status === 'pending' && <Clock size={16} />}
              {item.status === 'uploading' && <Camera size={16} />}
              {item.status === 'complete' && <CheckCircle size={16} />}
              {item.status === 'failed' && <AlertCircle size={16} />}
              {item.status === 'cancelled' && <X size={16} />}
            </span>
            <span className="file-name">{item.name}</span>
            <span className="file-status">{item.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default UploadProgress;