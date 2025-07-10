import React, { useState, useEffect } from 'react';
import { RefreshCw, Camera, CameraIcon, CheckSquare, Square, Download, MousePointer, Eye } from 'lucide-react';
import { PhotoProvider, PhotoView } from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';
import './Gallery.css';

function Gallery({ dropPath, onAddImages, onDownload }) {
  const [images, setImages] = useState([]);
  const [selectedImages, setSelectedImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);
  const [isSelectMode, setIsSelectMode] = useState(false);

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

  const handleImageClick = (filename) => {
    if (isSelectMode) {
      handleImageSelect(filename);
    }
    // If not in select mode, PhotoView will handle the fullscreen viewer
  };

  const toggleSelectMode = () => {
    setIsSelectMode(!isSelectMode);
    if (!isSelectMode) {
      // Entering select mode - clear selections
      setSelectedImages([]);
    }
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
            <RefreshCw className="btn-icon" size={16} />
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
      </div>

      {images.length === 0 ? (
        <div className="gallery-empty">
          <p>No images uploaded yet</p>
          <div className="button-row">
            <button className="btn" onClick={onAddImages}>
              <CameraIcon className="btn-icon" size={16} />
              Upload First Images
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="gallery-actions">
            <div className="button-row">
              <button className="btn" onClick={onAddImages}>
                <Camera className="btn-icon" size={16} />
                Add Images
              </button>
              <button 
                className={`btn ${isSelectMode ? 'btn-secondary' : ''}`}
                onClick={toggleSelectMode}
              >
                {isSelectMode ? (
                  <>
                    <Eye className="btn-icon" size={16} />
                    View Mode
                  </>
                ) : (
                  <>
                    <MousePointer className="btn-icon" size={16} />
                    Select
                  </>
                )}
              </button>
              {isSelectMode && (
                <button 
                  className="btn btn-secondary" 
                  onClick={handleSelectAll}
                >
                  {selectedImages.length === images.length ? 
                    <Square className="btn-icon" size={16} /> :
                    <CheckSquare className="btn-icon" size={16} />
                  }
                  {selectedImages.length === images.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
              {isSelectMode && (
                <button 
                  className={`btn ${downloading ? 'downloading' : ''} ${selectedImages.length === 0 ? 'btn-disabled' : ''}`}
                  onClick={handleDownload}
                  disabled={downloading || selectedImages.length === 0}
                >
                  {downloading ? (
                    <>
                      <span className="spinner"></span>
                      Preparing Download...
                    </>
                  ) : (
                    <>
                      <Download className="btn-icon" size={16} />
                      Download {selectedImages.length > 0 ? `(${selectedImages.length})` : ''}
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          <PhotoProvider>
            <div className="gallery-grid">
              {images.map((image) => (
                <div 
                  key={image.filename} 
                  className={`gallery-item ${isSelectMode && selectedImages.includes(image.filename) ? 'selected' : ''} ${isSelectMode ? 'select-mode' : 'view-mode'}`}
                  onClick={() => handleImageClick(image.filename)}
                >
                  {isSelectMode ? (
                    <img 
                      src={image.thumbnailUrl || image.url} 
                      alt={image.filename}
                      className="gallery-image"
                      loading="lazy"
                    />
                  ) : (
                    <PhotoView 
                      src={image.url} 
                      key={image.filename}
                    >
                      <img 
                        src={image.thumbnailUrl || image.url} 
                        alt={image.filename}
                        className="gallery-image"
                        loading="lazy"
                      />
                    </PhotoView>
                  )}
                  {isSelectMode && (
                    <div className="gallery-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedImages.includes(image.filename)}
                        onChange={() => handleImageSelect(image.filename)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  )}
                  <div className="gallery-filename">
                    {image.filename}
                  </div>
                </div>
              ))}
            </div>
          </PhotoProvider>
        </>
      )}
    </div>
  );
}

export default Gallery;