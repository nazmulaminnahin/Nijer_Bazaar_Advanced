import { Link } from 'react-router-dom';
import { ShieldCheck, Truck, HeartHandshake, Target, Store, HeadphonesIcon } from 'lucide-react';
import { useSettings } from '@/store/settings';
import { taka } from '@/lib/format';
import { LinkButton, SmartImage, Card } from '@/components/ui';
import { mediaUrl } from '@/lib/api';

export default function AboutPage() {
  const settings = useSettings((s) => s.settings);

  return (
    <div className="container-page py-8">
      <div className="grid items-center gap-8 lg:grid-cols-2">
        <div>
          <span className="badge bg-brand-50 text-brand-700">আমাদের সম্পর্কে</span>
          <h1 className="mt-3 text-2xl font-bold text-ink-900 sm:text-3xl">{settings.site_name_bn}</h1>
          <p className="mt-1 text-sm font-medium text-brand-600">{settings.site_tagline}</p>
          <p className="mt-4 text-sm leading-relaxed text-gray-600">
            {settings.footer_about ||
              `${settings.site_name_bn} একটি বাংলাদেশি অনলাইন মার্কেটপ্লেস — প্রতিদিনের প্রয়োজনীয় পণ্য সঠিক দামে ও দ্রুত ডেলিভারিতে গ্রাহকের কাছে পৌঁছে দেওয়াই আমাদের লক্ষ্য। আমাদের সব পণ্য যাচাই করা, অর্ডার ও ডেলিভারি সম্পূর্ণ স্বচ্ছ, এবং গ্রাহকসেবা দল সবসময় পাশে।`}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <LinkButton to="/shop">পণ্য দেখুন</LinkButton>
            <LinkButton to="/contact" variant="outline">যোগাযোগ</LinkButton>
          </div>
        </div>
        <div className="card overflow-hidden p-2">
          <SmartImage src={mediaUrl(settings.logo_with_name_url)} alt={settings.site_name_bn} className="h-full w-full object-contain" />
        </div>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: ShieldCheck, title: 'অরিজিনাল পণ্য', text: 'প্রতিটি পণ্য যাচাই করে তবেই তালিকায় যোগ করা হয়।' },
          { icon: Truck, title: 'দ্রুত ডেলিভারি', text: `ঢাকার ভিতরে ${taka(settings.inside_dhaka_charge)}, বাইরে ${taka(settings.outside_dhaka_charge)} ডেলিভারি চার্জ।` },
          { icon: HeartHandshake, title: 'গ্রাহক প্রথম', text: `${settings.support_hours} গ্রাহকসেবা — যেকোনো সমস্যায় পাশে আছি।` },
          { icon: Target, title: 'স্বচ্ছ দাম', text: 'কোনো লুকানো চার্জ নেই, চেকআউটেই সম্পূর্ণ হিসাব দেখানো হয়।' },
        ].map((item) => (
          <Card key={item.title} className="p-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600"><item.icon className="h-5 w-5" /></span>
            <p className="mt-3 text-sm font-semibold text-ink-900">{item.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">{item.text}</p>
          </Card>
        ))}
      </div>

      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <h2 className="text-base font-semibold text-ink-900">আমাদের লক্ষ্য</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            বাংলাদেশের প্রতিটি পরিবারের প্রতিদিনের প্রয়োজনীয় পণ্য সঠিক দামে, দ্রুততম সময়ে পৌঁছে দেওয়া — এবং কেনাকাটাকে সহজ, নিরাপদ ও আস্থার জায়গা বানানো।
          </p>
        </Card>
        <Card className="p-5">
          <h2 className="text-base font-semibold text-ink-900">ডেলিভারি নীতিমালা</h2>
          <ul className="mt-2 space-y-1.5 text-sm text-gray-600">
            <li>• ঢাকার ভিতরে: {taka(settings.inside_dhaka_charge)}</li>
            <li>• ঢাকার বাইরে: {taka(settings.outside_dhaka_charge)}</li>
            <li>
              • {settings.free_shipping_enabled === 'true'
                ? `${taka(settings.free_shipping_threshold)}+ অর্ডারে ফ্রি ডেলিভারি (${settings.free_shipping_scope === 'all' ? 'সব এলাকায়' : 'ঢাকার ভিতরে'})`
                : 'বর্তমানে ফ্রি ডেলিভারি অফার চালু নেই'}
            </li>
            <li>• ডেলিভারি সময়: ঢাকায় ২৪–৪৮ ঘণ্টা, বাইরে ২–৫ দিন</li>
          </ul>
        </Card>
        <Card className="p-5">
          <h2 className="text-base font-semibold text-ink-900">যোগাযোগ</h2>
          <ul className="mt-2 space-y-1.5 text-sm text-gray-600">
            <li className="flex items-center gap-2"><HeadphonesIcon className="h-4 w-4 text-brand-600" /> {settings.contact_phone}</li>
            <li className="flex items-center gap-2"><Store className="h-4 w-4 text-brand-600" /> {settings.contact_address}</li>
          </ul>
          <Link to="/contact" className="mt-3 inline-block text-sm font-medium text-brand-600 hover:underline">যোগাযোগ ফর্ম →</Link>
        </Card>
      </div>
    </div>
  );
}
