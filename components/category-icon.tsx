'use client';

import React from 'react';
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
import {getCategoryByIdOrName} from '@/lib/catalog-data';

interface CategoryIconProps {
  categoryIdOrName: string;
  className?: string;
  strokeWidth?: number;
}

export function CategoryIcon({
  categoryIdOrName,
  className = 'w-3.5 h-3.5',
  strokeWidth = 1.9,
}: CategoryIconProps) {
  const def = getCategoryByIdOrName(categoryIdOrName);

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
}

