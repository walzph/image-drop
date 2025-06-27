# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Start Development Environment:**
```bash
npm run dev          # Starts both frontend (port 3000) and backend (port 3001) concurrently
npm run server       # Backend API only (port 3001)
npm run client       # Frontend only (port 3000)
```

**Build and Deploy:**
```bash
npm run build        # Production build of React frontend
npm run preview      # Preview production build locally
```

## Architecture Overview

This is a React-based image drop application with a clear separation between frontend and backend:

### Backend API (Node.js/Express)
- **Location:** `backend/server.js`
- **Port:** 3001
- **Purpose:** File upload handling, image processing with Sharp.js, EXIF metadata preservation
- **Key APIs:**
  - `GET /api/config` - Returns all image drop configurations
  - `GET /api/drops/:path` - Returns specific image drop config
  - `POST /api/upload/:path` - Handles file uploads with metadata preservation

### Frontend (React + Vite)
- **Port:** 3000 (proxies `/api` calls to backend)
- **Router:** React Router for `/:dropPath` dynamic routing
- **State Flow:** `select` → `preview` → `uploading` → `complete`

### Image Drop Configuration
All image drops are configured in `config.json` with this structure:
```json
{
  "name": "Display Name",
  "path": "url-path",
  "subdirectory": "uploads/folder",
  "backgroundImage": "/assets/image.jpg"
}
```

### Component Architecture
- **ImageDropPage**: Main controller component managing upload state machine
- **FileUploadArea**: Drag & drop file selection with mobile optimization
- **ImagePreview**: Thumbnail grid with individual file removal and "Add More" functionality
- **UploadProgress**: Real-time progress tracking with status indicators

### File Upload Features
- **Filename Prefixing**: Files are saved as `{drop-path}-{timestamp}-{random}.ext`
- **EXIF Preservation**: Sharp.js processes images while retaining metadata
- **Mobile Optimization**: `capture="environment"` for camera access
- **Duplicate Prevention**: Files checked by name and size when adding more

### State Management
The upload flow uses a state machine in ImageDropPage:
1. `select` - Initial file selection screen
2. `preview` - Review selected files, add/remove capability
3. `uploading` - Progress tracking during upload
4. `complete` - Success message with option to upload more

Key state variables:
- `selectedFiles` - Array of File objects
- `uploadState` - Current stage of upload process
- `uploadProgress` - Per-file upload status tracking