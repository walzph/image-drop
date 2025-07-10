import React, { useState, useEffect } from 'react';
import { RefreshCw, Camera, CameraIcon, CheckSquare, Square, Download, MousePointer, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { PhotoProvider, PhotoView } from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';
import './Gallery.css';

function Gallery({ dropPath, onAddImages, onDownload }) {
  const [allImages, setAllImages] = useState([]); // All images for PhotoProvider
  const [selectedImages, setSelectedImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const imagesPerPage = 50;

  useEffect(() => {
    fetchImages();
    setCurrentPage(1); // Reset to page 1 when dropPath changes
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
      // Clear selections when fetching new images
      setSelectedImages([]);
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

  // Client-side pagination calculations
  const totalImages = allImages.length;
  const totalPages = Math.ceil(totalImages / imagesPerPage);
  const startIndex = (currentPage - 1) * imagesPerPage;
  const endIndex = startIndex + imagesPerPage;
  const currentPageImages = allImages.slice(startIndex, endIndex);
  
  const pagination = {
    page: currentPage,
    limit: imagesPerPage,
    total: totalImages,
    totalPages,
    hasNext: currentPage < totalPages,
    hasPrev: currentPage > 1
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      // Clear selections when changing pages
      setSelectedImages([]);
    }
  };

  const handleSelectAll = () => {
    if (selectedImages.length === currentPageImages.length) {
      setSelectedImages([]);
    } else {
      setSelectedImages(currentPageImages.map(img => img.filename));
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
        <h2>Gallery ({pagination.total} images)</h2>
        {pagination.totalPages > 1 && (
          <div className="pagination-info">
            Page {pagination.page} of {pagination.totalPages}
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
                  {selectedImages.length === currentPageImages.length ? 
                    <Square className="btn-icon" size={16} /> :
                    <CheckSquare className="btn-icon" size={16} />
                  }
                  {selectedImages.length === currentPageImages.length ? 'Deselect All' : 'Select All'}
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
                // Check if this image should be displayed on current page
                const isOnCurrentPage = globalIndex >= startIndex && globalIndex < endIndex;
                
                return (
                  <div 
                    key={image.filename} 
                    className={`gallery-item ${isSelectMode && selectedImages.includes(image.filename) ? 'selected' : ''} ${isSelectMode ? 'select-mode' : 'view-mode'}`}
                    onClick={() => handleImageClick(image.filename)}
                    style={{ display: isOnCurrentPage ? 'block' : 'none' }}
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

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="pagination-controls">
              
              <div className="pagination-pages">

              <button 
                className="btn btn-secondary pagination-btn" 
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={!pagination.hasPrev}
              >
                <ChevronLeft className="btn-icon" size={16} />
                Previous
              </button>
                {/* Show first page */}
                {pagination.page > 3 && (
                  <>
                    <button 
                      className="btn btn-secondary pagination-page" 
                      onClick={() => handlePageChange(1)}
                    >
                      1
                    </button>
                    {pagination.page > 4 && <span className="pagination-ellipsis">...</span>}
                  </>
                )}
                
                {/* Show pages around current page */}
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  const startPage = Math.max(1, Math.min(pagination.page - 2, pagination.totalPages - 4));
                  const pageNum = startPage + i;
                  
                  if (pageNum <= pagination.totalPages) {
                    return (
                      <button 
                        key={pageNum}
                        className={`btn pagination-page ${pageNum === pagination.page ? '' : 'btn-secondary'}`}
                        onClick={() => handlePageChange(pageNum)}
                      >
                        {pageNum}
                      </button>
                    );
                  }
                  return null;
                })}
                
                {/* Show last page */}
                {pagination.page < pagination.totalPages - 2 && (
                  <>
                    {pagination.page < pagination.totalPages - 3 && <span className="pagination-ellipsis">...</span>}
                    <button 
                      className="btn btn-secondary pagination-page" 
                      onClick={() => handlePageChange(pagination.totalPages)}
                    >
                      {pagination.totalPages}
                    </button>
                  </>
                )}

              <button 
                className="btn btn-secondary pagination-btn" 
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={!pagination.hasNext}
              >
                Next
                <ChevronRight className="btn-icon" size={16} />
              </button>
              </div>
              
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Gallery;