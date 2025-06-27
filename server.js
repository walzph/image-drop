const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const config = require('./config.json');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dropPath = req.params.path;
    const imageDrop = config.imageDrops.find(drop => drop.path === dropPath);
    
    if (!imageDrop) {
      return cb(new Error('Invalid image drop path'));
    }

    const uploadDir = imageDrop.subdirectory;
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const dropPath = req.params.path;
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, dropPath + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Image Drop App</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                color: white;
            }
            .container {
                background: rgba(255, 255, 255, 0.1);
                padding: 30px;
                border-radius: 15px;
                backdrop-filter: blur(10px);
                text-align: center;
            }
            h1 {
                margin-bottom: 20px;
            }
            p {
                font-size: 18px;
                line-height: 1.6;
                margin-bottom: 20px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🖼️ Image Drop App</h1>
            <p>Welcome to the Image Drop App! This application allows you to create simple, beautiful image upload experiences.</p>
            <p>Each image drop is configured with a unique URL path, custom background, and dedicated storage location.</p>
            <p>To access an image drop, navigate to <strong>/&lt;drop-path&gt;</strong> where &lt;drop-path&gt; is the configured path for your image drop.</p>
        </div>
    </body>
    </html>
  `);
});

app.get('/:path', (req, res) => {
  const dropPath = req.params.path;
  const imageDrop = config.imageDrops.find(drop => drop.path === dropPath);
  
  if (!imageDrop) {
    return res.status(404).send('Image drop not found');
  }

  const escapedName = imageDrop.name.replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/"/g, '&quot;');

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${escapedName} - Upload Images</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                min-height: 100vh;
                background-image: linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url('${imageDrop.backgroundImage}');
                background-size: cover;
                background-position: center;
                background-attachment: fixed;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
            }
            
            .upload-container {
                background: rgba(255, 255, 255, 0.15);
                backdrop-filter: blur(15px);
                border-radius: 20px;
                padding: 40px;
                text-align: center;
                box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                border: 1px solid rgba(255,255,255,0.2);
                max-width: 500px;
                width: 90%;
            }
            
            h1 {
                font-size: 2.5em;
                margin-bottom: 20px;
                font-weight: 300;
            }
            
            .upload-area {
                border: 3px dashed rgba(255,255,255,0.5);
                border-radius: 15px;
                padding: 40px 20px;
                margin: 30px 0;
                cursor: pointer;
                transition: all 0.3s ease;
                background: rgba(255,255,255,0.05);
            }
            
            .preview-container {
                display: none;
                margin-top: 20px;
            }
            
            .preview-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
                gap: 15px;
                margin: 20px 0;
            }
            
            .preview-item {
                position: relative;
                border-radius: 10px;
                overflow: hidden;
                background: rgba(255,255,255,0.1);
                aspect-ratio: 1;
            }
            
            .preview-image {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            
            .preview-remove {
                position: absolute;
                top: 5px;
                right: 5px;
                background: rgba(255,0,0,0.8);
                color: white;
                border: none;
                border-radius: 50%;
                width: 25px;
                height: 25px;
                cursor: pointer;
                font-size: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .preview-filename {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                background: rgba(0,0,0,0.7);
                color: white;
                padding: 5px;
                font-size: 10px;
                text-overflow: ellipsis;
                overflow: hidden;
                white-space: nowrap;
            }
            
            .upload-controls {
                margin-top: 20px;
            }
            
            .btn-secondary {
                background: rgba(255,255,255,0.2);
                color: white;
                border: 1px solid rgba(255,255,255,0.3);
            }
            
            .upload-area:hover {
                border-color: rgba(255,255,255,0.8);
                background: rgba(255,255,255,0.1);
            }
            
            .upload-area.dragover {
                border-color: #4CAF50;
                background: rgba(76, 175, 80, 0.2);
            }
            
            .upload-icon {
                font-size: 4em;
                margin-bottom: 20px;
                opacity: 0.8;
            }
            
            .upload-text {
                font-size: 1.2em;
                margin-bottom: 15px;
            }
            
            .upload-subtext {
                font-size: 0.9em;
                opacity: 0.8;
            }
            
            #fileInput {
                display: none;
            }
            
            .btn {
                background: linear-gradient(45deg, #667eea, #764ba2);
                color: white;
                border: none;
                padding: 15px 30px;
                border-radius: 25px;
                font-size: 1.1em;
                cursor: pointer;
                transition: all 0.3s ease;
                margin: 10px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            }
            
            .btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(0,0,0,0.3);
            }
            
            .progress-container {
                display: none;
                margin-top: 20px;
            }
            
            .progress-bar {
                width: 100%;
                height: 10px;
                background: rgba(255,255,255,0.2);
                border-radius: 5px;
                overflow: hidden;
                margin: 10px 0;
            }
            
            .progress-fill {
                height: 100%;
                background: linear-gradient(45deg, #4CAF50, #8BC34A);
                width: 0%;
                transition: width 0.3s ease;
            }
            
            .file-list {
                margin-top: 20px;
                text-align: left;
            }
            
            .file-item {
                padding: 8px 0;
                border-bottom: 1px solid rgba(255,255,255,0.1);
                font-size: 0.9em;
            }
            
            .success-message {
                display: none;
                background: rgba(76, 175, 80, 0.2);
                border: 1px solid rgba(76, 175, 80, 0.5);
                border-radius: 10px;
                padding: 20px;
                margin-bottom: 20px;
            }
            
            @media (max-width: 768px) {
                .upload-container {
                    padding: 20px;
                    margin: 20px;
                }
                
                h1 {
                    font-size: 2em;
                }
                
                .upload-area {
                    padding: 30px 15px;
                }
            }
        </style>
    </head>
    <body>
        <div class="upload-container">
            <h1>${escapedName}</h1>
            
            <div class="upload-area" onclick="document.getElementById('fileInput').click()">
                <div class="upload-icon">📱</div>
                <div class="upload-text">Tap to select images</div>
                <div class="upload-subtext">or drag and drop files here</div>
            </div>
            
            <input type="file" id="fileInput" multiple accept="image/*" capture="environment">
            <input type="file" id="addMoreInput" multiple accept="image/*" capture="environment" style="display: none;">
            
            <div class="preview-container">
                <h3>Selected Images</h3>
                <div class="preview-grid"></div>
                <div class="upload-controls">
                    <button class="btn" onclick="startUpload()">Upload Images</button>
                    <button class="btn btn-secondary" onclick="addMoreImages()">Add More</button>
                    <button class="btn btn-secondary" onclick="cancelSelection()">Cancel</button>
                </div>
            </div>
            
            <div class="progress-container">
                <div class="success-message">
                    <h3>✅ Upload Complete!</h3>
                    <p>All images have been uploaded successfully.</p>
                    <button class="btn" onclick="resetUpload()">Upload More Images</button>
                </div>
                <div>Uploading images...</div>
                <div class="progress-bar">
                    <div class="progress-fill"></div>
                </div>
                <div class="file-list"></div>
            </div>
        </div>

        <script>
            const fileInput = document.getElementById('fileInput');
            const addMoreInput = document.getElementById('addMoreInput');
            const uploadArea = document.querySelector('.upload-area');
            const previewContainer = document.querySelector('.preview-container');
            const previewGrid = document.querySelector('.preview-grid');
            const progressContainer = document.querySelector('.progress-container');
            const progressFill = document.querySelector('.progress-fill');
            const fileList = document.querySelector('.file-list');
            const successMessage = document.querySelector('.success-message');
            
            let selectedFiles = [];
            
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('dragover');
            });
            
            uploadArea.addEventListener('dragleave', () => {
                uploadArea.classList.remove('dragover');
            });
            
            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('dragover');
                handleFiles(e.dataTransfer.files);
            });
            
            fileInput.addEventListener('change', (e) => {
                handleFiles(e.target.files);
            });
            
            addMoreInput.addEventListener('change', (e) => {
                handleFiles(e.target.files, true);
                addMoreInput.value = '';
            });
            
            function handleFiles(files, append = false) {
                const newFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
                
                if (append) {
                    // Filter out duplicates based on name and size
                    const existingFileKeys = selectedFiles.map(f => `${f.name}-${f.size}`);
                    const uniqueNewFiles = newFiles.filter(f => !existingFileKeys.includes(`${f.name}-${f.size}`));
                    selectedFiles = [...selectedFiles, ...uniqueNewFiles];
                } else {
                    selectedFiles = newFiles;
                }
                
                if (selectedFiles.length > 0) {
                    showPreview();
                }
            }
            
            function showPreview() {
                uploadArea.style.display = 'none';
                previewContainer.style.display = 'block';
                previewGrid.innerHTML = '';
                
                selectedFiles.forEach((file, index) => {
                    const previewItem = document.createElement('div');
                    previewItem.className = 'preview-item';
                    
                    const img = document.createElement('img');
                    img.className = 'preview-image';
                    img.src = URL.createObjectURL(file);
                    
                    const removeBtn = document.createElement('button');
                    removeBtn.className = 'preview-remove';
                    removeBtn.innerHTML = '×';
                    removeBtn.onclick = () => removeFile(index);
                    
                    const filename = document.createElement('div');
                    filename.className = 'preview-filename';
                    filename.textContent = file.name;
                    
                    previewItem.appendChild(img);
                    previewItem.appendChild(removeBtn);
                    previewItem.appendChild(filename);
                    previewGrid.appendChild(previewItem);
                });
            }
            
            function removeFile(index) {
                selectedFiles.splice(index, 1);
                if (selectedFiles.length === 0) {
                    cancelSelection();
                } else {
                    showPreview();
                }
            }
            
            function addMoreImages() {
                addMoreInput.click();
            }
            
            function cancelSelection() {
                selectedFiles = [];
                fileInput.value = '';
                addMoreInput.value = '';
                uploadArea.style.display = 'block';
                previewContainer.style.display = 'none';
                previewGrid.innerHTML = '';
            }
            
            async function startUpload() {
                previewContainer.style.display = 'none';
                progressContainer.style.display = 'block';
                fileList.innerHTML = '';
                successMessage.style.display = 'none';
                progressFill.style.width = '0%';
                
                let completed = 0;
                const total = selectedFiles.length;
                
                for (let i = 0; i < selectedFiles.length; i++) {
                    const file = selectedFiles[i];
                    const fileItem = document.createElement('div');
                    fileItem.className = 'file-item';
                    fileItem.textContent = '📸 ' + file.name + ' - Uploading...';
                    fileList.appendChild(fileItem);
                    
                    try {
                        await uploadSingleFile(file);
                        fileItem.textContent = '✅ ' + file.name + ' - Complete';
                        completed++;
                        progressFill.style.width = ((completed / total) * 100) + '%';
                    } catch (error) {
                        fileItem.textContent = '❌ ' + file.name + ' - Failed';
                    }
                }
                
                if (completed === total) {
                    successMessage.style.display = 'block';
                }
            }
            
            function uploadSingleFile(file) {
                return new Promise((resolve, reject) => {
                    const formData = new FormData();
                    formData.append('images', file);
                    
                    const xhr = new XMLHttpRequest();
                    xhr.open('POST', '/upload/${dropPath}');
                    
                    xhr.onload = function() {
                        if (xhr.status === 200) {
                            resolve();
                        } else {
                            reject(new Error('Upload failed'));
                        }
                    };
                    
                    xhr.onerror = function() {
                        reject(new Error('Upload failed'));
                    };
                    
                    xhr.send(formData);
                });
            }
            
            function resetUpload() {
                selectedFiles = [];
                fileInput.value = '';
                addMoreInput.value = '';
                uploadArea.style.display = 'block';
                previewContainer.style.display = 'none';
                progressContainer.style.display = 'none';
                successMessage.style.display = 'none';
                progressFill.style.width = '0%';
                fileList.innerHTML = '';
                previewGrid.innerHTML = '';
            }
        </script>
    </body>
    </html>
  `);
});

app.post('/upload/:path', upload.array('images', 20), async (req, res) => {
  const dropPath = req.params.path;
  const imageDrop = config.imageDrops.find(drop => drop.path === dropPath);
  
  if (!imageDrop) {
    return res.status(404).json({ error: 'Invalid image drop path' });
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  try {
    const processedFiles = [];
    
    for (const file of req.files) {
      try {
        const image = sharp(file.path);
        const metadata = await image.metadata();
        
        await image
          .withMetadata()
          .toFile(file.path + '.processed');
        
        fs.unlinkSync(file.path);
        fs.renameSync(file.path + '.processed', file.path);
        
        processedFiles.push({
          filename: file.filename,
          originalname: file.originalname,
          size: file.size,
          metadata: {
            width: metadata.width,
            height: metadata.height,
            format: metadata.format,
            hasProfile: metadata.hasProfile,
            hasAlpha: metadata.hasAlpha
          }
        });
      } catch (error) {
        console.error(`Error processing ${file.filename}:`, error);
        processedFiles.push({
          filename: file.filename,
          originalname: file.originalname,
          size: file.size,
          error: 'Processing failed, file saved without metadata preservation'
        });
      }
    }

    res.json({ 
      message: 'Files uploaded successfully',
      fileCount: req.files.length,
      files: processedFiles
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload processing failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Image Drop App running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to get started`);
});