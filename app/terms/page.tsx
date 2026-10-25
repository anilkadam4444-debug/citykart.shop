import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';
import { getCanonicalUrl } from '@/lib/seo-config';
import { generateBreadcrumbSchema } from '@/lib/seo-schema';

export const metadata: Metadata = {
  title: 'Terms and Conditions | Citykart',
  description:
    'Review the terms of service governing customer orders, merchant listings, delivery commitments, and doorstep payments on the Citykart intra-city platform.',
  alternates: {
    canonical: getCanonicalUrl('/terms'),
  },
};

export default function TermsPage() {
  const breadcrumbs = [
    { name: 'Home', url: '/' },
    { name: 'Terms and Conditions', url: '/terms' },
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
              Terms & Conditions
            </li>
          </ol>
        </nav>

        <section className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-10 shadow-xs space-y-6">
          <div className="space-y-2 border-b border-slate-100 pb-5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Terms & Conditions
            </h1>
            <p className="text-xs text-slate-500">
              Document Version: 2026-v1.2 · Effective Date: October 2026 · Citykart Marketplace Platform
            </p>
          </div>

          <div className="space-y-6 text-xs text-slate-600 leading-relaxed">
            <div className="space-y-2">
              <h2 className="text-sm font-bold text-slate-900">1. Platform Nature</h2>
              <p>
                Citykart functions as an online marketplace technology platform enabling buyers to discover and purchase products directly from independent, verified local stores. While Citykart facilitates catalog presentation, order routing, and notification services, the commercial contract of sale is established directly between the buyer and the fulfilling independent merchant.
              </p>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h2 className="text-base font-extrabold text-slate-900">
                2. Seller Responsibility for Orders, Products and Delivery
              </h2>

              <div className="space-y-2 pl-3.5 border-l-2 border-[#003B8E]/30">
                <h3 className="text-xs font-bold text-slate-900">2.1 Independent Sellers</h3>
                <p>
                  Citykart operates as a marketplace platform that enables buyers to discover products offered by independent sellers. Unless expressly stated otherwise in a separate written agreement, sellers operate independently and are responsible for their own products, stores, sales and fulfillment activities.
                </p>
              </div>

              <div className="space-y-2 pl-3.5 border-l-2 border-[#003B8E]/30">
                <h3 className="text-xs font-bold text-slate-900">2.2 Order Acceptance and Processing</h3>
                <p>
                  Each seller is responsible for reviewing incoming orders, determining whether to accept or reject them in accordance with applicable law and the platform&apos;s existing policies, maintaining accurate product information and availability, and processing accepted orders.
                </p>
                <p>
                  An order submission or acknowledgement by Citykart does not necessarily mean that the seller has accepted the order. The order&apos;s actual status will be displayed according to the platform&apos;s order-management workflow.
                </p>
              </div>

              <div className="space-y-2 pl-3.5 border-l-2 border-[#003B8E]/30">
                <h3 className="text-xs font-bold text-slate-900">2.3 Product Quality and Accuracy</h3>
                <p>
                  Sellers are responsible for the accuracy of their product descriptions, prices, images, specifications, stock information and other representations. Sellers are responsible for supplying products that conform to applicable legal requirements and the representations made to buyers.
                </p>
              </div>

              <div className="space-y-2 pl-3.5 border-l-2 border-[#003B8E]/30">
                <h3 className="text-xs font-bold text-slate-900">2.4 Packaging, Fulfillment and Delivery</h3>
                <p>
                  Unless a separate written arrangement explicitly states otherwise, sellers are responsible for preparing, packaging and fulfilling accepted orders; arranging and completing delivery or pickup; communicating material delivery updates; and addressing delivery delays, failed deliveries, damaged goods or non-delivery.
                </p>
                <p>
                  Any delivery estimates shown on the platform are subject to the applicable seller arrangements and should not be represented as guaranteed unless an authorized policy expressly provides otherwise.
                </p>
              </div>

              <div className="space-y-2 pl-3.5 border-l-2 border-[#003B8E]/30">
                <h3 className="text-xs font-bold text-slate-900">2.5 Customer Service, Cancellations, Returns and Refunds</h3>
                <p>
                  Sellers are responsible for handling order-related customer service and for fulfilling their applicable cancellation, return, replacement, refund and warranty obligations, subject to applicable law and the platform&apos;s existing policies.
                </p>
                <p>
                  Nothing in this section overrides a buyer&apos;s mandatory statutory rights or any refund, cancellation or dispute policy expressly applicable to the transaction.
                </p>
              </div>

              <div className="space-y-2 pl-3.5 border-l-2 border-[#003B8E]/30">
                <h3 className="text-xs font-bold text-slate-900">2.6 Disputes Between Buyers and Sellers</h3>
                <p>
                  Buyers and sellers are expected to communicate in good faith to resolve disputes concerning products, order acceptance, payment, product condition, delivery, cancellations, returns or refunds.
                </p>
                <p>
                  Citykart does not ordinarily undertake the seller&apos;s operational responsibilities merely because an order was placed through the platform. However, Citykart may provide the platform&apos;s existing support, reporting or dispute-escalation mechanisms where available or legally required.
                </p>
              </div>

              <div className="space-y-2 pl-3.5 border-l-2 border-[#003B8E]/30">
                <h3 className="text-xs font-bold text-slate-900">2.7 Platform Role and Limits of Liability</h3>
                <p>
                  Citykart provides technology and marketplace services that facilitate discovery and interaction between buyers and independent sellers. Except where expressly stated in an applicable agreement or required by law, Citykart is not the seller of listed products and does not itself undertake each seller&apos;s product-supply or delivery obligations.
                </p>
                <p>
                  Nothing in these Terms excludes or limits liability that cannot lawfully be excluded or limited, including any non-waivable consumer rights or obligations imposed on the platform under applicable law.
                </p>
              </div>

              <div className="space-y-2 pl-3.5 border-l-2 border-[#003B8E]/30">
                <h3 className="text-xs font-bold text-slate-900">2.8 Seller&apos;s Independent Obligations</h3>
                <p>
                  Each seller remains responsible for complying with applicable product-safety, consumer-protection, tax, licensing, delivery and other legal obligations relevant to the seller&apos;s business and transactions.
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">3. Payment on Delivery</h2>
              <p>
                Buyers settle payment directly upon order arrival at their specified address via Cash on Delivery (COD), UPI QR code scan, or card tap on delivery. Buyers agree to complete the payment transaction promptly when items are delivered by the merchant.
              </p>
            </div>

            <div className="space-y-2 pt-4 border-t border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">4. Cancellations & Returns Policy</h2>
              <p>
                Orders may be cancelled prior to store dispatch. For returns, replacements, or defective items, buyers can contact the fulfilling store directly or use Citykart support channels. Review our full{' '}
                <Link href="/delivery-returns" className="text-[#003B8E] font-bold underline">
                  Cancellation & Delivery Returns Policy
                </Link>{' '}
                for details.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
