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
import AWS from 'aws-sdk';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

// Configure AWS S3 for Hetzner Object Storage
const s3 = new AWS.S3({
  endpoint: process.env.S3_ENDPOINT,
  accessKeyId: process.env.S3_ACCESS_KEY,
  secretAccessKey: process.env.S3_SECRET_KEY,
  s3ForcePathStyle: true,
  signatureVersion: 'v4',
  region: 'us-east-1' // Required for Hetzner compatibility
});

const S3_BUCKET = process.env.S3_BUCKET || 'image-drop-bucket';

// Trust proxy for rate limiting (required for proper IP detection)
// Must be set before any rate limiting middleware
app.set('trust proxy', 1);

// Load configuration
const configPath = path.join(__dirname, '..', 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

app.use(cors());
app.use(express.json());
// S3 static file serving no longer needed - images served directly from S3

// Rate limiting for download endpoint - relaxed for S3 backend
const downloadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // limit each IP to 20 download requests per windowMs
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

// Helper function to create thumbnail and upload to S3
async function createThumbnailAndUpload(imageBuffer, s3Key, maxSize = 300) {
  try {
    const thumbnailBuffer = await sharp(imageBuffer)
      .resize(maxSize, maxSize, {
        fit: 'inside',
        withoutEnlargement: false
      })
      .jpeg({ quality: 85 })
      .toBuffer();
    
    const thumbnailKey = s3Key.replace(/\.[^/.]+$/, '') + '-thumb.jpg';
    
    await s3.upload({
      Bucket: S3_BUCKET,
      Key: thumbnailKey,
      Body: thumbnailBuffer,
      ContentType: 'image/jpeg'
    }).promise();
    
    return thumbnailKey;
  } catch (error) {
    console.error('Thumbnail creation failed:', error);
    return null;
  }
}

// Helper function to get S3 object URL
function getS3Url(key) {
  return s3.getSignedUrl('getObject', {
    Bucket: S3_BUCKET,
    Key: key,
    Expires: 3600 // 1 hour
  });
}

// Serve React static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'dist')));
}

// Configure multer for S3 uploads (memory storage)
const upload = multer({ 
  storage: multer.memoryStorage(),
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

// Upload rate limiting removed for S3 backend - only concurrent upload protection remains

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

app.get('/api/images/:path', async (req, res) => {
  const dropPath = req.params.path;
  const imageDrop = config.imageDrops.find(drop => drop.path === dropPath);
  
  if (!imageDrop) {
    return res.status(404).json({ error: 'Image drop not found' });
  }

  try {
    const params = {
      Bucket: S3_BUCKET,
      Prefix: `${dropPath}/`
    };

    const data = await s3.listObjectsV2(params).promise();
    
    if (!data.Contents) {
      return res.json({ images: [] });
    }

    const imageFiles = data.Contents
      .filter(obj => {
        const key = obj.Key;
        const ext = path.extname(key).toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext) && !key.includes('-thumb.');
      })
      .map(obj => {
        const filename = path.basename(obj.Key);
        const thumbKey = obj.Key.replace(/\.[^/.]+$/, '') + '-thumb.jpg';
        
        return {
          filename: filename,
          key: obj.Key,
          url: getS3Url(obj.Key),
          thumbnailUrl: getS3Url(thumbKey),
          size: obj.Size,
          uploadedAt: obj.LastModified
        };
      })
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    res.json({ images: imageFiles });
  } catch (error) {
    console.error('Error reading images from S3:', error);
    res.status(500).json({ error: 'Failed to load images' });
  }
});

app.post('/api/download/:path', downloadLimiter, express.json(), async (req, res) => {
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
  
  try {
    for (const filename of filenames) {
      const s3Key = `${dropPath}/${filename}`;
      
      try {
        const s3Object = await s3.getObject({
          Bucket: S3_BUCKET,
          Key: s3Key
        }).promise();
        
        // Skip files larger than 100MB to prevent memory issues
        if (s3Object.ContentLength > 100 * 1024 * 1024) {
          console.warn(`Skipping large file: ${filename} (${s3Object.ContentLength} bytes)`);
          continue;
        }
        
        archive.append(s3Object.Body, { name: filename });
        filesAdded++;
      } catch (err) {
        console.error(`Error getting file ${filename} from S3:`, err);
      }
    }

    if (filesAdded === 0) {
      cleanup();
      return res.status(404).json({ error: 'No valid files found for download' });
    }

    archive.finalize();
  } catch (error) {
    cleanup();
    console.error('Download error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to create download' });
    }
  }
});

app.post('/api/upload/:path', upload.array('images', 20), async (req, res) => {
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
    const processedFiles = [];
    
    for (const file of req.files) {
      try {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const filename = dropPath + '-' + uniqueSuffix + path.extname(file.originalname);
        const s3Key = `${dropPath}/${filename}`;
        
        // Upload original image to S3
        const uploadParams = {
          Bucket: S3_BUCKET,
          Key: s3Key,
          Body: file.buffer,
          ContentType: file.mimetype
        };
        
        await s3.upload(uploadParams).promise();
        
        // Create and upload thumbnail asynchronously (don't wait for it to complete upload response)
        createThumbnailAndUpload(file.buffer, s3Key).catch(err => {
          console.error(`Failed to create thumbnail for ${filename}:`, err);
        });
        
        processedFiles.push({
          filename: filename,
          originalname: file.originalname,
          size: file.size,
          s3Key: s3Key
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