import React, { Suspense } from 'react';
import { PartnerOtpVerification } from '@/components/partner-otp-verification';

export const dynamic = 'force-dynamic';

export default function PartnerVerifyOtpPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6 text-slate-600 text-sm font-semibold">
          Loading City Partner OTP Verification...
        </div>
      }
    >
      <PartnerOtpVerification />
    </Suspense>
  );
}
