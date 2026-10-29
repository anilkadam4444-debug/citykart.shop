import type {Metadata, Viewport} from 'next';

import './globals.css';
import {UrbanDirectProvider} from '@/components/urbandirect-provider';
import {SITE_CONFIG} from '@/lib/seo-config';
import {generateOrganizationSchema, generateWebsiteSchema} from '@/lib/seo-schema';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#003B8E',
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_CONFIG.siteUrl),
  title: {
    default: SITE_CONFIG.defaultTitle,
    template: SITE_CONFIG.titleTemplate,
  },
  description: SITE_CONFIG.defaultDescription,
  applicationName: SITE_CONFIG.name,
  keywords: [
    'local commerce',
    'shop local stores',
    'hyperlocal delivery',
    'local marketplace',
    'neighborhood grocery',
    'cash on delivery',
    'UPI on delivery',
    'Citykart',
  ],
  authors: [{name: 'Citykart Team'}],
  creator: 'Citykart',
  publisher: 'Citykart',
  formatDetection: {
    telephone: true,
    address: true,
    email: true,
  },
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: SITE_CONFIG.defaultTitle,
    description: SITE_CONFIG.defaultDescription,
    url: SITE_CONFIG.siteUrl,
    siteName: SITE_CONFIG.name,
    locale: SITE_CONFIG.defaultLocale,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_CONFIG.defaultTitle,
    description: SITE_CONFIG.defaultDescription,
    creator: SITE_CONFIG.social.twitterHandle,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  const websiteSchema = generateWebsiteSchema();
  const organizationSchema = generateOrganizationSchema();

  return (
    <html lang="en">
      <body
        suppressHydrationWarning
        className="bg-[#F8FAFC] text-slate-900 antialiased selection:bg-[#003B8E] selection:text-white font-sans"
      >
        <script
          key="website-schema"
          type="application/ld+json"
          dangerouslySetInnerHTML={{__html: JSON.stringify(websiteSchema)}}
        />
        <script
          key="organization-schema"
          type="application/ld+json"
          dangerouslySetInnerHTML={{__html: JSON.stringify(organizationSchema)}}
        />
        <UrbanDirectProvider>{children}</UrbanDirectProvider>
      </body>
    </html>
  );
}
