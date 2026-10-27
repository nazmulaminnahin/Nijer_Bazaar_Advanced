import { create } from 'zustand';
import { api } from '@/lib/api';

export interface PublicSettings {
  site_name: string;
  site_name_bn: string;
  site_tagline: string;
  logo_url: string;
  logo_alt_url: string;
  favicon_url: string;
  brand_color: string;
  header_phone: string;
  header_address: string;
  header_promo_text: string;
  header_topbar_enabled: string;
  footer_slogan: string;
  footer_about: string;
  contact_email: string;
  contact_phone: string;
  contact_address: string;
  support_hours: string;
  facebook_url: string;
  instagram_url: string;
  youtube_url: string;
  whatsapp_number: string;
  footer_attribution: string;
  free_shipping_enabled: string;
  free_shipping_threshold: string;
  free_shipping_scope: string;
  inside_dhaka_charge: string;
  outside_dhaka_charge: string;
  cod_enabled: string;
  bkash_number: string;
  nagad_number: string;
  currency_symbol: string;
  [key: string]: string;
}

export const DEFAULT_PUBLIC_SETTINGS: PublicSettings = {
  site_name: 'Nijer Bazaar',
  site_name_bn: 'নিজের বাজার',
  site_tagline: 'সমস্যার সমাধান, ব্যক্তির নিশ্চয়তা',
  logo_url: '/brand/logo-with-name.png',
  logo_alt_url: '/brand/logo.png',
  favicon_url: '/brand/logo.png',
  brand_color: '#f97316',
  header_phone: '01700-000000',
  header_address: 'ঢাকা, বাংলাদেশ',
  header_promo_text: 'ঢাকার ভিতরে ৳999+ অর্ডারে ফ্রি ডেলিভারি',
  header_topbar_enabled: 'true',
  footer_slogan: 'নিজের বাজার — আপনার প্রতিদিনের প্রয়োজনীয় পণ্যের বিশ্বস্ত ঠিকানা।',
  footer_about: '',
  contact_email: 'support@nijerbazaar.com',
  contact_phone: '01700-000000',
  contact_address: 'মিরপুর ১০, ঢাকা',
  support_hours: 'শনি–বৃহস্পতি, সকাল ১০টা – রাত ৮টা',
  facebook_url: '',
  instagram_url: '',
  youtube_url: '',
  whatsapp_number: '',
  footer_attribution: 'Made by Engr. Nazmul Amin',
  free_shipping_enabled: 'true',
  free_shipping_threshold: '999',
  free_shipping_scope: 'inside_dhaka',
  inside_dhaka_charge: '60',
  outside_dhaka_charge: '120',
  cod_enabled: 'true',
  bkash_number: '',
  nagad_number: '',
  currency_symbol: '৳',
};

interface SettingsState {
  settings: PublicSettings;
  loaded: boolean;
  load: () => Promise<void>;
}

/** Public branding/contact policy, loaded once and shared by header + footer. */
export const useSettings = create<SettingsState>((set) => ({
  settings: DEFAULT_PUBLIC_SETTINGS,
  loaded: false,
  async load() {
    try {
      const res = await api.get('/settings');
      set({ settings: { ...DEFAULT_PUBLIC_SETTINGS, ...res.data.settings }, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
}));
