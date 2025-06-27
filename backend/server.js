import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import archiver from 'archiver';
import rateLimit from 'express-rate-limit';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

// Trust proxy for rate limiting (required for proper IP detection)
// Must be set before any rate limiting middleware
app.set('trust proxy', 1);

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

// Track active uploads to prevent resource exhaustion
const activeUploads = new Map();

// Helper function to create thumbnail
async function createThumbnail(inputPath, outputPath, maxSize = 300) {
  try {
    await sharp(inputPath)
      .resize(maxSize, maxSize, {
        fit: 'inside',
        withoutEnlargement: false
      })
      .jpeg({ quality: 85 })
      .toFile(outputPath);
    return true;
  } catch (error) {
    console.error('Thumbnail creation failed:', error);
    return false;
  }
}

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
    
    // Create thumbnails directory
    const thumbDir = path.join(uploadDir, 'thumbnails');
    if (!fs.existsSync(thumbDir)) {
      fs.mkdirSync(thumbDir, { recursive: true });
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
    fileSize: 50 * 1024 * 1024 // 50MB limit - increased for high res images
  }
});

// Rate limiting for uploads
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 upload requests per windowMs
  message: { error: 'Too many upload requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
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
  const thumbDir = path.join(uploadDir, 'thumbnails');
  
  if (!fs.existsSync(uploadDir)) {
    return res.json({ images: [] });
  }

  try {
    const files = fs.readdirSync(uploadDir);
    const imageFiles = files
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext) && file !== 'thumbnails';
      })
      .map(file => {
        const filePath = path.join(uploadDir, file);
        const stats = fs.statSync(filePath);
        const thumbPath = path.join(thumbDir, file.replace(path.extname(file), '.jpg'));
        const hasThumbnail = fs.existsSync(thumbPath);
        
        return {
          filename: file,
          url: `/uploads/${path.basename(imageDrop.subdirectory)}/${file}`,
          thumbnailUrl: hasThumbnail ? `/uploads/${path.basename(imageDrop.subdirectory)}/thumbnails/${file.replace(path.extname(file), '.jpg')}` : null,
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

app.post('/api/upload/:path', uploadLimiter, upload.array('images', 20), async (req, res) => {
  const dropPath = req.params.path;
  const clientIP = req.ip || req.connection.remoteAddress;
  const uploadKey = `${clientIP}-${dropPath}`;
  
  // Check concurrent uploads
  const currentUploads = activeUploads.get(uploadKey) || 0;
  if (currentUploads >= 3) {
    return res.status(429).json({ error: 'Too many concurrent uploads. Please wait.' });
  }
  
  const imageDrop = config.imageDrops.find(drop => drop.path === dropPath);
  
  if (!imageDrop) {
    return res.status(404).json({ error: 'Invalid image drop path' });
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  // Track this upload
  activeUploads.set(uploadKey, currentUploads + 1);
  
  const cleanup = () => {
    const current = activeUploads.get(uploadKey) || 1;
    if (current <= 1) {
      activeUploads.delete(uploadKey);
    } else {
      activeUploads.set(uploadKey, current - 1);
    }
  };

  try {
    const uploadDir = path.join(__dirname, '..', imageDrop.subdirectory);
    const thumbDir = path.join(uploadDir, 'thumbnails');
    
    // Process files and create thumbnails
    const processedFiles = [];
    
    for (const file of req.files) {
      try {
        const filePath = file.path;
        const thumbPath = path.join(thumbDir, file.filename.replace(path.extname(file.filename), '.jpg'));
        
        // Create thumbnail asynchronously (don't wait for it to complete upload response)
        createThumbnail(filePath, thumbPath).catch(err => {
          console.error(`Failed to create thumbnail for ${file.filename}:`, err);
        });
        
        processedFiles.push({
          filename: file.filename,
          originalname: file.originalname,
          size: file.size
        });
      } catch (error) {
        console.error(`Error processing file ${file.originalname}:`, error);
      }
    }

    cleanup();
    
    res.json({ 
      message: 'Files uploaded successfully',
      fileCount: processedFiles.length,
      files: processedFiles
    });
  } catch (error) {
    cleanup();
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