import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

// Load configuration
const configPath = path.join(__dirname, '..', 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dropPath = req.params.path;
    const imageDrop = config.imageDrops.find(drop => drop.path === dropPath);
    
    if (!imageDrop) {
      return cb(new Error('Invalid image drop path'));
    }

    const uploadDir = path.join(__dirname, '..', imageDrop.subdirectory);
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

// API Routes
app.get('/api/config', (req, res) => {
  res.json(config);
});

app.get('/api/drops/:path', (req, res) => {
  const dropPath = req.params.path;
  const imageDrop = config.imageDrops.find(drop => drop.path === dropPath);
  
  if (!imageDrop) {
    return res.status(404).json({ error: 'Image drop not found' });
  }

  res.json(imageDrop);
});

app.post('/api/upload/:path', upload.array('images', 20), async (req, res) => {
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
        
        // Process image while preserving metadata
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
  console.log(`Image Drop API running on port ${PORT}`);
});