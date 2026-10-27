'use client';

import React, { useState } from 'react';
import {
  ShoppingBasket,
  Apple,
  Shirt,
  Laptop,
  Headphones,
  HeartPulse,
  Croissant,
  UtensilsCrossed,
  Sofa,
  Lamp,
  Wrench,
  Sparkles,
  ShoppingBag,
  Briefcase,
  BookOpen,
  Blocks,
  Watch,
  Car,
  PawPrint,
  Dumbbell,
  Coffee,
  Gift,
  Scissors,
  Sprout,
  SprayCan,
  Palette,
  PartyPopper,
  Store,
} from 'lucide-react';
import { getCategoryByIdOrName, CategoryDefinition } from '@/lib/catalog-data';

export interface CategoryIllustrationConfig {
  gradient: string;
  badgeBg: string;
  textColor: string;
  illustrationUrl: string;
  accentColor: string;
  emoji: string;
}

/**
 * Curated dynamic illustration profiles and high-res vector art for all 25 categories.
 */
export const CATEGORY_ILLUSTRATIONS: Record<string, CategoryIllustrationConfig> = {
  'cat-01-grocery-daily-essentials': {
    gradient: 'from-emerald-500 via-teal-600 to-green-700',
    badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    textColor: 'text-emerald-800',
    accentColor: '#10B981',
    emoji: '🧺',
    illustrationUrl:
      'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80',
  },
  'cat-02-fruits-vegetables': {
    gradient: 'from-amber-400 via-orange-500 to-red-500',
    badgeBg: 'bg-orange-50 text-orange-700 border-orange-200',
    textColor: 'text-orange-800',
    accentColor: '#F97316',
    emoji: '🍎',
    illustrationUrl:
      'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=400&q=80',
  },
  'cat-03-fashion-clothing': {
    gradient: 'from-pink-500 via-rose-500 to-purple-600',
    badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
    textColor: 'text-rose-800',
    accentColor: '#F43F5E',
    emoji: '👗',
    illustrationUrl:
      'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=400&q=80',
  },
  'cat-04-electronics-mobile-accessories': {
    gradient: 'from-blue-600 via-indigo-600 to-cyan-600',
    badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
    textColor: 'text-blue-800',
    accentColor: '#2563EB',
    emoji: '📱',
    illustrationUrl:
      'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=400&q=80',
  },
  'cat-05-pharmacy-healthcare-products': {
    gradient: 'from-red-500 via-rose-600 to-pink-600',
    badgeBg: 'bg-red-50 text-red-700 border-red-200',
    textColor: 'text-red-800',
    accentColor: '#EF4444',
    emoji: '🩺',
    illustrationUrl:
      'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=400&q=80',
  },
  'cat-06-bakery-sweets-desserts': {
    gradient: 'from-amber-500 via-yellow-600 to-orange-600',
    badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
    textColor: 'text-amber-900',
    accentColor: '#D97706',
    emoji: '🥐',
    illustrationUrl:
      'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=400&q=80',
  },
  'cat-07-restaurants-food': {
    gradient: 'from-orange-500 via-red-500 to-amber-600',
    badgeBg: 'bg-orange-50 text-orange-800 border-orange-200',
    textColor: 'text-orange-900',
    accentColor: '#EA580C',
    emoji: '🍲',
    illustrationUrl:
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
  },
  'cat-08-furniture-home-decor': {
    gradient: 'from-stone-600 via-warm-gray-700 to-amber-800',
    badgeBg: 'bg-stone-100 text-stone-800 border-stone-200',
    textColor: 'text-stone-900',
    accentColor: '#78716C',
    emoji: '🛋️',
    illustrationUrl:
      'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=400&q=80',
  },
  'cat-09-hardware-electricals-plumbing': {
    gradient: 'from-slate-700 via-zinc-800 to-stone-900',
    badgeBg: 'bg-slate-100 text-slate-800 border-slate-200',
    textColor: 'text-slate-900',
    accentColor: '#475569',
    emoji: '🔧',
    illustrationUrl:
      'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=400&q=80',
  },
  'cat-10-beauty-personal-care': {
    gradient: 'from-fuchsia-500 via-pink-500 to-purple-600',
    badgeBg: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
    textColor: 'text-fuchsia-900',
    accentColor: '#D946EF',
    emoji: '✨',
    illustrationUrl:
      'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=400&q=80',
  },
  'cat-11-footwear-bags': {
    gradient: 'from-amber-700 via-orange-800 to-stone-800',
    badgeBg: 'bg-amber-50 text-amber-900 border-amber-200',
    textColor: 'text-amber-950',
    accentColor: '#B45309',
    emoji: '👞',
    illustrationUrl:
      'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=400&q=80',
  },
  'cat-12-books-stationery-office-supplies': {
    gradient: 'from-indigo-600 via-blue-700 to-slate-800',
    badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    textColor: 'text-indigo-900',
    accentColor: '#4F46E5',
    emoji: '📚',
    illustrationUrl:
      'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=400&q=80',
  },
  'cat-13-toys-games-baby-products': {
    gradient: 'from-yellow-400 via-amber-500 to-pink-500',
    badgeBg: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    textColor: 'text-yellow-900',
    accentColor: '#EAB308',
    emoji: '🧸',
    illustrationUrl:
      'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?auto=format&fit=crop&w=400&q=80',
  },
  'cat-14-jewellery-watches': {
    gradient: 'from-amber-300 via-yellow-500 to-yellow-600',
    badgeBg: 'bg-amber-100 text-amber-900 border-amber-300',
    textColor: 'text-amber-950',
    accentColor: '#CA8A04',
    emoji: '💍',
    illustrationUrl:
      'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=400&q=80',
  },
  'cat-15-automotive-two-wheeler-accessories': {
    gradient: 'from-red-600 via-stone-800 to-zinc-900',
    badgeBg: 'bg-zinc-100 text-zinc-900 border-zinc-300',
    textColor: 'text-zinc-900',
    accentColor: '#DC2626',
    emoji: '🚗',
    illustrationUrl:
      'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=400&q=80',
  },
  'cat-16-pet-supplies': {
    gradient: 'from-cyan-500 via-teal-600 to-emerald-600',
    badgeBg: 'bg-cyan-50 text-cyan-800 border-cyan-200',
    textColor: 'text-cyan-900',
    accentColor: '#0891B2',
    emoji: '🐾',
    illustrationUrl:
      'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&w=400&q=80',
  },
  'cat-17-sports-fitness': {
    gradient: 'from-lime-500 via-emerald-600 to-teal-700',
    badgeBg: 'bg-lime-50 text-lime-800 border-lime-200',
    textColor: 'text-lime-900',
    accentColor: '#65A30D',
    emoji: '🏋️',
    illustrationUrl:
      'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=400&q=80',
  },
  'cat-18-home-kitchen-appliances': {
    gradient: 'from-sky-500 via-blue-600 to-indigo-700',
    badgeBg: 'bg-sky-50 text-sky-800 border-sky-200',
    textColor: 'text-sky-900',
    accentColor: '#0284C7',
    emoji: '☕',
    illustrationUrl:
      'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=400&q=80',
  },
  'cat-19-gifts-flowers-handicrafts': {
    gradient: 'from-rose-400 via-pink-500 to-red-500',
    badgeBg: 'bg-rose-50 text-rose-800 border-rose-200',
    textColor: 'text-rose-900',
    accentColor: '#E11D48',
    emoji: '🎁',
    illustrationUrl:
      'https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=400&q=80',
  },
  'cat-20-fabrics-tailoring-textiles': {
    gradient: 'from-purple-600 via-indigo-700 to-violet-800',
    badgeBg: 'bg-purple-50 text-purple-800 border-purple-200',
    textColor: 'text-purple-900',
    accentColor: '#9333EA',
    emoji: '✂️',
    illustrationUrl:
      'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&w=400&q=80',
  },
  'cat-21-agriculture-gardening': {
    gradient: 'from-green-600 via-emerald-700 to-stone-800',
    badgeBg: 'bg-green-50 text-green-800 border-green-200',
    textColor: 'text-green-900',
    accentColor: '#16A34A',
    emoji: '🌱',
    illustrationUrl:
      'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=400&q=80',
  },
  'cat-22-household-cleaning-supplies': {
    gradient: 'from-teal-400 via-cyan-500 to-blue-600',
    badgeBg: 'bg-teal-50 text-teal-800 border-teal-200',
    textColor: 'text-teal-900',
    accentColor: '#0D9488',
    emoji: '🧹',
    illustrationUrl:
      'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=400&q=80',
  },
  'cat-23-handicrafts-local-products': {
    gradient: 'from-amber-600 via-orange-700 to-yellow-800',
    badgeBg: 'bg-amber-100 text-amber-900 border-amber-300',
    textColor: 'text-amber-950',
    accentColor: '#D97706',
    emoji: '🎨',
    illustrationUrl:
      'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=400&q=80',
  },
  'cat-24-party-celebration-supplies': {
    gradient: 'from-violet-500 via-fuchsia-500 to-pink-500',
    badgeBg: 'bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200',
    textColor: 'text-fuchsia-900',
    accentColor: '#C026D3',
    emoji: '🎉',
    illustrationUrl:
      'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=400&q=80',
  },
  'cat-25-other-local-retail-stores': {
    gradient: 'from-slate-600 via-gray-700 to-zinc-800',
    badgeBg: 'bg-slate-100 text-slate-800 border-slate-200',
    textColor: 'text-slate-900',
    accentColor: '#475569',
    emoji: '🏪',
    illustrationUrl:
      'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=400&q=80',
  },
};

export interface CategoryIconProps {
  categoryIdOrName: string;
  className?: string;
  strokeWidth?: number;
  /**
   * Rendering mode:
   * - 'icon': Standard Lucide SVG icon (default for backwards compatibility)
   * - 'illustration': High-res dynamic category image/illustration with smooth fallback
   * - 'badge': Illustrated circle badge with vector graphic overlay
   * - 'card': Rich visual card preset with gradient backdrop and typography
   */
  variant?: 'icon' | 'illustration' | 'badge' | 'card';
  customImageUrl?: string;
  showBadgeText?: boolean;
}

export function CategoryIcon({
  categoryIdOrName,
  className = 'w-3.5 h-3.5',
  strokeWidth = 1.9,
  variant = 'icon',
  customImageUrl,
  showBadgeText = false,
}: CategoryIconProps) {
  const def = getCategoryByIdOrName(categoryIdOrName);
  const illustrationConfig = CATEGORY_ILLUSTRATIONS[def.id] || {
    gradient: 'from-slate-600 via-gray-700 to-zinc-800',
    badgeBg: 'bg-slate-100 text-slate-800 border-slate-200',
    textColor: 'text-slate-900',
    accentColor: '#003B8E',
    emoji: '🏪',
    illustrationUrl:
      'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=400&q=80',
  };

  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const activeImageUrl = customImageUrl || illustrationConfig.illustrationUrl;

  const renderLucideIcon = () => {
    if (def.id === 'cat-04-electronics-mobile-accessories') {
      return <Laptop className={className} strokeWidth={strokeWidth} />;
    }
    if (def.id === 'cat-08-furniture-home-decor') {
      return <Sofa className={className} strokeWidth={strokeWidth} />;
    }
    if (def.id === 'cat-11-footwear-bags') {
      return <ShoppingBag className={className} strokeWidth={strokeWidth} />;
    }

    switch (def.iconName) {
      case 'ShoppingBasket':
        return <ShoppingBasket className={className} strokeWidth={strokeWidth} />;
      case 'Apple':
        return <Apple className={className} strokeWidth={strokeWidth} />;
      case 'Shirt':
        return <Shirt className={className} strokeWidth={strokeWidth} />;
      case 'Laptop':
        return <Laptop className={className} strokeWidth={strokeWidth} />;
      case 'Headphones':
        return <Headphones className={className} strokeWidth={strokeWidth} />;
      case 'HeartPulse':
        return <HeartPulse className={className} strokeWidth={strokeWidth} />;
      case 'Croissant':
        return <Croissant className={className} strokeWidth={strokeWidth} />;
      case 'UtensilsCrossed':
        return <UtensilsCrossed className={className} strokeWidth={strokeWidth} />;
      case 'Sofa':
        return <Sofa className={className} strokeWidth={strokeWidth} />;
      case 'Lamp':
        return <Lamp className={className} strokeWidth={strokeWidth} />;
      case 'Wrench':
        return <Wrench className={className} strokeWidth={strokeWidth} />;
      case 'Sparkles':
        return <Sparkles className={className} strokeWidth={strokeWidth} />;
      case 'ShoppingBag':
        return <ShoppingBag className={className} strokeWidth={strokeWidth} />;
      case 'Briefcase':
        return <Briefcase className={className} strokeWidth={strokeWidth} />;
      case 'BookOpen':
        return <BookOpen className={className} strokeWidth={strokeWidth} />;
      case 'Blocks':
        return <Blocks className={className} strokeWidth={strokeWidth} />;
      case 'Watch':
        return <Watch className={className} strokeWidth={strokeWidth} />;
      case 'Car':
        return <Car className={className} strokeWidth={strokeWidth} />;
      case 'PawPrint':
        return <PawPrint className={className} strokeWidth={strokeWidth} />;
      case 'Dumbbell':
        return <Dumbbell className={className} strokeWidth={strokeWidth} />;
      case 'Coffee':
        return <Coffee className={className} strokeWidth={strokeWidth} />;
      case 'Gift':
        return <Gift className={className} strokeWidth={strokeWidth} />;
      case 'Scissors':
        return <Scissors className={className} strokeWidth={strokeWidth} />;
      case 'Sprout':
        return <Sprout className={className} strokeWidth={strokeWidth} />;
      case 'SprayCan':
        return <SprayCan className={className} strokeWidth={strokeWidth} />;
      case 'Palette':
        return <Palette className={className} strokeWidth={strokeWidth} />;
      case 'PartyPopper':
        return <PartyPopper className={className} strokeWidth={strokeWidth} />;
      default:
        return <Store className={className} strokeWidth={strokeWidth} />;
    }
  };

  // Standard icon variant (Default)
  if (variant === 'icon') {
    return renderLucideIcon();
  }

  // Pure dynamic illustration mode
  if (variant === 'illustration') {
    return (
      <div className={`relative overflow-hidden rounded-xl bg-slate-100 ${className}`}>
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 bg-slate-200/70 animate-pulse flex items-center justify-center">
            {renderLucideIcon()}
          </div>
        )}
        {!imageError ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={activeImageUrl}
            alt={def.name}
            referrerPolicy="no-referrer"
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ) : (
          <div
            className={`w-full h-full bg-gradient-to-br ${illustrationConfig.gradient} flex items-center justify-center text-white font-bold p-1`}
          >
            {renderLucideIcon()}
          </div>
        )}
      </div>
    );
  }

  // Illustrated Circle Badge
  if (variant === 'badge') {
    return (
      <div className="inline-flex items-center gap-2 select-none">
        <div
          className={`relative w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-sm flex items-center justify-center bg-gradient-to-tr ${illustrationConfig.gradient}`}
        >
          {!imageError ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={activeImageUrl}
              alt={def.name}
              referrerPolicy="no-referrer"
              loading="lazy"
              onError={() => setImageError(true)}
              className="w-full h-full object-cover opacity-90 hover:scale-110 transition-transform duration-300"
            />
          ) : (
            <span className="text-white drop-shadow-sm">{renderLucideIcon()}</span>
          )}
          <div className="absolute inset-0 bg-black/10 backdrop-blur-[0.5px]" />
          <span className="absolute inset-0 flex items-center justify-center text-white drop-shadow-md">
            {renderLucideIcon()}
          </span>
        </div>
        {showBadgeText && (
          <span className={`text-xs font-semibold ${illustrationConfig.textColor}`}>
            {def.name}
          </span>
        )}
      </div>
    );
  }

  // Full Rich Category Card
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer p-3.5 flex flex-col justify-between ${className}`}
    >
      <div
        className={`absolute inset-0 bg-gradient-to-br ${illustrationConfig.gradient} opacity-5 group-hover:opacity-10 transition-opacity`}
      />
      <div className="relative flex items-center justify-between mb-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center border ${illustrationConfig.badgeBg} shadow-xs group-hover:scale-105 transition-transform`}
        >
          {renderLucideIcon()}
        </div>
        <span className="text-lg">{illustrationConfig.emoji}</span>
      </div>
      <div className="relative">
        <h4 className="text-sm font-bold text-slate-900 group-hover:text-[#003B8E] transition-colors line-clamp-1">
          {def.name}
        </h4>
        <p className="text-[11px] font-medium text-slate-500 mt-0.5">
          Browse items & stores
        </p>
      </div>
    </div>
  );
}
