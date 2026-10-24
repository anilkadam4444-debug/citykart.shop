'use client';

import React from 'react';
import {
  ShoppingBasket,
  Apple,
  Shirt,
  Headphones,
  HeartPulse,
  Croissant,
  UtensilsCrossed,
  Lamp,
  Wrench,
  Sparkles,
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
}

export function CategoryIcon({
  categoryIdOrName,
  className = 'w-3.5 h-3.5',
}: CategoryIconProps) {
  const def = getCategoryByIdOrName(categoryIdOrName);

  switch (def.iconName) {
    case 'ShoppingBasket':
      return <ShoppingBasket className={className} />;
    case 'Apple':
      return <Apple className={className} />;
    case 'Shirt':
      return <Shirt className={className} />;
    case 'Headphones':
      return <Headphones className={className} />;
    case 'HeartPulse':
      return <HeartPulse className={className} />;
    case 'Croissant':
      return <Croissant className={className} />;
    case 'UtensilsCrossed':
      return <UtensilsCrossed className={className} />;
    case 'Lamp':
      return <Lamp className={className} />;
    case 'Wrench':
      return <Wrench className={className} />;
    case 'Sparkles':
      return <Sparkles className={className} />;
    case 'Briefcase':
      return <Briefcase className={className} />;
    case 'BookOpen':
      return <BookOpen className={className} />;
    case 'Blocks':
      return <Blocks className={className} />;
    case 'Watch':
      return <Watch className={className} />;
    case 'Car':
      return <Car className={className} />;
    case 'PawPrint':
      return <PawPrint className={className} />;
    case 'Dumbbell':
      return <Dumbbell className={className} />;
    case 'Coffee':
      return <Coffee className={className} />;
    case 'Gift':
      return <Gift className={className} />;
    case 'Scissors':
      return <Scissors className={className} />;
    case 'Sprout':
      return <Sprout className={className} />;
    case 'SprayCan':
      return <SprayCan className={className} />;
    case 'Palette':
      return <Palette className={className} />;
    case 'PartyPopper':
      return <PartyPopper className={className} />;
    default:
      return <Store className={className} />;
  }
}
