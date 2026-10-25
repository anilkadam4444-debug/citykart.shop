import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Clock, HelpCircle, Mail, Store } from 'lucide-react';
import { getCanonicalUrl, SITE_CONFIG } from '@/lib/seo-config';
import { generateBreadcrumbSchema } from '@/lib/seo-schema';

export const metadata: Metadata = {
  title: 'Contact & Support | Citykart',
  description:
    'Need help with an order, store registration, or neighborhood delivery? Contact the Citykart team for rapid customer and merchant assistance.',
  alternates: {
    canonical: getCanonicalUrl('/contact'),
  },
};

export default function ContactPage() {
  const breadcrumbs = [
    { name: 'Home', url: '/' },
    { name: 'Contact & Support', url: '/contact' },
  ];
  const breadcrumbSchema = generateBreadcrumbSchema(breadcrumbs);

  const contactSchema = {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    name: 'Citykart Contact & Support',
    description: 'Get in touch with Citykart for customer assistance and seller support.',
    url: getCanonicalUrl('/contact'),
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(contactSchema) }}
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
              Contact & Support
            </li>
          </ol>
        </nav>

        <section className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-10 shadow-xs space-y-8">
          <div className="space-y-2 max-w-2xl">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-blue-50 border border-blue-200/80 text-[11px] font-bold uppercase tracking-wider text-[#003B8E]">
              Help Center
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              We&apos;re Here to Help
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed pt-1">
              Have questions about your local order, neighborhood delivery, or opening a new store on Citykart? Reach out to our customer care and merchant operations team.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2.5">
              <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[#003B8E]">
                <Mail className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">Customer Support Email</h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                For order tracking queries, delivery feedback, and platform support:
              </p>
              <a
                href={`mailto:${SITE_CONFIG.supportEmail}`}
                className="text-xs font-bold text-[#003B8E] hover:underline block pt-1"
              >
                {SITE_CONFIG.supportEmail}
              </a>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2.5">
              <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[#F96302]">
                <Store className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">Merchant Helpdesk</h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                For store onboarding, product listing help, and catalog inquiries:
              </p>
              <a
                href="mailto:merchants@citykart.shop"
                className="text-xs font-bold text-[#003B8E] hover:underline block pt-1"
              >
                merchants@citykart.shop
              </a>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2.5">
              <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-emerald-700">
                <Clock className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">Operational Hours</h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Our support team is available Monday through Sunday, 08:00 AM to 10:00 PM IST to assist with live local deliveries.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2.5">
              <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[#003B8E]">
                <HelpCircle className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">Quick Resolution</h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Need to cancel or modify a live order? Open &quot;My Orders&quot; in the top navigation to view store phone numbers and delivery status in real-time.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
