import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import FileUploadArea from './FileUploadArea';
import ImagePreview from './ImagePreview';
import UploadProgress from './UploadProgress';
import Gallery from './Gallery';

function ImageDropPage() {
  const { dropPath } = useParams();
  const [imageDrop, setImageDrop] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadState, setUploadState] = useState('gallery'); // 'gallery', 'select', 'preview', 'uploading', 'complete'
  const [uploadProgress, setUploadProgress] = useState([]);
  const [error, setError] = useState(null);
  const [uploadController, setUploadController] = useState(null);

  useEffect(() => {
    fetchImageDropConfig();
  }, [dropPath]);

  const fetchImageDropConfig = async () => {
    try {
      const response = await fetch(`/api/drops/${dropPath}`);
      if (!response.ok) {
        throw new Error('Image drop not found');
      }
      const data = await response.json();
      setImageDrop(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddImages = () => {
    setUploadState('select');
  };

  const handleDownload = async (selectedImageFilenames) => {
    try {
      const response = await fetch(`/api/download/${dropPath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filenames: selectedImageFilenames }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${dropPath}-images.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
      alert(`Failed to download images: ${error.message}`);
      throw error;
    }
  };

  const handleBackToGallery = () => {
    setUploadState('gallery');
    setSelectedFiles([]);
    setUploadProgress([]);
  };

  const handleFilesSelected = (files) => {
    setSelectedFiles(files);
    setUploadState('preview');
  };

  const handleAddMoreFiles = (newFiles) => {
    // Filter out duplicates based on name and size
    const existingFileKeys = selectedFiles.map(f => `${f.name}-${f.size}`);
    const uniqueNewFiles = newFiles.filter(f => !existingFileKeys.includes(`${f.name}-${f.size}`));
    setSelectedFiles([...selectedFiles, ...uniqueNewFiles]);
  };

  const handleRemoveFile = (index) => {
    const newFiles = [...selectedFiles];
    newFiles.splice(index, 1);
    setSelectedFiles(newFiles);
    
    if (newFiles.length === 0) {
      setUploadState('gallery');
    }
  };

  const uploadFileWithRetry = async (file, maxRetries = 3) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      setUploadController(controller);
      
      try {
        const formData = new FormData();
        formData.append('images', file);
        
        const response = await fetch(`/api/upload/${dropPath}`, {
          method: 'POST',
          body: formData,
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.status}`);
        }

        return await response.json();
      } catch (error) {
        if (error.name === 'AbortError') {
          throw error; // Don't retry if cancelled
        }
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  };

  const handleStartUpload = async () => {
    setUploadState('uploading');
    setUploadProgress(selectedFiles.map(file => ({ 
      name: file.name, 
      status: 'pending',
      message: 'Waiting to upload...'
    })));

    let hasErrors = false;

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      
      // Update progress to uploading
      setUploadProgress(prev => prev.map((item, index) => 
        index === i ? { ...item, status: 'uploading', message: 'Uploading...' } : item
      ));

      try {
        await uploadFileWithRetry(file);
        
        // Update progress to complete
        setUploadProgress(prev => prev.map((item, index) => 
          index === i ? { ...item, status: 'complete', message: 'Complete' } : item
        ));
      } catch (error) {
        hasErrors = true;
        let message = 'Failed';
        
        if (error.name === 'AbortError') {
          message = 'Cancelled';
          // If cancelled, mark remaining files as cancelled too
          setUploadProgress(prev => prev.map((item, index) => 
            index >= i ? { ...item, status: 'cancelled', message: 'Cancelled' } : item
          ));
          break;
        } else if (error.message.includes('429')) {
          message = 'Rate limited - try again later';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          message = 'Network error - check connection';
        }
        
        // Update progress to failed
        setUploadProgress(prev => prev.map((item, index) => 
          index === i ? { ...item, status: 'failed', message } : item
        ));
      }
    }

    setUploadController(null);
    setUploadState('complete');
  };

  const handleCancelUpload = () => {
    if (uploadController) {
      uploadController.abort();
      setUploadController(null);
    }
  };

  const handleReset = () => {
    setSelectedFiles([]);
    setUploadState('gallery');
    setUploadProgress([]);
  };

  const handleCancel = () => {
    setSelectedFiles([]);
    setUploadState('gallery');
  };

  if (error) {
    return (
      <div className="glass-container">
        <h1>Error</h1>
        <p>{error}</p>
      </div>
    );
  }

  if (!imageDrop) {
    return (
      <div className="glass-container">
        <h1>Loading...</h1>
      </div>
    );
  }

  const pageStyle = {
    backgroundImage: imageDrop.backgroundImage ? 
      `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url('${imageDrop.backgroundImage}')` : 
      'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed',
    minHeight: '100vh',
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1
  };

  return (
    <>
      <div style={pageStyle}></div>
      <div className="container">
      <div className="glass-container">
        <h1>{imageDrop.name}</h1>
        
        {uploadState === 'gallery' && (
          <Gallery 
            dropPath={dropPath}
            onAddImages={handleAddImages}
            onDownload={handleDownload}
          />
        )}
        
        {uploadState === 'select' && (
          <>
            <div className="button-row" style={{ marginBottom: '15px' }}>
              <button className="btn btn-secondary" onClick={handleBackToGallery}>
                <span className="btn-icon">←</span>
                Back to Gallery
              </button>
            </div>
            <FileUploadArea onFilesSelected={handleFilesSelected} />
          </>
        )}
        
        {uploadState === 'preview' && (
          <>
            <div className="button-row" style={{ marginBottom: '15px' }}>
              <button className="btn btn-secondary" onClick={handleBackToGallery}>
                <span className="btn-icon">←</span>
                Back to Gallery
              </button>
            </div>
            <ImagePreview 
              files={selectedFiles}
              onRemoveFile={handleRemoveFile}
              onAddMore={handleAddMoreFiles}
              onStartUpload={handleStartUpload}
              onCancel={handleCancel}
            />
          </>
        )}
        
        {(uploadState === 'uploading' || uploadState === 'complete') && (
          <UploadProgress 
            progress={uploadProgress}
            isComplete={uploadState === 'complete'}
            isUploading={uploadState === 'uploading'}
            onReset={handleReset}
            onCancel={handleCancelUpload}
          />
        )}
      </div>
    </div>
    </>
  );
}

export default ImageDropPage;