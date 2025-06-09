import React from 'react';
import './UploadProgress.css';

function UploadProgress({ progress, isComplete, onReset }) {
  const totalFiles = progress.length;
  const completedFiles = progress.filter(item => item.status === 'complete').length;
  const progressPercentage = totalFiles > 0 ? (completedFiles / totalFiles) * 100 : 0;

  return (
    <div className="progress-container">
      {isComplete && (
        <div className="success-message">
          <h3>✅ Upload Complete!</h3>
          <p>All images have been uploaded successfully.</p>
          <button className="btn" onClick={onReset}>
            Upload More Images
          </button>
        </div>
      )}
      
      <div className="progress-header">
        <div>Uploading images...</div>
        <div className="progress-stats">
          {completedFiles} of {totalFiles} complete
        </div>
      </div>
      
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
              {item.status === 'pending' && '⏳'}
              {item.status === 'uploading' && '📸'}
              {item.status === 'complete' && '✅'}
              {item.status === 'failed' && '❌'}
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