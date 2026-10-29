'use client';

import React, { useState } from 'react';
import { Star, CheckCircle2, Sparkles } from 'lucide-react';
import { OrderRecord } from '@/lib/catalog-data';
import { useUrbanDirect } from './urbandirect-provider';

interface StoreRatingBadgeProps {
  storeId?: string;
  fallbackRating?: number;
  fallbackReviewsCount?: number;
  size?: 'xs' | 'sm' | 'md';
  showReviewsCount?: boolean;
  className?: string;
}

/**
 * Displays the live average star rating for a store.
 * Reads live store state from UrbanDirectContext when storeId is provided,
 * falling back to static props for SSR compatibility.
 */
export function StoreRatingBadge({
  storeId,
  fallbackRating = 4.8,
  fallbackReviewsCount,
  size = 'sm',
  showReviewsCount = true,
  className = '',
}: StoreRatingBadgeProps) {
  const { stores } = useUrbanDirect();
  const liveStore = storeId ? stores.find((s) => s.id === storeId) : undefined;

  const rawRating = liveStore?.rating ?? fallbackRating;
  const rating = Number.isFinite(rawRating) && rawRating > 0 ? rawRating : 4.8;
  const reviewsCount = liveStore?.reviewsCount ?? fallbackReviewsCount;

  const sizeStyles = {
    xs: 'text-[10px] gap-0.5',
    sm: 'text-xs gap-1',
    md: 'text-sm gap-1.5',
  }[size];

  const starStyles = {
    xs: 'w-3 h-3',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
  }[size];

  return (
    <span
      className={`inline-flex items-center font-mono tabular-nums font-bold text-slate-800 ${sizeStyles} ${className}`}
      title={`Average store rating: ${rating.toFixed(1)} out of 5 stars${
        reviewsCount ? ` (${reviewsCount} ratings)` : ''
      }`}
    >
      <Star className={`${starStyles} fill-amber-400 text-amber-500 shrink-0`} />
      <span>{rating.toFixed(1)}</span>
      {showReviewsCount && typeof reviewsCount === 'number' && reviewsCount > 0 && (
        <span className="text-slate-400 font-normal">({reviewsCount})</span>
      )}
    </span>
  );
}

interface OrderStoreRatingWidgetProps {
  order: OrderRecord;
  compact?: boolean;
}

const STAR_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very Good',
  5: 'Excellent',
};

/**
 * Interactive 1–5 star rating widget for orders marked as 'DELIVERED'.
 * Also provides a quick helper to mark active orders as 'DELIVERED' for testing.
 */
export function OrderStoreRatingWidget({ order, compact = false }: OrderStoreRatingWidgetProps) {
  const { handleSubmitStoreRating, handleSetOrderStep, stores } = useUrbanDirect();
  const [selectedRating, setSelectedRating] = useState<number>(order.storeRating || 5);
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);
  const [comment, setComment] = useState<string>(order.storeReviewComment || '');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isDelivered =
    order.orderStatus === 'DELIVERED' || order.currentStepIndex >= 3;
  const isCancelledOrRejected =
    order.orderStatus === 'CANCELLED' || order.orderStatus === 'REJECTED';

  const matchedStore = stores.find((s) => s.id === order.storeId);

  if (isCancelledOrRejected) {
    return null;
  }

  // If the order is not yet delivered, show a clear message and a 1-click "Mark as Delivered" button so buyers can test rating immediately
  if (!isDelivered) {
    return (
      <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-slate-200/90 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-600">
          <Star className="w-4 h-4 text-slate-400 shrink-0" />
          <span>
            Store star-rating unlocks once your order from{' '}
            <strong className="text-slate-800">{order.storeName}</strong> is marked as{' '}
            <strong className="text-emerald-700">DELIVERED</strong>.
          </span>
        </div>
        <button
          type="button"
          onClick={() => handleSetOrderStep(order.id, 3)}
          className="px-3 py-2 min-h-[38px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-2xs"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Mark as Delivered</span>
        </button>
      </div>
    );
  }

  // Already rated state
  if (typeof order.storeRating === 'number' && order.storeRating >= 1) {
    return (
      <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200/80 space-y-2 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900">
              Your Rating for {order.storeName}:
            </span>
            <div className="inline-flex items-center gap-0.5" aria-label={`Rated ${order.storeRating} out of 5 stars`}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-4 h-4 ${
                    star <= (order.storeRating || 0)
                      ? 'fill-amber-400 text-amber-500'
                      : 'text-slate-300'
                  }`}
                />
              ))}
            </div>
            <span className="font-mono tabular-nums font-bold text-amber-900">
              {order.storeRating}.0 / 5.0
            </span>
          </div>
          {matchedStore && (
            <div className="text-[11px] text-slate-600 flex items-center gap-1.5">
              <span>Updated Store Avg:</span>
              <StoreRatingBadge storeId={matchedStore.id} size="xs" />
            </div>
          )}
        </div>
        {order.storeReviewComment && (
          <p className="text-slate-700 italic bg-white/80 px-3 py-2 rounded-lg border border-amber-200/60">
            &ldquo;{order.storeReviewComment}&rdquo;
          </p>
        )}
      </div>
    );
  }

  const activeStars = hoveredRating ?? selectedRating;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRating < 1 || selectedRating > 5) {
      setErrorMsg('Please select between 1 and 5 stars.');
      return;
    }
    setErrorMsg(null);
    handleSubmitStoreRating(order.id, selectedRating, comment.trim() || undefined);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`rounded-xl bg-amber-50/50 border border-amber-200/90 ${
        compact ? 'p-3.5 space-y-3' : 'p-4 sm:p-5 space-y-3.5'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Rate your experience with {order.storeName}</span>
          </div>
          <p className="text-[11px] text-slate-600 mt-0.5">
            Your order is delivered! Share a star rating to help neighbors discover trusted local stores.
          </p>
        </div>
        {matchedStore && (
          <div className="text-[11px] text-slate-600 flex items-center gap-1.5 shrink-0">
            <span>Current avg:</span>
            <StoreRatingBadge storeId={matchedStore.id} size="xs" />
          </div>
        )}
      </div>

      {/* 1-5 Interactive Stars */}
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded-xl border border-amber-200 shadow-2xs"
          role="radiogroup"
          aria-label={`Star rating for ${order.storeName}`}
        >
          {[1, 2, 3, 4, 5].map((star) => {
            const isFilled = star <= activeStars;
            return (
              <button
                key={star}
                type="button"
                role="radio"
                aria-checked={selectedRating === star}
                aria-label={`Rate ${star} ${star === 1 ? 'star' : 'stars'} (${STAR_LABELS[star]})`}
                onClick={() => setSelectedRating(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(null)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-amber-50 transition-transform active:scale-95 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#003B8E]"
              >
                <Star
                  className={`w-6 h-6 transition-colors ${
                    isFilled
                      ? 'fill-amber-400 text-amber-500'
                      : 'text-slate-300 hover:text-amber-300'
                  }`}
                />
              </button>
            );
          })}
        </div>

        <span className="text-xs font-bold font-mono tabular-nums text-amber-900">
          {activeStars}.0 ★ — {STAR_LABELS[activeStars]}
        </span>
      </div>

      {/* Optional Comment & Submit Button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <input
          type="text"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Optional feedback on packaging, freshness, or delivery speed..."
          maxLength={200}
          aria-label="Optional store review comment"
          className="flex-1 px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#003B8E] text-slate-800"
        />
        <button
          type="submit"
          className="px-4 py-2.5 min-h-[40px] rounded-xl bg-[#003B8E] hover:bg-[#002D6E] text-white text-xs font-bold transition-colors cursor-pointer shrink-0 shadow-xs"
        >
          Submit Rating
        </button>
      </div>

      {errorMsg && (
        <p className="text-xs font-semibold text-red-600">{errorMsg}</p>
      )}
    </form>
  );
}
