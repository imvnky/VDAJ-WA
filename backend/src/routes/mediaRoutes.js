/**
 * VDAJ Services — Enterprise Media Upload & Management API
 * ────────────────────────────────────────────────────────
 * Handles secure file uploads (Images, Documents, Videos) for
 * WhatsApp message templates, campaigns, and direct messaging.
 *
 * Endpoints:
 *  POST /api/v1/media/upload   — Upload media file (multipart/form-data)
 *  GET  /api/v1/media/:file    — Stream uploaded media file
 */

'use strict';

const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');
const multer  = require('multer');

const { authenticate } = require('../middleware/authMiddleware');
const { sendSuccess, catchAsync } = require('../middleware/responseHandler');
const AppError = require('../utils/AppError');

// Ensure upload directory exists
const UPLOADS_DIR = path.resolve(__dirname, '../../public/uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// ── Allowed MIME Types for WhatsApp Meta Cloud API ─────────────
const ALLOWED_MIME_TYPES = {
  // Images (Max 5MB for Meta, but we accept up to 16MB and compress if needed)
  'image/jpeg':        '.jpg',
  'image/png':         '.png',
  'image/webp':        '.webp',
  // Videos (Max 16MB)
  'video/mp4':         '.mp4',
  'video/3gpp':        '.3gp',
  // Documents (Max 100MB, capped at 16MB on gateway)
  'application/pdf':   '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
};

// ── Multer Storage Configuration ───────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = ALLOWED_MIME_TYPES[file.mimetype] || path.extname(file.originalname).toLowerCase() || '.bin';
    const rand = crypto.randomBytes(8).toString('hex');
    const safeName = `vdaj-media-${Date.now()}-${rand}${ext}`;
    cb(null, safeName);
  },
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES[file.mimetype]) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        `Unsupported media type: ${file.mimetype}. Supported formats: JPEG, PNG, WEBP, MP4, PDF, DOCX, XLSX.`,
        400,
        'ERR_VDAJ_MEDIA_001'
      ),
      false
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 16 * 1024 * 1024, // 16 MB max
  },
});

// ── POST /media/upload — Upload media file ──────────────────────
router.post('/upload', authenticate, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError('File size exceeds the 16 MB limit.', 400, 'ERR_VDAJ_MEDIA_002'));
      }
      return next(new AppError(`Upload error: ${err.message}`, 400, 'ERR_VDAJ_MEDIA_003'));
    } else if (err) {
      return next(err);
    }

    if (!req.file) {
      return next(new AppError('No file was uploaded. Please attach a file using the "file" field.', 400, 'ERR_VDAJ_MEDIA_004'));
    }

    // Determine public URL
    const host = req.get('host') || 'wa.vdajservices.com';
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const baseUrl = process.env.PUBLIC_URL || process.env.APP_URL || `${protocol}://${host}`;
    const publicUrl = `${baseUrl}/uploads/${req.file.filename}`;

    const mediaType = req.file.mimetype.startsWith('image/')
      ? 'IMAGE'
      : req.file.mimetype.startsWith('video/')
      ? 'VIDEO'
      : 'DOCUMENT';

    return sendSuccess(
      res,
      {
        url:          publicUrl,
        directUrl:    `${baseUrl}/api/v1/media/${req.file.filename}`,
        filename:     req.file.filename,
        originalName: req.file.originalname,
        mimetype:     req.file.mimetype,
        mediaType,
        size:         req.file.size,
      },
      'Media uploaded successfully.'
    );
  });
});

// ── GET /media/:filename — Serve/stream media file ─────────────
router.get('/:filename', (req, res, next) => {
  const safeFilename = path.basename(req.params.filename);
  const filePath = path.join(UPLOADS_DIR, safeFilename);

  if (!fs.existsSync(filePath)) {
    return next(new AppError('Media asset not found.', 404, 'ERR_VDAJ_MEDIA_404'));
  }

  // Set appropriate cache headers for Meta WhatsApp crawlers
  res.setHeader('Cache-Control', 'public, max-age=86400');
  return res.sendFile(filePath);
});

module.exports = router;
