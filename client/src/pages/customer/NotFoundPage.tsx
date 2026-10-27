import { Link } from 'react-router-dom';
import { LinkButton } from '@/components/ui';

export default function NotFoundPage() {
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <p className="text-6xl font-extrabold text-brand-200">404</p>
      <h1 className="mt-2 text-xl font-bold text-ink-900">পৃষ্ঠাটি খুঁজে পাওয়া যায়নি</h1>
      <p className="mt-1 max-w-sm text-sm text-gray-500">লিংকটি ভুল হতে পারে, অথবা পৃষ্ঠাটি সরানো হয়েছে।</p>
      <div className="mt-6 flex gap-2">
        <LinkButton to="/">হোমে ফিরুন</LinkButton>
        <Link to="/shop" className="inline-flex h-10 items-center rounded-lg border border-gray-300 px-4 text-sm font-medium hover:bg-gray-50">পণ্য দেখুন</Link>
      </div>
    </div>
  );
}
