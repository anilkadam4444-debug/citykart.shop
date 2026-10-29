'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  ExternalLink,
  QrCode,
  ShieldCheck,
} from 'lucide-react';
import { formatCurrency, LocalStore, OrderRecord } from '@/lib/catalog-data';
import { generateDynamicUpiQrForOrder } from '@/lib/upi-qr';

interface UpiQrCodeCardProps {
  order: OrderRecord;
  store?: Pick<LocalStore, 'id' | 'name' | 'sellerName' | 'upiHandle'> | null;
  overrideMerchantUpiId?: string;
  overrideMerchantName?: string;
  compact?: boolean;
}

export function UpiQrCodeCard({
  order,
  store,
  overrideMerchantUpiId,
  overrideMerchantName,
  compact = false,
}: UpiQrCodeCardProps) {
  const [copiedField, setCopiedField] = useState<'amount' | 'upi' | null>(null);

  const qrData = useMemo(
    () =>
      generateDynamicUpiQrForOrder({
        order,
        store,
        overrideMerchantUpiId,
        overrideMerchantName,
      }),
    [order, store, overrideMerchantUpiId, overrideMerchantName]
  );

  const handleCopy = async (value: string, field: 'amount' | 'upi') => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(value);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2200);
      }
    } catch {
      // Clipboard API unavailable in restricted context
    }
  };

  if (!qrData.ok) {
    return (
      <div
        role="alert"
        className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-2"
      >
        <div className="flex items-start gap-2 font-bold">
          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <span>UPI QR Code Unavailable</span>
        </div>
        <p className="text-amber-900 leading-relaxed">{qrData.error}</p>
      </div>
    );
  }

  const matrix = qrData.qrMatrix || [];
  const matrixSize = matrix.length;
  const quietZone = 4;
  const totalViewBox = matrixSize + quietZone * 2;

  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-xs p-4 sm:p-5 space-y-4">
      {/* Header & Exact Payable Amount */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#003B8E]">
            <QrCode className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-extrabold text-slate-900">
              Dynamic UPI Payment QR
            </div>
            <div className="text-[11px] text-slate-500 font-mono">
              Order #{order.id} · Ref: {qrData.orderReference}
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Exact Payable Amount
          </div>
          <div className="text-lg sm:text-xl font-extrabold font-mono tabular-nums text-[#003B8E]">
            ₹{qrData.amountFormatted}
          </div>
        </div>
      </div>

      {/* Scannable QR Code SVG + Payee Metadata */}
      <div
        className={`grid grid-cols-1 ${
          compact ? '' : 'sm:grid-cols-12'
        } gap-4 items-center`}
      >
        <div
          className={`${
            compact ? '' : 'sm:col-span-5'
          } flex flex-col items-center justify-center`}
        >
          <div className="p-2.5 bg-white rounded-2xl border-2 border-slate-900 shadow-xs">
            <svg
              viewBox={`0 0 ${totalViewBox} ${totalViewBox}`}
              width={compact ? 176 : 204}
              height={compact ? 176 : 204}
              shapeRendering="crispEdges"
              role="img"
              aria-label={`UPI QR Code for ${qrData.merchantName} (${qrData.merchantUpiId}) for exact amount INR ${qrData.amountFormatted}`}
              className="w-44 h-44 sm:w-48 sm:h-48 block"
            >
              <rect
                x={0}
                y={0}
                width={totalViewBox}
                height={totalViewBox}
                fill="#FFFFFF"
              />
              {matrix.map((row, rIdx) =>
                row.map((isDark, cIdx) =>
                  isDark ? (
                    <rect
                      key={`${rIdx}-${cIdx}`}
                      x={cIdx + quietZone}
                      y={rIdx + quietZone}
                      width={1}
                      height={1}
                      fill="#0F172A"
                    />
                  ) : null
                )
              )}
            </svg>
          </div>
          <span className="mt-1.5 text-[11px] font-semibold text-slate-600 text-center">
            GPay · PhonePe · Paytm · BHIM
          </span>
        </div>

        <div
          className={`${
            compact ? '' : 'sm:col-span-7'
          } space-y-3 text-xs text-slate-700`}
        >
          <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200/80 text-blue-950 font-semibold leading-relaxed">
            Scan with any supported UPI app and pay the exact amount shown.
          </div>

          <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200/90">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500 font-medium">Payee Name:</span>
              <span className="font-bold text-slate-900 text-right">
                {qrData.merchantName}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500 font-medium">Merchant UPI ID:</span>
              <span className="font-mono font-bold text-[#003B8E] break-all text-right">
                {qrData.merchantUpiId}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/80">
              <span className="text-slate-500 font-medium">Locked Amount:</span>
              <span className="font-mono font-extrabold text-slate-900">
                ₹{qrData.amountFormatted} ({formatCurrency(order.total)})
              </span>
            </div>
          </div>

          {/* Fallback Copy & Mobile Deep-Link Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleCopy(qrData.amountFormatted || '', 'amount')}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              {copiedField === 'amount' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Amount Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copy Amount (₹{qrData.amountFormatted})</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleCopy(qrData.merchantUpiId || '', 'upi')}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              {copiedField === 'upi' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>UPI ID Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copy UPI ID</span>
                </>
              )}
            </button>

            <a
              href={qrData.upiUri}
              className="px-3 py-1.5 rounded-lg bg-[#003B8E] hover:bg-[#002D6E] text-white text-[11px] font-bold inline-flex items-center gap-1.5 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in UPI App</span>
            </a>
          </div>
        </div>
      </div>

      {/* Strict Non-False-Confirmation Security Notice */}
      <div className="pt-2 border-t border-slate-100 flex items-start gap-2 text-[11px] text-slate-500">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
        <span>
          Displaying this QR code does not mark the order as paid. Order payment status remains{' '}
          <strong className="text-slate-700">{order.paymentStatus || 'PENDING'}</strong> until the delivery person or store verifies payment receipt.
        </span>
      </div>
    </div>
  );
}
