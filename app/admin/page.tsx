import React from 'react';
import type { Metadata } from 'next';
import { SuperAdminDashboard } from '@/components/super-admin-dashboard';

export const metadata: Metadata = {
  title: 'Super Admin Console | Citykart.shop Platform Governance',
  description:
    'Platform Owner Super Admin Console for Citykart.shop global hyperlocal marketplace.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminPage() {
  return <SuperAdminDashboard />;
}
