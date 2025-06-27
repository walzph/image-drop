import React, { useState, useEffect } from 'react';
import './Gallery.css';

function Gallery({ dropPath, onAddImages, onDownload }) {
  const [images, setImages] = useState([]);
  const [selectedImages, setSelectedImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchImages();
  }, [dropPath]);

  const fetchImages = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/images/${dropPath}`);
      if (!response.ok) {
        throw new Error('Failed to load images');
      }
      const data = await response.json();
      setImages(data.images);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImageSelect = (filename) => {
    setSelectedImages(prev => 
      prev.includes(filename) 
        ? prev.filter(f => f !== filename)
        : [...prev, filename]
    );
  };

  const handleSelectAll = () => {
    if (selectedImages.length === images.length) {
      setSelectedImages([]);
    } else {
      setSelectedImages(images.map(img => img.filename));
    }
  };

  const handleDownload = async () => {
    if (selectedImages.length > 0 && onDownload && !downloading) {
      setDownloading(true);
      try {
        await onDownload(selectedImages);
      } catch (error) {
        console.error('Download failed:', error);
      } finally {
        setDownloading(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="gallery-loading">
        <p>Loading images...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="gallery-error">
        <p>Error: {error}</p>
        <div className="button-row">
          <button className="btn btn-secondary" onClick={fetchImages}>
            <span className="btn-icon">🔄</span>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="gallery-container">
      <div className="gallery-header">
        <h2>Gallery ({images.length} images)</h2>
        <div className="button-row">
          <button className="btn" onClick={onAddImages}>
            <span className="btn-icon">📷</span>
            Add Your Images
          </button>
        </div>
      </div>

      {images.length === 0 ? (
        <div className="gallery-empty">
          <p>No images uploaded yet</p>
          <div className="button-row">
            <button className="btn" onClick={onAddImages}>
              <span className="btn-icon">📸</span>
              Upload First Images
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="button-row gallery-controls">
            <button 
              className="btn btn-secondary" 
              onClick={handleSelectAll}
            >
              <span className="btn-icon">{selectedImages.length === images.length ? '☑️' : '☐'}</span>
              {selectedImages.length === images.length ? 'Deselect All' : 'Select All'}
            </button>
            {selectedImages.length > 0 && (
              <button 
                className={`btn ${downloading ? 'downloading' : ''}`}
                onClick={handleDownload}
                disabled={downloading}
              >
                {downloading ? (
                  <>
                    <span className="spinner"></span>
                    Preparing Download...
                  </>
                ) : (
                  <>
                    <span className="btn-icon">💾</span>
                    Download ({selectedImages.length})
                  </>
                )}
              </button>
            )}
          </div>

          <div className="gallery-grid">
            {images.map((image) => (
              <div 
                key={image.filename} 
                className={`gallery-item ${selectedImages.includes(image.filename) ? 'selected' : ''}`}
                onClick={() => handleImageSelect(image.filename)}
              >
                <img 
                  src={image.thumbnailUrl || image.url} 
                  alt={image.filename}
                  className="gallery-image"
                  loading="lazy"
                />
                <div className="gallery-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedImages.includes(image.filename)}
                    onChange={() => handleImageSelect(image.filename)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="gallery-filename">
                  {image.filename}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default Gallery;