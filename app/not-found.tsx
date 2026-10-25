import React from 'react';
import Link from 'next/link';
import { ShoppingBag, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6 text-slate-900">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-xs space-y-4">
        <div className="w-16 h-16 bg-blue-50 text-[#003B8E] border border-blue-200/80 rounded-2xl flex items-center justify-center mx-auto">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Page Not Found</h1>
          <p className="text-xs text-slate-500 mt-1">
            The page or store you are looking for could not be found or has moved.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#003B8E] hover:bg-[#002D6E] text-white text-xs font-bold transition-colors w-full shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Citykart Home
        </Link>
      </div>
    </div>
  );
}
