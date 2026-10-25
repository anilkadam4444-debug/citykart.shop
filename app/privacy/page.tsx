import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';
import { getCanonicalUrl } from '@/lib/seo-config';
import { generateBreadcrumbSchema } from '@/lib/seo-schema';

export const metadata: Metadata = {
  title: 'Privacy Policy | Citykart',
  description:
    'Read Citykart’s Privacy Policy to understand how we collect, use, and protect your telephone number, delivery address, and local shopping information.',
  alternates: {
    canonical: getCanonicalUrl('/privacy'),
  },
};

export default function PrivacyPolicyPage() {
  const breadcrumbs = [
    { name: 'Home', url: '/' },
    { name: 'Privacy Policy', url: '/privacy' },
  ];
  const breadcrumbSchema = generateBreadcrumbSchema(breadcrumbs);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-2xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center gap-2.5 group"
          >
            <div className="relative w-8 h-8 rounded-lg bg-[#003B8E]/5 border border-[#003B8E]/15 flex items-center justify-center overflow-hidden shrink-0">
              <Image
                src="/citykart-icon.png"
                alt="Citykart"
                width={26}
                height={26}
                className="w-6 h-6 object-contain"
                referrerPolicy="no-referrer"
                priority
              />
            </div>
            <div className="flex items-baseline tracking-tight leading-none">
              <span className="text-lg font-extrabold text-[#003B8E]">City</span>
              <span className="text-lg font-extrabold text-[#F96302]">kart</span>
              <span className="text-[11px] font-bold text-slate-400 ml-0.5">.shop</span>
            </div>
          </Link>
          <Link
            href="/"
            className="text-xs font-bold text-slate-700 hover:text-[#003B8E] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Shopping</span>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <nav aria-label="Breadcrumb" className="text-xs text-slate-500">
          <ol className="flex items-center gap-1.5">
            <li>
              <Link href="/" className="hover:text-[#003B8E] hover:underline font-medium">
                Home
              </Link>
            </li>
            <li aria-hidden="true" className="text-slate-300">/</li>
            <li aria-current="page" className="font-bold text-slate-900">
              Privacy Policy
            </li>
          </ol>
        </nav>

        <section className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-10 shadow-xs space-y-6">
          <div className="space-y-2 border-b border-slate-100 pb-5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Privacy Policy
            </h1>
            <p className="text-xs text-slate-500">
              Last updated: October 2026 · Effective for all Citykart users worldwide
            </p>
          </div>

          <div className="space-y-5 text-xs text-slate-600 leading-relaxed">
            <h2 className="text-sm font-bold text-slate-900">1. Information We Collect</h2>
            <p>
              To provide a seamless local commerce experience, Citykart collects minimal necessary information:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-slate-900">Mobile Phone Number:</strong> Used exclusively for secure OTP (One-Time Password) sign-in and delivery notifications.</li>
              <li><strong className="text-slate-900">Delivery Location:</strong> City, neighborhood, and street address selected by the user to filter local catalogs and deliver orders.</li>
              <li><strong className="text-slate-900">Order History:</strong> Product items, quantities, and chosen delivery payment method (Cash on Delivery or UPI).</li>
            </ul>

            <h2 className="text-sm font-bold text-slate-900 pt-3">2. How We Use Your Data</h2>
            <p>
              Your data is utilized solely to facilitate intra-city commerce between you and eligible local stores. We never sell, rent, or trade your personal information to third-party data brokers or marketing networks.
            </p>

            <h2 className="text-sm font-bold text-slate-900 pt-3">3. Data Security & Encryption</h2>
            <p>
              All customer sessions and catalog queries are encrypted in transit via SSL/TLS. Authentication credentials use secure Firebase Authentication tokens. Only the designated store fulfilling your order receives the customer contact details necessary for dispatch.
            </p>

            <h2 className="text-sm font-bold text-slate-900 pt-3">4. Cookies & Browser Storage</h2>
            <p>
              Citykart uses local browser storage exclusively to remember your selected delivery city, shopping cart items, and active order trackers across page refreshes.
            </p>

            <h2 className="text-sm font-bold text-slate-900 pt-3">5. Contact Us Regarding Privacy</h2>
            <p>
              For inquiries regarding personal data deletion or access rights, contact our Privacy Officer at <a href="mailto:support@citykart.shop" className="text-[#003B8E] font-bold hover:underline">support@citykart.shop</a>.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
