'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle, RotateCcw } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App router error caught:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6 text-stone-900">
      <div className="max-w-md w-full bg-white rounded-2xl border border-stone-200 p-8 text-center shadow-xs space-y-4">
        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-stone-900">Something went wrong!</h1>
          <p className="text-xs text-stone-500 mt-1">
            An unexpected error occurred while loading this page.
          </p>
        </div>
        <div className="flex flex-col gap-2 pt-2">
          <button
            onClick={() => reset()}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold transition-colors w-full cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-700 text-xs font-semibold transition-colors w-full"
          >
            Back to Citykart Home
          </Link>
        </div>
      </div>
    </div>
  );
}
