import { eq, inArray } from 'drizzle-orm';
import { db } from '../config/db';
import type { DbClient } from '../config/db';
import { settings } from '../schemas/index';
import { AppError } from '../middleware/errorHandler';
import { DEFAULT_SETTINGS, SETTING_DEFINITIONS, SETTING_MAP } from '../config/settings.registry';
import type { ShippingConfig, ZoneConfig } from './pricing';
import { DEFAULT_SHIPPING_CONFIG } from './pricing';

export type SettingsMap = Record<string, string>;

/** Reads all settings, filling in registry defaults for missing keys. */
export async function getSettings(dbc: DbClient = db): Promise<SettingsMap> {
  const rows = await dbc.select().from(settings);
  const map: SettingsMap = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    if (row.value !== null && row.value !== undefined) map[row.key] = row.value;
  }
  return map;
}

export async function getPublicSettings(dbc: DbClient = db): Promise<SettingsMap> {
  const all = await getSettings(dbc);
  const publicKeys = SETTING_DEFINITIONS.filter((d) => d.public).map((d) => d.key);
  const out: SettingsMap = {};
  for (const key of publicKeys) out[key] = all[key];
  return out;
}

export function toBoolean(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
}

export function toNumber(value: string | undefined, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Validates and persists settings atomically. Returns the saved values. */
export async function updateSettings(
  updates: Record<string, unknown>,
  dbc: DbClient = db
): Promise<SettingsMap> {
  const entries = Object.entries(updates ?? {});
  if (!entries.length) throw new AppError('No settings were provided.', 400);

  const prepared = entries.map(([key, raw]) => {
    const def = SETTING_MAP[key];
    if (!def) throw new AppError(`Unknown setting "${key}".`, 400);
    return { key, def, value: normalizeValue(key, def.type, raw, def) };
  });

  return dbc.transaction(async (tx) => {
    for (const { key, def, value } of prepared) {
      const existing = await tx.select({ id: settings.id }).from(settings).where(eq(settings.key, key)).limit(1);
      if (existing.length) {
        await tx.update(settings).set({ value, type: def.type, group: def.group, updatedAt: new Date() }).where(eq(settings.key, key));
      } else {
        await tx.insert(settings).values({ key, value, type: def.type, group: def.group });
      }
    }
    // Return the committed state so the client can re-render from the database.
    const rows = await tx.select().from(settings).where(inArray(settings.key, prepared.map((p) => p.key)));
    const map: SettingsMap = { ...DEFAULT_SETTINGS };
    for (const row of rows) if (row.value != null) map[row.key] = row.value;
    return map;
  });
}

function normalizeValue(key: string, type: string, raw: unknown, def = SETTING_MAP[key]): string {
  if (raw === null || raw === undefined) return '';
  if (type === 'boolean') return String(raw === true || ['true', '1', 'yes', 'on'].includes(String(raw).toLowerCase()));
  if (type === 'number') {
    const n = Number(raw);
    if (!Number.isFinite(n)) throw new AppError(`${def?.label ?? key} must be a number.`, 400);
    if (def?.min != null && n < def.min) throw new AppError(`${def.label} must be at least ${def.min}.`, 400);
    if (def?.max != null && n > def.max) throw new AppError(`${def.label} must be at most ${def.max}.`, 400);
    return String(n);
  }
  if (type === 'url') {
    const value = String(raw).trim();
    if (value && !/^(https?:\/\/|\/)/i.test(value)) {
      throw new AppError(`${def?.label ?? key} must start with http://, https:// or /.`, 400);
    }
    return value;
  }
  if (type === 'color') {
    const value = String(raw).trim();
    if (value && !/^#[0-9a-f]{3,8}$/i.test(value)) throw new AppError('Colour must be a hex value.', 400);
    return value;
  }
  return String(raw);
}

/** Builds the shipping configuration used by pricing.quoteShipping(). */
export async function loadShippingConfig(dbc: DbClient = db): Promise<ShippingConfig> {
  const map = await getSettings(dbc);
  // Zones come from the DB when available; settings act as the master switches.
  let zones: ZoneConfig[] = DEFAULT_SHIPPING_CONFIG.zones;
  try {
    const { shippingZones } = await import('../schemas/index');
    const rows = await dbc.select().from(shippingZones).where(eq(shippingZones.isActive, true));
    if (rows.length) {
      zones = rows.map((z) => ({
        code: z.code,
        name: z.name,
        charge: Number(z.charge),
        freeShippingEligible: z.freeShippingEligible,
        freeShippingThreshold: z.freeShippingThreshold == null ? null : Number(z.freeShippingThreshold),
        districts: z.districts ?? [],
      }));
      // Keep charges in sync with the admin settings for the two core zones.
      zones = zones.map((z) => {
        if (z.code === 'inside_dhaka') return { ...z, charge: toNumber(map.inside_dhaka_charge, z.charge) };
        if (z.code === 'outside_dhaka') return { ...z, charge: toNumber(map.outside_dhaka_charge, z.charge) };
        return z;
      });
    }
  } catch {
    /* fall back to defaults if the zones table is unavailable */
  }

  return {
    freeShippingEnabled: toBoolean(map.free_shipping_enabled, true),
    freeShippingThreshold: toNumber(map.free_shipping_threshold, 999),
    freeShippingScope: map.free_shipping_scope === 'all' ? 'all' : 'inside_dhaka',
    defaultCharge: toNumber(map.outside_dhaka_charge, 120),
    zones,
  };
}
