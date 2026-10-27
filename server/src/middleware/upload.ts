import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { env } from '../config/env';
import { AppError } from './errorHandler';

const root = path.isAbsolute(env.UPLOAD_DIR)
  ? env.UPLOAD_DIR
  : path.join(process.cwd(), env.UPLOAD_DIR);

export const UPLOAD_FOLDERS = ['products', 'categories', 'branding', 'avatars', 'giftcards', 'coupons', 'receipts'] as const;
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

for (const folder of UPLOAD_FOLDERS) {
  fs.mkdirSync(path.join(root, folder), { recursive: true });
}

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function folderFor(req: import('express').Request): UploadFolder {
  const candidate = String(req.params.folder ?? req.query.folder ?? 'products') as UploadFolder;
  return (UPLOAD_FOLDERS as readonly string[]).includes(candidate) ? candidate : 'products';
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const dir = path.join(root, folderFor(req));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});

/**
 * Image upload: extension + MIME whitelist (SVG deliberately excluded so an
 * uploaded file can never execute script), size cap from env, random filenames.
 */
export const uploadImage = multer({
  storage,
  limits: { fileSize: env.MAX_FILE_SIZE, files: 10 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.has(ext) || !ALLOWED_MIME.has(file.mimetype)) {
      return cb(new AppError('Only JPG, PNG, WEBP or GIF images are allowed.', 400));
    }
    return cb(null, true);
  },
});

export function publicUrl(req: import('express').Request, filename: string, folder: UploadFolder): string {
  return `${env.UPLOAD_PUBLIC_PREFIX}/${folder}/${filename}`;
}

export function absolutePathFor(relativeUrl: string): string | null {
  const prefix = env.UPLOAD_PUBLIC_PREFIX.replace(/\/$/, '');
  if (!relativeUrl.startsWith(`${prefix}/`)) return null;
  const rel = relativeUrl.slice(prefix.length + 1);
  const target = path.join(root, rel);
  // Prevent path traversal
  if (!target.startsWith(root)) return null;
  return target;
}

export function deleteUpload(relativeUrl: string): void {
  const target = absolutePathFor(relativeUrl);
  if (!target) return;
  fs.promises.unlink(target).catch(() => undefined);
}

export const UPLOAD_ROOT = root;
