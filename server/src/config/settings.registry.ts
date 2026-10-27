/**
 * Central registry of every admin-editable setting.
 * Defaults live here so the app works on a fresh database, and the admin UI can
 * render grouped fields with validation metadata without hardcoding them.
 */
export type SettingType = 'string' | 'number' | 'boolean' | 'json' | 'text' | 'url' | 'color';

export interface SettingDefinition {
  key: string;
  group: 'general' | 'branding' | 'header' | 'footer' | 'shipping' | 'payment' | 'notifications' | 'integration';
  label: string;
  labelBn?: string;
  type: SettingType;
  default: string;
  public?: boolean; // exposed on the storefront settings endpoint
  secret?: boolean; // never returned in full by the API
  min?: number;
  max?: number;
}

export const SETTING_DEFINITIONS: SettingDefinition[] = [
  // General / branding
  { key: 'site_name', group: 'branding', label: 'Site name', labelBn: 'সাইটের নাম', type: 'string', default: 'Nijer Bazaar', public: true },
  { key: 'site_name_bn', group: 'branding', label: 'Site name (Bangla)', type: 'string', default: 'নিজের বাজার', public: true },
  { key: 'site_tagline', group: 'branding', label: 'Tagline', labelBn: 'স্লোগান', type: 'string', default: 'সমস্যার সমাধান, ব্যক্তির নিশ্চয়তা', public: true },
  { key: 'logo_url', group: 'branding', label: 'Logo URL or upload', labelBn: 'লোগো', type: 'string', default: '/brand/logo-with-name.png', public: true },
  { key: 'logo_alt_url', group: 'branding', label: 'Compact logo (icon only)', type: 'string', default: '/brand/logo.png', public: true },
  { key: 'favicon_url', group: 'branding', label: 'Favicon', type: 'string', default: '/brand/logo.png', public: true },
  { key: 'brand_color', group: 'branding', label: 'Brand colour', type: 'color', default: '#f97316', public: true },

  // Header
  { key: 'header_phone', group: 'header', label: 'Contact phone', labelBn: 'ফোন নম্বর', type: 'string', default: '01700-000000', public: true },
  { key: 'header_address', group: 'header', label: 'Location / address', type: 'string', default: 'ঢাকা, বাংলাদেশ', public: true },
  { key: 'header_promo_text', group: 'header', label: 'Top bar promotional text', type: 'string', default: 'ঢাকার ভিতরে ৳999+ অর্ডারে ফ্রি ডেলিভারি', public: true },
  { key: 'header_topbar_enabled', group: 'header', label: 'Show top bar', type: 'boolean', default: 'true', public: true },

  // Footer
  { key: 'footer_slogan', group: 'footer', label: 'Footer slogan', type: 'string', default: 'নিজের বাজার — আপনার প্রতিদিনের প্রয়োজনীয় পণ্যের বিশ্বস্ত ঠিকানা।', public: true },
  { key: 'footer_about', group: 'footer', label: 'Footer about text', type: 'text', default: 'আমরা সঠিক পণ্য, সঠিক দামে, সঠিক সময়ে পৌঁছে দিতে প্রতিশ্রুতিবদ্ধ।', public: true },
  { key: 'contact_email', group: 'footer', label: 'Contact email', type: 'string', default: 'support@nijerbazaar.com', public: true },
  { key: 'contact_phone', group: 'footer', label: 'Customer service phone', type: 'string', default: '01700-000000', public: true },
  { key: 'contact_address', group: 'footer', label: 'Shop address', type: 'text', default: 'মিরপুর ১০, ঢাকা ১২১৬, বাংলাদেশ', public: true },
  { key: 'support_hours', group: 'footer', label: 'Service hours', type: 'string', default: 'শনি–বৃহস্পতি, সকাল ১০টা – রাত ৮টা', public: true },
  { key: 'facebook_url', group: 'footer', label: 'Facebook URL', type: 'url', default: 'https://facebook.com/', public: true },
  { key: 'instagram_url', group: 'footer', label: 'Instagram URL', type: 'url', default: '', public: true },
  { key: 'youtube_url', group: 'footer', label: 'YouTube URL', type: 'url', default: '', public: true },
  { key: 'whatsapp_number', group: 'footer', label: 'WhatsApp number', type: 'string', default: '01700000000', public: true },
  { key: 'footer_attribution', group: 'footer', label: 'Footer attribution', type: 'string', default: 'Made by Engr. Nazmul Amin', public: true },

  // Shipping
  { key: 'free_shipping_enabled', group: 'shipping', label: 'Enable free shipping', labelBn: 'ফ্রি ডেলিভারি চালু', type: 'boolean', default: 'true', public: true },
  { key: 'free_shipping_threshold', group: 'shipping', label: 'Free shipping threshold (৳)', labelBn: 'ফ্রি ডেলিভারির সর্বনিম্ন অর্ডার', type: 'number', default: '999', min: 0, public: true },
  { key: 'free_shipping_scope', group: 'shipping', label: 'Free shipping area', type: 'string', default: 'inside_dhaka', public: true },
  { key: 'inside_dhaka_charge', group: 'shipping', label: 'Inside Dhaka charge (৳)', type: 'number', default: '60', min: 0, public: true },
  { key: 'outside_dhaka_charge', group: 'shipping', label: 'Outside Dhaka charge (৳)', type: 'number', default: '120', min: 0, public: true },

  // Payment
  { key: 'cod_enabled', group: 'payment', label: 'Cash on delivery enabled', type: 'boolean', default: 'true', public: true },
  { key: 'bkash_number', group: 'payment', label: 'bKash number', type: 'string', default: '01700000000', public: true },
  { key: 'nagad_number', group: 'payment', label: 'Nagad number', type: 'string', default: '01700000000', public: true },

  // Notifications (non-secret config; secrets stay in env)
  { key: 'notify_email_enabled', group: 'notifications', label: 'Email notifications', type: 'boolean', default: 'false' },
  { key: 'notify_sms_enabled', group: 'notifications', label: 'SMS notifications', type: 'boolean', default: 'false' },
  { key: 'notify_whatsapp_enabled', group: 'notifications', label: 'WhatsApp notifications', type: 'boolean', default: 'false' },
  { key: 'notify_push_enabled', group: 'notifications', label: 'Web push notifications', type: 'boolean', default: 'false' },
  { key: 'notify_sender_name', group: 'notifications', label: 'Sender name', type: 'string', default: 'Nijer Bazaar' },
  { key: 'notify_reply_to', group: 'notifications', label: 'Reply-to email', type: 'string', default: '' },

  // Integration
  { key: 'invoice_footer_note', group: 'integration', label: 'Invoice footer note', type: 'text', default: 'ধন্যবাদ! নিজের বাজারের সাথে থাকার জন্য কৃতজ্ঞ।' },
  { key: 'currency_symbol', group: 'general', label: 'Currency symbol', type: 'string', default: '৳', public: true },
];

export const SETTING_MAP: Record<string, SettingDefinition> = Object.fromEntries(
  SETTING_DEFINITIONS.map((d) => [d.key, d])
);

export const DEFAULT_SETTINGS: Record<string, string> = Object.fromEntries(
  SETTING_DEFINITIONS.map((d) => [d.key, d.default])
);
