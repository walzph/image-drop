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
        <button className="btn btn-secondary" onClick={fetchImages}>
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="gallery-container">
      <div className="gallery-header">
        <h2>Gallery ({images.length} images)</h2>
        <button className="btn" onClick={onAddImages}>
          Add Your Images
        </button>
      </div>

      {images.length === 0 ? (
        <div className="gallery-empty">
          <p>No images uploaded yet</p>
          <button className="btn" onClick={onAddImages}>
            Upload First Images
          </button>
        </div>
      ) : (
        <>
          <div className="gallery-controls">
            <button 
              className="btn btn-secondary" 
              onClick={handleSelectAll}
            >
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
                  `Download Selected (${selectedImages.length})`
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
                  src={image.url} 
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