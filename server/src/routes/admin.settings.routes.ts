import { Router } from 'express';
import { db } from '../config/db';
import { settings as settingsTable } from '../schemas/index';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authenticateAdmin, requirePermission } from '../middleware/adminAuth';
import { SETTING_DEFINITIONS, SETTING_MAP } from '../config/settings.registry';
import { getSettings, updateSettings } from '../services/settings.service';
import { logStaffAction } from '../services/audit.service';
import { deleteUpload, publicUrl, uploadImage } from '../middleware/upload';

const router = Router();
router.use(authenticateAdmin);

/** Grouped settings + field metadata so the UI never hardcodes labels. */
router.get(
  '/',
  requirePermission('settings:read'),
  asyncHandler(async (_req, res) => {
    const values = await getSettings();
    const groups = SETTING_DEFINITIONS.reduce<Record<string, unknown[]>>((acc, def) => {
      const entry = {
        key: def.key,
        label: def.label,
        labelBn: def.labelBn ?? null,
        type: def.type,
        group: def.group,
        value: values[def.key] ?? def.default,
        min: def.min ?? null,
        max: def.max ?? null,
        public: Boolean(def.public),
      };
      (acc[def.group] ||= []).push(entry);
      return acc;
    }, {});
    return res.json({ success: true, settings: values, data: values, groups, definitions: SETTING_DEFINITIONS });
  })
);

/**
 * Persists settings and returns the committed state read back from the
 * database, so the admin UI can refresh from truth (fixes the "saved but lost
 * after refresh" bug caused by never inserting missing keys).
 */
const saveSettings = asyncHandler(async (req, res) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      throw new AppError('Invalid settings payload.', 400);
    }
    // Ignore metadata keys the UI may echo back.
    const payload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(req.body)) {
      if (SETTING_MAP[key]) payload[key] = value;
    }
    if (!Object.keys(payload).length) throw new AppError('No valid settings were provided.', 400);

    await updateSettings(payload);
    const saved = await getSettings();
    const changed = Object.keys(payload);
    await logStaffAction({ adminId: req.adminId, action: 'settings.update', module: 'settings', details: { keys: changed }, ip: req.ip });

    return res.json({ success: true, message: 'সেটিংস সংরক্ষণ করা হয়েছে।', settings: saved, data: saved, savedKeys: changed });
});

// PUT is canonical; POST is kept for legacy clients.
router.put('/', requirePermission('settings:write'), saveSettings);
router.post('/', requirePermission('settings:write'), saveSettings);

/** Logo / branding upload. Previous file is only removed after a successful save. */
router.post(
  '/logo',
  requirePermission('settings:write'),
  uploadImage.single('logo'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new AppError('No file uploaded.', 400);
    const url = publicUrl(req, req.file.filename, 'branding');
    const [existing] = await db.select().from(settingsTable).limit(1); // ensure table reachable
    void existing;
    await updateSettings({ logo_url: url });
    await logStaffAction({ adminId: req.adminId, action: 'settings.logo', module: 'settings', details: { url }, ip: req.ip });
    const saved = await getSettings();
    return res.json({ success: true, message: 'লোগো আপডেট করা হয়েছে।', logoUrl: url, settings: saved });
  })
);

/** Revert to the packaged brand logo and delete the uploaded replacement. */
router.delete(
  '/logo',
  requirePermission('settings:write'),
  asyncHandler(async (req, res) => {
    const current = await getSettings();
    await updateSettings({ logo_url: '/brand/logo-with-name.png' });
    if (current.logo_url?.startsWith('/uploads/')) deleteUpload(current.logo_url);
    return res.json({ success: true, message: 'ডিফল্ট লোগোতে ফিরে যাওয়া হয়েছে।' });
  })
);

export default router;
