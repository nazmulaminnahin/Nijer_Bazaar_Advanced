import { Router } from 'express';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authenticateAdmin } from '../middleware/adminAuth';
import { UPLOAD_FOLDERS, publicUrl, uploadImage } from '../middleware/upload';

const router = Router();

/**
 * POST /api/uploads/:folder
 * field name: "file" (multiple allowed). Returns absolute-free relative URLs
 * that the API serves from /uploads.
 */
router.post(
  '/:folder',
  authenticateAdmin,
  uploadImage.array('file', 8),
  asyncHandler(async (req, res) => {
    const folder = String(req.params.folder);
    if (!(UPLOAD_FOLDERS as readonly string[]).includes(folder)) throw new AppError('Invalid upload folder.', 400);
    const files = (req.files as Express.Multer.File[]) ?? [];
    if (!files.length) throw new AppError('No file uploaded.', 400);
    const urls = files.map((f) => publicUrl(req, f.filename, folder as never));
    return res.status(201).json({ success: true, urls, url: urls[0], data: urls });
  })
);

export default router;
