import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import archiver from 'archiver';
import rateLimit from 'express-rate-limit';

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

// Rate limiting for download endpoint
const downloadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // limit each IP to 3 download requests per windowMs
  message: { error: 'Too many download requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Track active downloads to prevent concurrent downloads from same IP
const activeDownloads = new Map();

// Clean up old download tracking entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  const maxAge = 5 * 60 * 1000; // 5 minutes
  
  for (const [key, timestamp] of activeDownloads.entries()) {
    if (now - timestamp > maxAge) {
      activeDownloads.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Serve React static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'dist')));
}

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

app.get('/api/images/:path', (req, res) => {
  const dropPath = req.params.path;
  const imageDrop = config.imageDrops.find(drop => drop.path === dropPath);
  
  if (!imageDrop) {
    return res.status(404).json({ error: 'Image drop not found' });
  }

  const uploadDir = path.join(__dirname, '..', imageDrop.subdirectory);
  
  if (!fs.existsSync(uploadDir)) {
    return res.json({ images: [] });
  }

  try {
    const files = fs.readdirSync(uploadDir);
    const imageFiles = files
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
      })
      .map(file => {
        const filePath = path.join(uploadDir, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          url: `/uploads/${path.basename(imageDrop.subdirectory)}/${file}`,
          size: stats.size,
          uploadedAt: stats.mtime
        };
      })
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    res.json({ images: imageFiles });
  } catch (error) {
    console.error('Error reading images:', error);
    res.status(500).json({ error: 'Failed to load images' });
  }
});

app.post('/api/download/:path', downloadLimiter, express.json(), (req, res) => {
  const dropPath = req.params.path;
  const { filenames } = req.body;
  const clientIP = req.ip || req.connection.remoteAddress;
  const downloadKey = `${clientIP}-${dropPath}`;
  
  // Check if there's already an active download for this IP/path combo
  if (activeDownloads.has(downloadKey)) {
    return res.status(429).json({ error: 'A download is already in progress. Please wait for it to complete.' });
  }
  
  const imageDrop = config.imageDrops.find(drop => drop.path === dropPath);
  
  if (!imageDrop) {
    return res.status(404).json({ error: 'Image drop not found' });
  }

  if (!filenames || !Array.isArray(filenames) || filenames.length === 0) {
    return res.status(400).json({ error: 'No files specified for download' });
  }

  // Limit the number of files that can be downloaded at once
  if (filenames.length > 50) {
    return res.status(400).json({ error: 'Too many files selected. Maximum 50 files per download.' });
  }

  const uploadDir = path.join(__dirname, '..', imageDrop.subdirectory);
  
  // Mark this download as active
  activeDownloads.set(downloadKey, Date.now());
  
  // Clean up tracking when request ends
  const cleanup = () => {
    activeDownloads.delete(downloadKey);
  };
  
  res.on('close', cleanup);
  res.on('error', cleanup);
  res.on('finish', cleanup);
  
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${dropPath}-images.zip"`);

  const archive = archiver('zip', {
    zlib: { level: 6 } // Reduced compression level for better performance
  });

  archive.on('error', function(err) {
    console.error('Archive error:', err);
    cleanup();
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to create archive' });
    }
  });

  archive.pipe(res);

  let filesAdded = 0;
  filenames.forEach(filename => {
    const filePath = path.join(uploadDir, filename);
    if (fs.existsSync(filePath)) {
      try {
        const stats = fs.statSync(filePath);
        // Skip files larger than 100MB to prevent memory issues
        if (stats.size > 100 * 1024 * 1024) {
          console.warn(`Skipping large file: ${filename} (${stats.size} bytes)`);
          return;
        }
        archive.file(filePath, { name: filename });
        filesAdded++;
      } catch (err) {
        console.error(`Error adding file ${filename}:`, err);
      }
    }
  });

  if (filesAdded === 0) {
    cleanup();
    return res.status(404).json({ error: 'No valid files found for download' });
  }

  archive.finalize();
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
    const uploadedFiles = req.files.map(file => ({
      filename: file.filename,
      originalname: file.originalname,
      size: file.size
    }));

    res.json({ 
      message: 'Files uploaded successfully',
      fileCount: req.files.length,
      files: uploadedFiles
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload processing failed' });
  }
});

// Catch-all handler for React Router in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Image Drop API running on port ${PORT}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
});