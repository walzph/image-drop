import React, { useState, useEffect } from 'react';
import { RefreshCw, Camera, CameraIcon, CheckSquare, Square, Download, MousePointer, Eye } from 'lucide-react';
import { PhotoProvider, PhotoView } from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';
import './Gallery.css';

function Gallery({ dropPath, onAddImages, onDownload }) {
  const [allImages, setAllImages] = useState([]); // All images from API
  const [loadedImages, setLoadedImages] = useState([]); // Images currently displayed
  const [selectedImages, setSelectedImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const imagesPerLoad = 50;

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
      setAllImages(data.images);
      // Load initial batch of images
      setLoadedImages(data.images.slice(0, imagesPerLoad));
      // Clear selections when fetching new images
      setSelectedImages([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreImages = () => {
    if (loadingMore || loadedImages.length >= allImages.length) return;
    
    setLoadingMore(true);
    // Simulate slight delay for better UX
    setTimeout(() => {
      const nextBatch = allImages.slice(0, loadedImages.length + imagesPerLoad);
      setLoadedImages(nextBatch);
      setLoadingMore(false);
    }, 200);
  };

  // Infinite scroll effect
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + document.documentElement.scrollTop 
          >= document.documentElement.offsetHeight - 1000) { // Load when 1000px from bottom
        loadMoreImages();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadedImages.length, allImages.length, loadingMore]);

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
    if (selectedImages.length === loadedImages.length) {
      setSelectedImages([]);
    } else {
      setSelectedImages(loadedImages.map(img => img.filename));
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
        <h2>Gallery ({allImages.length} images)</h2>
        {loadedImages.length < allImages.length && (
          <div className="scroll-info">
            Showing {loadedImages.length} of {allImages.length} images
          </div>
        )}
      </div>

      {allImages.length === 0 ? (
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
                  {selectedImages.length === loadedImages.length ? 
                    <Square className="btn-icon" size={16} /> :
                    <CheckSquare className="btn-icon" size={16} />
                  }
                  {selectedImages.length === loadedImages.length ? 'Deselect All' : `Select All (${loadedImages.length})`}
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
              {allImages.map((image, globalIndex) => {
                // Check if this image should be displayed (is it in loadedImages?)
                const isLoaded = globalIndex < loadedImages.length;
                
                return (
                  <div 
                    key={image.filename} 
                    className={`gallery-item ${isSelectMode && selectedImages.includes(image.filename) ? 'selected' : ''} ${isSelectMode ? 'select-mode' : 'view-mode'}`}
                    onClick={() => handleImageClick(image.filename)}
                    style={{ display: isLoaded ? 'block' : 'none' }}
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
                );
              })}
            </div>
          </PhotoProvider>

          {/* Loading indicator for infinite scroll */}
          {loadingMore && (
            <div className="loading-more">
              <p>Loading more images...</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Gallery;