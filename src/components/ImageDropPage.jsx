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

  const handleStartUpload = async () => {
    setUploadState('uploading');
    setUploadProgress(selectedFiles.map(file => ({ 
      name: file.name, 
      status: 'pending',
      message: 'Waiting to upload...'
    })));

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      
      // Update progress to uploading
      setUploadProgress(prev => prev.map((item, index) => 
        index === i ? { ...item, status: 'uploading', message: 'Uploading...' } : item
      ));

      try {
        const formData = new FormData();
        formData.append('images', file);
        
        const response = await fetch(`/api/upload/${dropPath}`, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          throw new Error('Upload failed');
        }

        // Update progress to complete
        setUploadProgress(prev => prev.map((item, index) => 
          index === i ? { ...item, status: 'complete', message: 'Complete' } : item
        ));
      } catch (error) {
        // Update progress to failed
        setUploadProgress(prev => prev.map((item, index) => 
          index === i ? { ...item, status: 'failed', message: 'Failed' } : item
        ));
      }
    }

    setUploadState('complete');
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
            <button className="btn btn-secondary" onClick={handleBackToGallery} style={{ marginBottom: '20px' }}>
              ← Back to Gallery
            </button>
            <FileUploadArea onFilesSelected={handleFilesSelected} />
          </>
        )}
        
        {uploadState === 'preview' && (
          <>
            <button className="btn btn-secondary" onClick={handleBackToGallery} style={{ marginBottom: '20px' }}>
              ← Back to Gallery
            </button>
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
            onReset={handleReset}
          />
        )}
      </div>
    </div>
    </>
  );
}

export default ImageDropPage;