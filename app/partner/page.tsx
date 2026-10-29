import React from 'react';
import type { Metadata } from 'next';
import { CityPartnerPortal } from '@/components/city-partner-portal';

export const metadata: Metadata = {
  title: 'City Partner Program | 50/50 Revenue Attribution',
  description:
    'Join CityKart as an exclusive City Partner. Enable local storefronts and earn 50% territory revenue attribution.',
};

export default function PartnerPage() {
  return <CityPartnerPortal />;
}
