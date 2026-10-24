import React from 'react';
import Link from 'next/link';
import { ShoppingBag, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6 text-stone-900">
      <div className="max-w-md w-full bg-white rounded-2xl border border-stone-200 p-8 text-center shadow-xs space-y-4">
        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-stone-900">Page Not Found</h1>
          <p className="text-xs text-stone-500 mt-1">
            The page or store you are looking for could not be found or has moved.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition-colors w-full"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Citykart Home
        </Link>
      </div>
    </div>
  );
}
