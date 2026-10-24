'use client';

import React, {useState} from 'react';
import {ArtworkPreset} from '@/lib/catalog-data';

interface ProductStudioArtworkProps {
  preset: ArtworkPreset;
  customImageUrl?: string;
  alt: string;
  className?: string;
  viewAngle?: 'front' | 'scale' | 'detail';
}

export function ProductStudioArtwork({
  preset,
  customImageUrl,
  alt,
  className = '',
  viewAngle = 'front',
}: ProductStudioArtworkProps) {
  const [imgError, setImgError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  if (customImageUrl && !imgError) {
    return (
      <div className={`relative overflow-hidden bg-[#F3EFEA] ${className}`}>
        {/* Subtle shimmer skeleton while image is loading */}
        {!isLoaded && (
          <div className="absolute inset-0 bg-stone-200/60 animate-pulse" />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={customImageUrl}
          alt={alt}
          referrerPolicy="no-referrer"
          loading="lazy"
          onLoad={() => setIsLoaded(true)}
          onError={() => setImgError(true)}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </div>
    );
  }

  const scaleTransform =
    viewAngle === 'detail'
      ? 'scale-125 translate-y-2'
      : viewAngle === 'scale'
        ? 'scale-90'
        : 'scale-100';

  return (
    <div
      className={`relative overflow-hidden select-none bg-[#EFECE6] flex items-center justify-center ${className}`}
      role="img"
      aria-label={alt}
    >
      {/* Studio Travertine Plinth & Directional Sunlight Backdrop */}
      <svg
        viewBox="0 0 480 360"
        className={`w-full h-full object-cover transition-transform duration-200 ease-out ${scaleTransform}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="bgWall" x1="0" y1="0" x2="480" y2="360" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F5F3EE" />
            <stop offset="65%" stopColor="#EAE5DC" />
            <stop offset="100%" stopColor="#DFD9CE" />
          </linearGradient>
          <linearGradient id="sunBeam" x1="60" y1="0" x2="380" y2="320" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="plinthTop" x1="100" y1="265" x2="380" y2="295" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#E6E1D7" />
            <stop offset="100%" stopColor="#D5CEC2" />
          </linearGradient>
          <linearGradient id="plinthSide" x1="100" y1="285" x2="380" y2="335" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#C9C1B4" />
            <stop offset="100%" stopColor="#B8AFA0" />
          </linearGradient>
          <linearGradient id="brassGrad" x1="160" y1="70" x2="320" y2="270" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#E8D29C" />
            <stop offset="35%" stopColor="#C8A253" />
            <stop offset="70%" stopColor="#9A762B" />
            <stop offset="100%" stopColor="#6D5119" />
          </linearGradient>
          <linearGradient id="steelGrad" x1="150" y1="70" x2="330" y2="270" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F4F5F6" />
            <stop offset="45%" stopColor="#BFC4C9" />
            <stop offset="80%" stopColor="#7C8288" />
            <stop offset="100%" stopColor="#4A4E54" />
          </linearGradient>
          <linearGradient id="amberGlass" x1="190" y1="95" x2="290" y2="270" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#CA7B29" />
            <stop offset="45%" stopColor="#8F470C" />
            <stop offset="85%" stopColor="#4F2304" />
            <stop offset="100%" stopColor="#2C1102" />
          </linearGradient>
          <linearGradient id="ceramicGrad" x1="160" y1="90" x2="310" y2="270" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FAF8F5" />
            <stop offset="60%" stopColor="#E5DFD3" />
            <stop offset="100%" stopColor="#C4B9A7" />
          </linearGradient>
          <linearGradient id="leatherGrad" x1="150" y1="90" x2="330" y2="275" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#6B4226" />
            <stop offset="55%" stopColor="#472814" />
            <stop offset="100%" stopColor="#281408" />
          </linearGradient>
          <radialGradient id="floorShadow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#2B2620" stopOpacity="0.32" />
            <stop offset="70%" stopColor="#2B2620" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#2B2620" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Studio Wall & Diagonal Natural Window Light */}
        <rect width="480" height="360" fill="url(#bgWall)" />
        <polygon points="0,0 310,0 480,290 140,360 0,240" fill="url(#sunBeam)" />

        {/* Architectural Horizon Line */}
        <line x1="0" y1="278" x2="480" y2="278" stroke="#D2C9B8" strokeWidth="1" />

        {/* Travertine Pedestal Slab */}
        <polygon points="94,278 386,278 416,304 64,304" fill="url(#plinthTop)" />
        <rect x="64" y="304" width="352" height="28" fill="url(#plinthSide)" />
        <ellipse cx="248" cy="288" rx="95" ry="13" fill="url(#floorShadow)" />

        {/* Scale Calibration Overlay when viewAngle === 'scale' */}
        {viewAngle === 'scale' && (
          <g stroke="#78716C" strokeWidth="1" strokeDasharray="3 3" opacity="0.75">
            <line x1="115" y1="75" x2="115" y2="285" />
            <line x1="109" y1="75" x2="121" y2="75" strokeDasharray="none" />
            <line x1="109" y1="285" x2="121" y2="285" strokeDasharray="none" />
            <line x1="145" y1="318" x2="335" y2="318" />
          </g>
        )}

        {/* Preset 1: Tadao Brushed Brass Table Lamp */}
        {preset === 'brass_lamp' && (
          <g>
            {/* Warm light cone cast underneath dome */}
            <polygon
              points="155,152 325,152 365,286 115,286"
              fill="#FDE68A"
              opacity="0.22"
            />
            {/* Cylindrical Brass Base */}
            <rect x="210" y="155" width="60" height="130" rx="4" fill="url(#brassGrad)" />
            <ellipse cx="240" cy="285" rx="30" ry="6" fill="#6D5119" />
            {/* Rotary Dimmer Dial */}
            <rect x="268" y="242" width="12" height="8" rx="2" fill="#523B10" />
            {/* Spun Brass Dome Shade */}
            <path
              d="M142 156 C142 92, 338 92, 338 156 Z"
              fill="url(#brassGrad)"
            />
            <ellipse cx="240" cy="156" rx="98" ry="10" fill="#FDF8EE" opacity="0.85" />
            {/* Top Finial */}
            <rect x="234" y="88" width="12" height="14" rx="3" fill="#9A762B" />
          </g>
        )}

        {/* Preset 2: Monolith Manual Lever Espresso Press */}
        {preset === 'espresso_machine' && (
          <g>
            {/* Heavy Stainless Base */}
            <rect x="172" y="268" width="136" height="20" rx="4" fill="url(#steelGrad)" />
            {/* Rear Column */}
            <rect x="256" y="96" width="26" height="174" rx="3" fill="url(#steelGrad)" />
            {/* Grouphead Cylinder */}
            <rect x="196" y="124" width="64" height="72" rx="6" fill="url(#steelGrad)" />
            {/* Pressure Gauge */}
            <circle cx="228" cy="104" r="18" fill="#1C1917" stroke="url(#brassGrad)" strokeWidth="4" />
            <circle cx="228" cy="104" r="13" fill="#FAF8F5" />
            <line x1="228" y1="104" x2="237" y2="96" stroke="#B91C1C" strokeWidth="2" />
            {/* Walnut Manual Extraction Lever Arm */}
            <line x1="228" y1="132" x2="132" y2="78" stroke="#7C8288" strokeWidth="7" strokeLinecap="round" />
            <line x1="158" y1="93" x2="122" y2="72" stroke="#472814" strokeWidth="12" strokeLinecap="round" />
            {/* Portafilter & Ceramic Espresso Cup */}
            <rect x="208" y="196" width="40" height="14" rx="2" fill="#4A4E54" />
            <line x1="248" y1="203" x2="322" y2="203" stroke="#472814" strokeWidth="9" strokeLinecap="round" />
            <path d="M210 238 L246 238 L242 268 L214 268 Z" fill="url(#ceramicGrad)" />
          </g>
        )}

        {/* Preset 3: Hinoki & Vetiver Barrier Repair Serum */}
        {preset === 'hinoki_serum' && (
          <g>
            {/* Secondary Travertine Riser */}
            <rect x="178" y="258" width="124" height="26" rx="2" fill="#DCD5C7" />
            {/* Heavy Amber Apothecary Bottle */}
            <rect x="196" y="146" width="88" height="114" rx="14" fill="url(#amberGlass)" />
            {/* Inner Glass Refraction Highlight */}
            <rect x="204" y="156" width="8" height="94" rx="4" fill="#F59E0B" opacity="0.32" />
            {/* Bottle Neck & Matte Black Pipette Collar */}
            <rect x="224" y="126" width="32" height="22" rx="2" fill="#5C2B06" />
            <rect x="220" y="106" width="40" height="24" rx="3" fill="#1C1917" />
            {/* Rubber Dropper Bulb */}
            <path d="M227 106 C227 76, 253 76, 253 106 Z" fill="#292524" />
            {/* Minimalist Unbleached Paper Label */}
            <rect x="204" y="176" width="72" height="62" rx="1" fill="#F7F4ED" />
            <line x1="214" y1="192" x2="264" y2="192" stroke="#1C1917" strokeWidth="2.5" />
            <line x1="214" y1="204" x2="254" y2="204" stroke="#78716C" strokeWidth="1.5" />
            <line x1="214" y1="214" x2="260" y2="214" stroke="#78716C" strokeWidth="1.5" />
            <line x1="214" y1="226" x2="240" y2="226" stroke="#1C1917" strokeWidth="1.5" />
          </g>
        )}

        {/* Preset 4: Reference Field Monitor Headphones */}
        {preset === 'field_headphones' && (
          <g>
            {/* Brushed Aluminum Headband Arc */}
            <path
              d="M158 195 C158 76, 322 76, 322 195"
              stroke="#292524"
              strokeWidth="14"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M168 185 C168 92, 312 92, 312 185"
              stroke="url(#steelGrad)"
              strokeWidth="4"
              fill="none"
            />
            {/* CNC Yoke Rods */}
            <line x1="158" y1="175" x2="158" y2="240" stroke="url(#steelGrad)" strokeWidth="6" />
            <line x1="322" y1="175" x2="322" y2="240" stroke="url(#steelGrad)" strokeWidth="6" />
            {/* Left & Right Open-Back Planar Ear Cups */}
            <rect x="136" y="182" width="38" height="78" rx="18" fill="url(#steelGrad)" stroke="#1C1917" strokeWidth="3" />
            <rect x="170" y="186" width="18" height="70" rx="8" fill="#1C1917" />
            <rect x="306" y="182" width="38" height="78" rx="18" fill="url(#steelGrad)" stroke="#1C1917" strokeWidth="3" />
            <rect x="292" y="186" width="18" height="70" rx="8" fill="#1C1917" />
            {/* Acoustic Grill Slots */}
            <line x1="146" y1="202" x2="146" y2="240" stroke="#1C1917" strokeWidth="2" />
            <line x1="154" y1="198" x2="154" y2="244" stroke="#1C1917" strokeWidth="2" />
            <line x1="326" y1="198" x2="326" y2="244" stroke="#1C1917" strokeWidth="2" />
            <line x1="334" y1="202" x2="334" y2="240" stroke="#1C1917" strokeWidth="2" />
          </g>
        )}

        {/* Preset 5: First-Harvest Uji Ceremonial Matcha Tin */}
        {preset === 'matcha_ceremonial' && (
          <g>
            {/* Brushed Pewter Tea Canister */}
            <rect x="172" y="128" width="96" height="154" rx="10" fill="url(#steelGrad)" />
            {/* Double-Seam Lid */}
            <rect x="169" y="122" width="102" height="38" rx="6" fill="#D6D9DC" stroke="#9CA3AF" strokeWidth="1" />
            {/* Washi Paper Belly Band Label */}
            <rect x="172" y="176" width="96" height="68" fill="#FAF8F5" />
            <rect x="186" y="188" width="12" height="44" fill="#15803D" rx="1" />
            <line x1="208" y1="194" x2="252" y2="194" stroke="#1C1917" strokeWidth="2.5" />
            <line x1="208" y1="206" x2="244" y2="206" stroke="#78716C" strokeWidth="1.5" />
            <line x1="208" y1="218" x2="236" y2="218" stroke="#78716C" strokeWidth="1.5" />
            {/* Companion Ceramic Chawan Bowl with Matcha Crema */}
            <path d="M254 228 C254 276, 348 276, 348 228 Z" fill="#292524" />
            <ellipse cx="301" cy="228" rx="47" ry="11" fill="#166534" />
            <ellipse cx="301" cy="228" rx="41" ry="8" fill="#22C55E" opacity="0.65" />
          </g>
        )}

        {/* Preset 6: Kora Heavyweight Handloom Chore Jacket */}
        {preset === 'linen_jacket' && (
          <g>
            {/* Tailored Structured Shoulders & Torso */}
            <path
              d="M178 96 L212 86 L268 86 L302 96 L342 192 L310 204 L294 142 L294 282 L186 282 L186 142 L170 204 L138 192 Z"
              fill="url(#ceramicGrad)"
              stroke="#B8AFA0"
              strokeWidth="2"
            />
            {/* Collar Lapels */}
            <polygon points="212,86 240,124 196,118" fill="#DFD8C8" stroke="#B8AFA0" strokeWidth="1.5" />
            <polygon points="268,86 240,124 284,118" fill="#DFD8C8" stroke="#B8AFA0" strokeWidth="1.5" />
            {/* Center Placket & Corozo Nut Buttons */}
            <line x1="240" y1="124" x2="240" y2="282" stroke="#B8AFA0" strokeWidth="2" />
            <circle cx="240" cy="148" r="4.5" fill="#57534E" />
            <circle cx="240" cy="186" r="4.5" fill="#57534E" />
            <circle cx="240" cy="224" r="4.5" fill="#57534E" />
            <circle cx="240" cy="262" r="4.5" fill="#57534E" />
            {/* Gusseted Workwear Patch Pockets */}
            <rect x="196" y="212" width="32" height="38" rx="2" fill="#E5DFD3" stroke="#A8A29E" strokeWidth="1.5" />
            <rect x="252" y="212" width="32" height="38" rx="2" fill="#E5DFD3" stroke="#A8A29E" strokeWidth="1.5" />
            <rect x="252" y="142" width="28" height="32" rx="2" fill="#E5DFD3" stroke="#A8A29E" strokeWidth="1.5" />
          </g>
        )}

        {/* Preset 7: Hasami Porcelain Ribbed Pour-Over Carafe */}
        {preset === 'ceramic_pourover' && (
          <g>
            {/* Lower Thermal Carafe Cylinder */}
            <path d="M188 184 L292 184 L302 284 L178 284 Z" fill="url(#ceramicGrad)" />
            {/* Walnut Heat Collar */}
            <rect x="186" y="182" width="108" height="24" rx="3" fill="url(#leatherGrad)" />
            {/* Upper Ribbed V60 Dripper Cone */}
            <polygon points="172,102 308,102 282,182 198,182" fill="url(#ceramicGrad)" stroke="#D6CFC2" strokeWidth="1.5" />
            {/* Architectural Vertical Ribs on Dripper */}
            <line x1="196" y1="104" x2="210" y2="180" stroke="#C4B9A7" strokeWidth="2" />
            <line x1="218" y1="104" x2="225" y2="180" stroke="#C4B9A7" strokeWidth="2" />
            <line x1="240" y1="104" x2="240" y2="180" stroke="#C4B9A7" strokeWidth="2" />
            <line x1="262" y1="104" x2="255" y2="180" stroke="#C4B9A7" strokeWidth="2" />
            <line x1="284" y1="104" x2="270" y2="180" stroke="#C4B9A7" strokeWidth="2" />
          </g>
        )}

        {/* Preset 8: Heritage Emmer Sourdough & Cultured Butter */}
        {preset === 'sourdough_kit' && (
          <g>
            {/* Hand-Carved Oak Bread Board */}
            <rect x="126" y="268" width="228" height="16" rx="4" fill="#8C5A32" />
            {/* Crusty Artisanal Sourdough Boule */}
            <path
              d="M142 268 C138 172, 296 168, 294 268 Z"
              fill="#B46528"
            />
            <path
              d="M156 268 C154 188, 282 184, 280 268 Z"
              fill="#924812"
            />
            {/* Flour Dusting & Lame Scoring Marks */}
            <path d="M178 214 Q218 192 256 218" stroke="#F5EFE6" strokeWidth="5" strokeLinecap="round" fill="none" />
            <path d="M188 232 Q222 214 248 236" stroke="#F5EFE6" strokeWidth="4" strokeLinecap="round" fill="none" />
            {/* Stoneware Cultured Butter Crock */}
            <rect x="282" y="226" width="62" height="42" rx="4" fill="url(#ceramicGrad)" />
            <ellipse cx="313" cy="226" rx="28" ry="8" fill="#FDE047" opacity="0.65" />
          </g>
        )}

        {/* Preset 9: Bridle Leather Architectural Market Tote */}
        {preset === 'leather_totebag' && (
          <g>
            {/* Bridle Leather Shoulder Straps */}
            <path
              d="M198 144 C198 68, 282 68, 282 144"
              stroke="#281408"
              strokeWidth="10"
              fill="none"
            />
            {/* Structured Box Tote Body */}
            <polygon points="154,136 326,136 336,284 144,284" fill="url(#leatherGrad)" />
            {/* Architectural Gusset Seam & Highlight */}
            <line x1="172" y1="136" x2="164" y2="284" stroke="#6B4226" strokeWidth="1.5" opacity="0.7" />
            <line x1="308" y1="136" x2="316" y2="284" stroke="#1C0D04" strokeWidth="2" />
            {/* Solid Sand-Cast Brass Rivets */}
            <circle cx="198" cy="154" r="4.5" fill="url(#brassGrad)" />
            <circle cx="282" cy="154" r="4.5" fill="url(#brassGrad)" />
            <circle cx="198" cy="170" r="4.5" fill="url(#brassGrad)" />
            <circle cx="282" cy="170" r="4.5" fill="url(#brassGrad)" />
            {/* Subtle Gold Foil Stamp Mark */}
            <line x1="224" y1="248" x2="256" y2="248" stroke="#E8D29C" strokeWidth="2" />
          </g>
        )}
      </svg>
    </div>
  );
}
