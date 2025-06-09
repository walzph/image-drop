import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import FileUploadArea from './FileUploadArea';
import ImagePreview from './ImagePreview';
import UploadProgress from './UploadProgress';

function ImageDropPage() {
  const { dropPath } = useParams();
  const [imageDrop, setImageDrop] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadState, setUploadState] = useState('select'); // 'select', 'preview', 'uploading', 'complete'
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
      setUploadState('select');
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
    setUploadState('select');
    setUploadProgress([]);
  };

  const handleCancel = () => {
    setSelectedFiles([]);
    setUploadState('select');
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
        
        {uploadState === 'select' && (
          <FileUploadArea onFilesSelected={handleFilesSelected} />
        )}
        
        {uploadState === 'preview' && (
          <ImagePreview 
            files={selectedFiles}
            onRemoveFile={handleRemoveFile}
            onAddMore={handleAddMoreFiles}
            onStartUpload={handleStartUpload}
            onCancel={handleCancel}
          />
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