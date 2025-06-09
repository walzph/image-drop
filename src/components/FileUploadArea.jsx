import React, { useRef, useState } from 'react';
import './FileUploadArea.css';

function FileUploadArea({ onFilesSelected }) {
  const fileInputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileInputChange = (e) => {
    const files = Array.from(e.target.files).filter(file => file.type.startsWith('image/'));
    if (files.length > 0) {
      onFilesSelected(files);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
    if (files.length > 0) {
      onFilesSelected(files);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <>
      <div 
        className={`upload-area ${isDragOver ? 'dragover' : ''}`}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="upload-icon">📱</div>
        <div className="upload-text">Tap to select images</div>
        <div className="upload-subtext">or drag and drop files here</div>
      </div>
      
      <input 
        ref={fileInputRef}
        type="file" 
        multiple 
        accept="image/*" 
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />
    </>
  );
}

export default FileUploadArea;