import {NextRequest, NextResponse} from 'next/server';

function escapeXml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getCategoryPalette(categoryId: string): {
  bgStart: string;
  bgEnd: string;
  accent: string;
  accentSoft: string;
  plinth: string;
  badgeBg: string;
} {
  if (categoryId.includes('01-grocery')) {
    return {
      bgStart: '#FBF7EE',
      bgEnd: '#EFE4CE',
      accent: '#92400E',
      accentSoft: '#FDE68A',
      plinth: '#E3D5BC',
      badgeBg: '#78350F',
    };
  }
  if (categoryId.includes('02-fruits')) {
    return {
      bgStart: '#F4FBF2',
      bgEnd: '#DCEFD6',
      accent: '#15803D',
      accentSoft: '#BBF7D0',
      plinth: '#CBE3C4',
      badgeBg: '#14532D',
    };
  }
  if (categoryId.includes('03-fashion') || categoryId.includes('20-fabrics')) {
    return {
      bgStart: '#F7F5FB',
      bgEnd: '#E7E1F3',
      accent: '#4338CA',
      accentSoft: '#C7D2FE',
      plinth: '#D9D1E9',
      badgeBg: '#312E81',
    };
  }
  if (categoryId.includes('04-electronics') || categoryId.includes('15-automotive')) {
    return {
      bgStart: '#F3F6FA',
      bgEnd: '#DEE6F0',
      accent: '#1E40AF',
      accentSoft: '#BFDBFE',
      plinth: '#CFD9E6',
      badgeBg: '#1E3A8A',
    };
  }
  if (categoryId.includes('05-pharmacy') || categoryId.includes('22-household')) {
    return {
      bgStart: '#F1FAF9',
      bgEnd: '#D6EFEA',
      accent: '#0F766E',
      accentSoft: '#99F6E4',
      plinth: '#C3E4DF',
      badgeBg: '#134E4A',
    };
  }
  if (categoryId.includes('06-bakery') || categoryId.includes('07-restaurants')) {
    return {
      bgStart: '#FDF6F0',
      bgEnd: '#F4E1D0',
      accent: '#B45309',
      accentSoft: '#FCD34D',
      plinth: '#E8CFB8',
      badgeBg: '#7C2D12',
    };
  }
  if (categoryId.includes('08-furniture') || categoryId.includes('23-handicrafts')) {
    return {
      bgStart: '#FAF6F1',
      bgEnd: '#EAE0D3',
      accent: '#78350F',
      accentSoft: '#FDE68A',
      plinth: '#DDD0BF',
      badgeBg: '#451A03',
    };
  }
  if (categoryId.includes('09-hardware') || categoryId.includes('18-home-kitchen')) {
    return {
      bgStart: '#F6F7F8',
      bgEnd: '#E2E5E9',
      accent: '#374151',
      accentSoft: '#D1D5DB',
      plinth: '#D2D6DC',
      badgeBg: '#1F2937',
    };
  }
  if (categoryId.includes('10-beauty') || categoryId.includes('19-gifts') || categoryId.includes('24-party')) {
    return {
      bgStart: '#FDF4F7',
      bgEnd: '#F3DCE4',
      accent: '#BE185D',
      accentSoft: '#FBCFE8',
      plinth: '#E8C9D4',
      badgeBg: '#831843',
    };
  }
  if (categoryId.includes('21-agriculture')) {
    return {
      bgStart: '#F3FAF2',
      bgEnd: '#DAEBD7',
      accent: '#166534',
      accentSoft: '#86EFAC',
      plinth: '#C8DEC4',
      badgeBg: '#14532D',
    };
  }
  return {
    bgStart: '#FAF8F5',
    bgEnd: '#EAE4DA',
    accent: '#44403C',
    accentSoft: '#E7E5E4',
    plinth: '#DCD4C6',
    badgeBg: '#1C1917',
  };
}

function renderProductSubjectSvg(key: string, categoryId: string): string {
  // 1. Grocery: Basmati Rice / Dal / Cooking Oil
  if (key === 'basmati_rice' || key === 'toor_dal' || key === 'cooking_oil') {
    if (key === 'cooking_oil') {
      return `
        <g>
          <rect x="210" y="105" width="120" height="175" rx="22" fill="#F59E0B" stroke="#B45309" stroke-width="3"/>
          <rect x="248" y="76" width="44" height="30" rx="6" fill="#D97706"/>
          <rect x="254" y="62" width="32" height="16" rx="4" fill="#15803D"/>
          <path d="M330 130 C362 130, 362 205, 330 205" stroke="#F59E0B" stroke-width="14" fill="none" stroke-linecap="round"/>
          <rect x="224" y="152" width="92" height="84" rx="8" fill="#FFFBEB" stroke="#FCD34D" stroke-width="2"/>
          <circle cx="270" cy="184" r="16" fill="#F59E0B"/>
          <text x="270" y="222" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="700" fill="#78350F">PURE OIL 1L</text>
        </g>
      `;
    }
    const isDal = key === 'toor_dal';
    const grainColor = isDal ? '#F59E0B' : '#FFFBEB';
    const bagColor = isDal ? '#D97706' : '#C29B61';
    const labelText = isDal ? 'TOOR DAL 1KG' : 'BASMATI RICE 1KG';
    return `
      <g>
        <!-- Woven Burlap / Cotton Provision Sack -->
        <path d="M168 112 L292 112 L306 278 L154 278 Z" fill="${bagColor}" stroke="#854D0E" stroke-width="2.5"/>
        <path d="M174 112 Q230 92 286 112" fill="#A16207"/>
        <rect x="182" y="150" width="96" height="86" rx="6" fill="#FAF8F5" stroke="#78350F" stroke-width="1.5"/>
        <text x="230" y="184" text-anchor="middle" font-family="sans-serif" font-size="10" font-weight="800" fill="#78350F">NANDED FRESH</text>
        <text x="230" y="204" text-anchor="middle" font-family="sans-serif" font-size="9.5" font-weight="700" fill="#1C1917">${labelText}</text>
        <line x1="196" y1="218" x2="264" y2="218" stroke="#D6D3D1" stroke-width="2"/>
        <!-- Ceramic Bowl of Rice / Dal in Front -->
        <ellipse cx="332" cy="242" rx="64" ry="26" fill="${grainColor}" stroke="#D6D3D1" stroke-width="2"/>
        <path d="M268 242 C268 292, 396 292, 396 242 Z" fill="#44403C"/>
        <ellipse cx="318" cy="238" rx="6" ry="2.2" fill="#FFFFFF" opacity="0.85"/>
        <ellipse cx="338" cy="234" rx="6" ry="2.2" fill="#FFFFFF" opacity="0.85"/>
        <ellipse cx="348" cy="242" rx="6" ry="2.2" fill="#FFFFFF" opacity="0.85"/>
        <ellipse cx="326" cy="245" rx="6" ry="2.2" fill="#FFFFFF" opacity="0.85"/>
      </g>
    `;
  }

  // 2. Fruits & Vegetables: Alphonso Mangoes / Pomegranates / Vegetable Basket
  if (
    key === 'alphonso_mangoes' ||
    key === 'pomegranates' ||
    key === 'vegetable_basket'
  ) {
    if (key === 'pomegranates') {
      return `
        <g>
          <circle cx="225" cy="215" r="56" fill="#BE123C" stroke="#881337" stroke-width="3"/>
          <polygon points="215,159 225,144 235,159" fill="#9F1239"/>
          <circle cx="315" cy="222" r="52" fill="#E11D48" stroke="#881337" stroke-width="3"/>
          <circle cx="315" cy="228" r="36" fill="#FFF1F2"/>
          <circle cx="305" cy="218" r="5" fill="#9F1239"/>
          <circle cx="320" cy="216" r="5" fill="#9F1239"/>
          <circle cx="312" cy="230" r="5" fill="#9F1239"/>
          <circle cx="326" cy="232" r="5" fill="#9F1239"/>
          <circle cx="302" cy="234" r="5" fill="#9F1239"/>
        </g>
      `;
    }
    if (key === 'vegetable_basket') {
      return `
        <g>
          <!-- Leafy Greens -->
          <circle cx="215" cy="175" r="38" fill="#15803D"/>
          <circle cx="255" cy="168" r="42" fill="#16A34A"/>
          <!-- Red Tomatoes & Onion -->
          <circle cx="295" cy="192" r="30" fill="#DC2626"/>
          <circle cx="235" cy="202" r="28" fill="#9333EA"/>
          <ellipse cx="332" cy="202" rx="32" ry="24" fill="#D97706"/>
          <!-- Woven Wicker Basket -->
          <polygon points="156,208 384,208 358,282 182,282" fill="#B45309" stroke="#78350F" stroke-width="3"/>
          <line x1="168" y1="232" x2="372" y2="232" stroke="#78350F" stroke-width="2"/>
          <line x1="175" y1="256" x2="365" y2="256" stroke="#78350F" stroke-width="2"/>
        </g>
      `;
    }
    // Alphonso Mangoes
    return `
      <g>
        <!-- Orchard Leaf -->
        <path d="M235 128 C275 95, 345 108, 358 148 C312 162, 265 152, 235 128 Z" fill="#15803D"/>
        <!-- Mango 1 -->
        <path d="M168 205 C158 142, 252 126, 276 184 C294 228, 258 276, 212 272 C180 268, 172 238, 168 205 Z" fill="#F59E0B" stroke="#D97706" stroke-width="2.5"/>
        <ellipse cx="204" cy="178" rx="22" ry="12" fill="#FDE047" opacity="0.65"/>
        <!-- Mango 2 -->
        <path d="M254 212 C248 152, 338 138, 362 194 C378 235, 344 280, 298 276 C268 272, 258 244, 254 212 Z" fill="#FBBF24" stroke="#D97706" stroke-width="2.5"/>
        <ellipse cx="295" cy="186" rx="20" ry="11" fill="#FEF08A" opacity="0.7"/>
      </g>
    `;
  }

  // 3. Fashion & Clothing / 20. Fabrics
  if (
    key === 'cotton_shirt' ||
    key === 'cotton_kurta' ||
    key === 'denim_jeans' ||
    key === 'cotton_fabric' ||
    key === 'tailoring_kit' ||
    key === 'blouse_fabric'
  ) {
    if (key === 'cotton_fabric' || key === 'blouse_fabric' || key === 'tailoring_kit') {
      const clothColor = key === 'blouse_fabric' ? '#BE185D' : '#3730A3';
      return `
        <g>
          <!-- Folded Fabric Bolts -->
          <rect x="158" y="218" width="210" height="52" rx="12" fill="${clothColor}" stroke="#1E1B4B" stroke-width="2"/>
          <rect x="172" y="172" width="196" height="48" rx="12" fill="#0284C7" stroke="#075985" stroke-width="2"/>
          <rect x="188" y="128" width="180" height="46" rx="12" fill="#D97706" stroke="#92400E" stroke-width="2"/>
          <!-- Gold Zari Border Strip -->
          <rect x="158" y="236" width="210" height="10" fill="#FDE047" opacity="0.85"/>
          <rect x="188" y="144" width="180" height="8" fill="#FEF08A" opacity="0.85"/>
        </g>
      `;
    }
    if (key === 'denim_jeans') {
      return `
        <g>
          <path d="M204 96 L336 96 L352 280 L286 280 L270 168 L254 280 L188 280 Z" fill="#1E3A8A" stroke="#172554" stroke-width="3"/>
          <line x1="204" y1="114" x2="336" y2="114" stroke="#F59E0B" stroke-width="2" stroke-dasharray="4 3"/>
          <circle cx="270" cy="105" r="4.5" fill="#D97706"/>
        </g>
      `;
    }
    const shirtFill = key === 'cotton_kurta' ? '#0F766E' : '#2563EB';
    const shirtStroke = key === 'cotton_kurta' ? '#115E59' : '#1D4ED8';
    return `
      <g>
        <path d="M188 94 L232 82 L308 82 L352 94 L394 184 L354 202 L334 140 L334 280 L206 280 L206 140 L186 202 L146 184 Z" fill="${shirtFill}" stroke="${shirtStroke}" stroke-width="2.5"/>
        <polygon points="232,82 270,122 216,114" fill="#EFF6FF" stroke="${shirtStroke}" stroke-width="2"/>
        <polygon points="308,82 270,122 324,114" fill="#EFF6FF" stroke="${shirtStroke}" stroke-width="2"/>
        <line x1="270" y1="122" x2="270" y2="280" stroke="#DBEAFE" stroke-width="3"/>
        <rect x="288" y="148" width="32" height="36" rx="3" fill="none" stroke="#BFDBFE" stroke-width="2"/>
        <circle cx="270" cy="148" r="3.5" fill="#FFFFFF"/>
        <circle cx="270" cy="182" r="3.5" fill="#FFFFFF"/>
        <circle cx="270" cy="216" r="3.5" fill="#FFFFFF"/>
        <circle cx="270" cy="250" r="3.5" fill="#FFFFFF"/>
      </g>
    `;
  }

  // 4. Electronics & Mobile Accessories
  if (key === 'usbc_cable' || key === 'wall_charger' || key === 'power_bank') {
    if (key === 'wall_charger') {
      return `
        <g>
          <rect x="226" y="76" width="10" height="38" rx="4" fill="#64748B"/>
          <rect x="304" y="76" width="10" height="38" rx="4" fill="#64748B"/>
          <rect x="196" y="112" width="148" height="158" rx="22" fill="#FFFFFF" stroke="#94A3B8" stroke-width="3"/>
          <rect x="252" y="182" width="36" height="12" rx="6" fill="#0F172A"/>
          <text x="270" y="160" text-anchor="middle" font-family="sans-serif" font-size="14" font-weight="800" fill="#1E293B">20W PD FAST</text>
        </g>
      `;
    }
    if (key === 'power_bank') {
      return `
        <g>
          <rect x="198" y="88" width="144" height="190" rx="18" fill="#1E293B" stroke="#0F172A" stroke-width="3"/>
          <circle cx="270" cy="136" r="22" fill="#0F172A" stroke="#38BDF8" stroke-width="2.5"/>
          <text x="270" y="141" text-anchor="middle" font-family="monospace" font-size="12" font-weight="700" fill="#38BDF8">100%</text>
          <text x="270" y="232" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="700" fill="#94A3B8">10000 mAh</text>
        </g>
      `;
    }
    // USB-C Fast Charging Cable
    return `
      <g>
        <ellipse cx="270" cy="196" rx="92" ry="62" fill="none" stroke="#1E293B" stroke-width="14"/>
        <ellipse cx="270" cy="196" rx="74" ry="48" fill="none" stroke="#334155" stroke-width="10" stroke-dasharray="6 4"/>
        <!-- Left & Right USB-C Connector Heads -->
        <rect x="172" y="102" width="32" height="52" rx="6" fill="#475569" stroke="#0F172A" stroke-width="2.5"/>
        <rect x="180" y="80" width="16" height="22" rx="3" fill="#CBD5E1" stroke="#475569" stroke-width="2"/>
        <rect x="336" y="102" width="32" height="52" rx="6" fill="#475569" stroke="#0F172A" stroke-width="2.5"/>
        <rect x="344" y="80" width="16" height="22" rx="3" fill="#CBD5E1" stroke="#475569" stroke-width="2"/>
        <text x="188" y="133" text-anchor="middle" font-family="sans-serif" font-size="9" font-weight="800" fill="#38BDF8">60W</text>
        <text x="352" y="133" text-anchor="middle" font-family="sans-serif" font-size="9" font-weight="800" fill="#38BDF8">PD</text>
      </g>
    `;
  }

  // 5. Pharmacy & Healthcare Products
  if (
    key === 'digital_thermometer' ||
    key === 'first_aid_kit' ||
    key === 'hot_water_bag'
  ) {
    if (key === 'first_aid_kit') {
      return `
        <g>
          <rect x="166" y="120" width="208" height="152" rx="16" fill="#FFFFFF" stroke="#0F766E" stroke-width="4"/>
          <path d="M234 120 L234 96 L306 96 L306 120" fill="none" stroke="#0F766E" stroke-width="8" stroke-linecap="round"/>
          <rect x="256" y="156" width="28" height="80" rx="4" fill="#DC2626"/>
          <rect x="230" y="182" width="80" height="28" rx="4" fill="#DC2626"/>
        </g>
      `;
    }
    if (key === 'hot_water_bag') {
      return `
        <g>
          <rect x="206" y="118" width="128" height="158" rx="26" fill="#E11D48" stroke="#9F1239" stroke-width="3"/>
          <rect x="248" y="84" width="44" height="36" rx="6" fill="#BE123C"/>
          <line x1="224" y1="150" x2="316" y2="150" stroke="#FDA4AF" stroke-width="3"/>
          <line x1="224" y1="176" x2="316" y2="176" stroke="#FDA4AF" stroke-width="3"/>
          <line x1="224" y1="202" x2="316" y2="202" stroke="#FDA4AF" stroke-width="3"/>
          <line x1="224" y1="228" x2="316" y2="228" stroke="#FDA4AF" stroke-width="3"/>
        </g>
      `;
    }
    // Digital Thermometer
    return `
      <g transform="rotate(-24 270 185)">
        <rect x="115" y="162" width="290" height="46" rx="23" fill="#FFFFFF" stroke="#0D9488" stroke-width="3.5"/>
        <path d="M402 174 L438 180 L438 190 L402 196 Z" fill="#94A3B8" stroke="#475569" stroke-width="2"/>
        <rect x="145" y="170" width="90" height="30" rx="6" fill="#0F766E"/>
        <rect x="248" y="170" width="92" height="30" rx="5" fill="#CCFBF1" stroke="#0F766E" stroke-width="2"/>
        <text x="294" y="191" text-anchor="middle" font-family="monospace" font-size="16" font-weight="800" fill="#134E4A">98.6°F</text>
        <circle cx="364" cy="185" r="8" fill="#0D9488"/>
      </g>
    `;
  }

  // 6. Bakery, Sweets & Desserts
  if (
    key === 'assorted_pastries' ||
    key === 'kaju_katli' ||
    key === 'bakery_biscuits'
  ) {
    return `
      <g>
        <!-- Ceramic Bakery Platter -->
        <ellipse cx="270" cy="264" rx="134" ry="22" fill="#FFFFFF" stroke="#D6D3D1" stroke-width="3"/>
        <!-- Layered Chocolate & Berry Pastry Slice 1 -->
        <polygon points="168,184 256,154 256,254 168,254" fill="#78350F"/>
        <rect x="168" y="198" width="88" height="12" fill="#FEF3C7"/>
        <rect x="168" y="226" width="88" height="12" fill="#FDE68A"/>
        <circle cx="212" cy="158" r="12" fill="#E11D48"/>
        <!-- Pineapple / Cream Pastry Slice 2 -->
        <polygon points="274,162 368,184 368,254 274,254" fill="#FDE047" stroke="#CA8A04" stroke-width="2"/>
        <rect x="274" y="204" width="94" height="14" fill="#FFFFFF"/>
        <circle cx="320" cy="164" r="11" fill="#F59E0B"/>
      </g>
    `;
  }

  // 7. Restaurants & Food: Veg Thali / Paneer / Khichdi
  if (key === 'veg_thali' || key === 'paneer_combo' || key === 'dal_khichdi') {
    return `
      <g>
        <!-- Stainless Steel Round Thali Platter -->
        <circle cx="270" cy="188" r="98" fill="#E2E8F0" stroke="#64748B" stroke-width="5"/>
        <circle cx="270" cy="188" r="88" fill="#F8FAFC" stroke="#94A3B8" stroke-width="1.5"/>
        <!-- Katori 1: Dal Tadka -->
        <circle cx="218" cy="142" r="24" fill="#F59E0B" stroke="#475569" stroke-width="3"/>
        <!-- Katori 2: Paneer Masala -->
        <circle cx="270" cy="126" r="24" fill="#EA580C" stroke="#475569" stroke-width="3"/>
        <!-- Katori 3: Seasonal Veg -->
        <circle cx="322" cy="142" r="24" fill="#16A34A" stroke="#475569" stroke-width="3"/>
        <!-- Steamed Jeera Rice Mound -->
        <ellipse cx="228" cy="218" rx="34" ry="26" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="2"/>
        <!-- Wheat Rotis / Phulkas -->
        <circle cx="308" cy="214" r="32" fill="#D97706" stroke="#92400E" stroke-width="2"/>
        <circle cx="318" cy="222" r="28" fill="#F59E0B" stroke="#B45309" stroke-width="1.5"/>
      </g>
    `;
  }

  // 8. Furniture & Home Decor
  if (
    key === 'wooden_coffee_table' ||
    key === 'table_lamp' ||
    key === 'cotton_rug'
  ) {
    return `
      <g>
        <!-- Solid Wood Coffee Table Top -->
        <polygon points="132,162 408,162 376,204 164,204" fill="#B45309" stroke="#78350F" stroke-width="3"/>
        <rect x="132" y="162" width="276" height="14" rx="3" fill="#92400E"/>
        <!-- Table Legs -->
        <rect x="158" y="196" width="16" height="84" rx="3" fill="#78350F"/>
        <rect x="366" y="196" width="16" height="84" rx="3" fill="#78350F"/>
        <rect x="192" y="204" width="12" height="62" rx="2" fill="#451A03"/>
        <rect x="336" y="204" width="12" height="62" rx="2" fill="#451A03"/>
        <!-- Lower Magazine Shelf -->
        <rect x="168" y="238" width="204" height="10" rx="2" fill="#92400E"/>
      </g>
    `;
  }

  // 9. Hardware, Electricals & Plumbing
  if (
    key === 'pipe_wrench' ||
    key === 'led_bulbs' ||
    key === 'screwdriver_kit'
  ) {
    return `
      <g transform="rotate(-28 270 185)">
        <!-- Forged Steel Pipe Wrench Handle -->
        <rect x="120" y="172" width="220" height="28" rx="6" fill="#DC2626" stroke="#991B1B" stroke-width="2.5"/>
        <!-- Upper & Lower Hardened Jaws -->
        <path d="M335 148 L412 148 L412 178 L362 178 L362 212 L335 212 Z" fill="#64748B" stroke="#1E293B" stroke-width="3"/>
        <rect x="352" y="186" width="52" height="22" rx="3" fill="#475569" stroke="#1E293B" stroke-width="2.5"/>
        <!-- Knurled Adjustment Nut -->
        <rect x="322" y="164" width="20" height="44" rx="4" fill="#94A3B8" stroke="#334155" stroke-width="2"/>
      </g>
    `;
  }

  // 10. Beauty & Personal Care
  if (key === 'aloe_face_wash' || key === 'hair_oil' || key === 'bath_soap') {
    return `
      <g>
        <!-- Squeeze Tube / Bottle -->
        <polygon points="212,98 328,98 308,242 232,242" fill="#10B981" stroke="#047857" stroke-width="2.5"/>
        <rect x="236" y="242" width="68" height="32" rx="6" fill="#FFFFFF" stroke="#047857" stroke-width="2"/>
        <rect x="226" y="132" width="88" height="76" rx="8" fill="#ECFDF5"/>
        <text x="270" y="166" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="800" fill="#065F46">ALOE VERA</text>
        <text x="270" y="186" text-anchor="middle" font-family="sans-serif" font-size="9.5" font-weight="700" fill="#047857">FACE WASH</text>
      </g>
    `;
  }

  // 11. Footwear & Bags
  if (
    key === 'casual_sneakers' ||
    key === 'laptop_backpack' ||
    key === 'walking_sandals'
  ) {
    return `
      <g>
        <!-- Sneaker Outsole -->
        <path d="M138 242 L396 242 C406 242, 408 268, 392 268 L142 268 C130 268, 128 242, 138 242 Z" fill="#FFFFFF" stroke="#94A3B8" stroke-width="2.5"/>
        <!-- Sneaker Upper -->
        <path d="M144 242 L156 154 L236 154 L288 198 L378 206 C398 210, 398 242, 388 242 Z" fill="#1E3A8A" stroke="#172554" stroke-width="2.5"/>
        <!-- Accent Stripe & Laces -->
        <path d="M192 242 L248 188 L272 188 L224 242 Z" fill="#F8FAFC"/>
        <line x1="242" y1="166" x2="262" y2="156" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round"/>
        <line x1="258" y1="178" x2="278" y2="168" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round"/>
        <line x1="274" y1="190" x2="294" y2="180" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round"/>
      </g>
    `;
  }

  // 12. Books, Stationery & Office Supplies
  if (
    key === 'a4_notebook' ||
    key === 'gel_pen_set' ||
    key === 'desk_organizer'
  ) {
    return `
      <g>
        <!-- A4 Spiral Notebook Cover -->
        <rect x="192" y="86" width="148" height="190" rx="8" fill="#0284C7" stroke="#0369A1" stroke-width="3"/>
        <rect x="214" y="118" width="104" height="62" rx="6" fill="#FFFFFF"/>
        <text x="266" y="146" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="800" fill="#0F172A">A4 NOTEBOOK</text>
        <text x="266" y="166" text-anchor="middle" font-family="sans-serif" font-size="10" font-weight="600" fill="#475569">200 PAGES · RULED</text>
        <!-- Spiral Binding Rings -->
        <circle cx="192" cy="108" r="6" fill="#CBD5E1" stroke="#334155" stroke-width="2"/>
        <circle cx="192" cy="136" r="6" fill="#CBD5E1" stroke="#334155" stroke-width="2"/>
        <circle cx="192" cy="164" r="6" fill="#CBD5E1" stroke="#334155" stroke-width="2"/>
        <circle cx="192" cy="192" r="6" fill="#CBD5E1" stroke="#334155" stroke-width="2"/>
        <circle cx="192" cy="220" r="6" fill="#CBD5E1" stroke="#334155" stroke-width="2"/>
        <circle cx="192" cy="248" r="6" fill="#CBD5E1" stroke="#334155" stroke-width="2"/>
      </g>
    `;
  }

  // 13. Toys, Games & Baby Products
  if (
    key === 'building_blocks' ||
    key === 'chess_board' ||
    key === 'baby_swaddle'
  ) {
    return `
      <g>
        <!-- Red Block -->
        <rect x="164" y="204" width="96" height="66" rx="6" fill="#EF4444" stroke="#B91C1C" stroke-width="2.5"/>
        <rect x="178" y="192" width="24" height="12" rx="3" fill="#EF4444" stroke="#B91C1C" stroke-width="2"/>
        <rect x="222" y="192" width="24" height="12" rx="3" fill="#EF4444" stroke="#B91C1C" stroke-width="2"/>
        <!-- Blue Block -->
        <rect x="268" y="204" width="96" height="66" rx="6" fill="#3B82F6" stroke="#1D4ED8" stroke-width="2.5"/>
        <rect x="282" y="192" width="24" height="12" rx="3" fill="#3B82F6" stroke="#1D4ED8" stroke-width="2"/>
        <rect x="326" y="192" width="24" height="12" rx="3" fill="#3B82F6" stroke="#1D4ED8" stroke-width="2"/>
        <!-- Yellow Top Block -->
        <rect x="216" y="138" width="96" height="66" rx="6" fill="#FACC15" stroke="#CA8A04" stroke-width="2.5"/>
        <rect x="230" y="126" width="24" height="12" rx="3" fill="#FACC15" stroke="#CA8A04" stroke-width="2"/>
        <rect x="274" y="126" width="24" height="12" rx="3" fill="#FACC15" stroke="#CA8A04" stroke-width="2"/>
      </g>
    `;
  }

  // 14. Jewellery & Watches
  if (
    key === 'analog_wristwatch' ||
    key === 'jhumka_earrings' ||
    key === 'wall_clock'
  ) {
    return `
      <g>
        <!-- Leather Watch Strap -->
        <rect x="242" y="68" width="56" height="224" rx="10" fill="#78350F" stroke="#451A03" stroke-width="2.5"/>
        <!-- Gold/Brass Watch Case -->
        <circle cx="270" cy="180" r="58" fill="#F59E0B" stroke="#B45309" stroke-width="4"/>
        <circle cx="270" cy="180" r="48" fill="#FFFBEB"/>
        <!-- Watch Hands & Markers -->
        <line x1="270" y1="180" x2="270" y2="146" stroke="#1C1917" stroke-width="4" stroke-linecap="round"/>
        <line x1="270" y1="180" x2="298" y2="180" stroke="#1C1917" stroke-width="3.5" stroke-linecap="round"/>
        <circle cx="270" cy="180" r="5" fill="#B45309"/>
      </g>
    `;
  }

  // 15. Automotive & Two-Wheeler Accessories
  if (
    key === 'phone_holder' ||
    key === 'bike_cover' ||
    key === 'microfiber_cloths'
  ) {
    return `
      <g>
        <!-- Handlebar Clamp Base -->
        <circle cx="270" cy="254" r="24" fill="none" stroke="#334155" stroke-width="10"/>
        <rect x="260" y="206" width="20" height="32" fill="#475569"/>
        <!-- Phone Cradle & Claws -->
        <rect x="212" y="92" width="116" height="136" rx="16" fill="#1E293B" stroke="#0F172A" stroke-width="4"/>
        <rect x="222" y="104" width="96" height="112" rx="10" fill="#38BDF8" opacity="0.22"/>
        <rect x="198" y="114" width="16" height="24" rx="4" fill="#EF4444"/>
        <rect x="326" y="114" width="16" height="24" rx="4" fill="#EF4444"/>
        <rect x="198" y="186" width="16" height="24" rx="4" fill="#EF4444"/>
        <rect x="326" y="186" width="16" height="24" rx="4" fill="#EF4444"/>
      </g>
    `;
  }

  // 16. Pet Supplies
  if (key === 'dog_food' || key === 'pet_leash' || key === 'pet_bowls') {
    return `
      <g>
        <!-- Dog Food Nutrition Bag -->
        <path d="M174 96 L286 96 L296 274 L164 274 Z" fill="#D97706" stroke="#92400E" stroke-width="3"/>
        <rect x="186" y="132" width="88" height="88" rx="10" fill="#FFFBEB"/>
        <circle cx="230" cy="166" r="14" fill="#78350F"/>
        <text x="230" y="204" text-anchor="middle" font-family="sans-serif" font-size="10" font-weight="800" fill="#78350F">DOG FOOD 1KG</text>
        <!-- Pet Bowl with Kibble -->
        <polygon points="292,232 396,232 412,276 276,276" fill="#0284C7" stroke="#0369A1" stroke-width="2.5"/>
        <ellipse cx="344" cy="232" rx="48" ry="12" fill="#78350F"/>
      </g>
    `;
  }

  // 17. Sports & Fitness
  if (key === 'hand_gripper' || key === 'yoga_mat' || key === 'cricket_bat') {
    return `
      <g>
        <!-- Top & Bottom Steel Spring Coil -->
        <circle cx="270" cy="112" r="24" fill="none" stroke="#475569" stroke-width="10"/>
        <!-- Left & Right Ergonomic Grip Handles -->
        <path d="M254 126 L186 258" stroke="#EA580C" stroke-width="26" stroke-linecap="round"/>
        <path d="M286 126 L354 258" stroke="#1E293B" stroke-width="26" stroke-linecap="round"/>
      </g>
    `;
  }

  // 18. Home & Kitchen Appliances: Electric Kettle / Iron / Cooker
  if (
    key === 'electric_kettle' ||
    key === 'dry_iron' ||
    key === 'pressure_cooker'
  ) {
    return `
      <g>
        <!-- Swivel Power Base -->
        <rect x="184" y="262" width="160" height="16" rx="6" fill="#1E293B"/>
        <!-- Brushed Stainless Steel Kettle Pitcher -->
        <path d="M196 116 L326 116 L340 262 L188 262 Z" fill="#CBD5E1" stroke="#475569" stroke-width="3"/>
        <!-- Pour Spout & Hinged Lid -->
        <polygon points="196,116 170,126 192,152" fill="#94A3B8" stroke="#475569" stroke-width="2"/>
        <rect x="200" y="98" width="122" height="18" rx="8" fill="#1E293B"/>
        <!-- Cool-Touch Handle -->
        <path d="M326 130 C376 130, 376 238, 336 238" fill="none" stroke="#1E293B" stroke-width="16" stroke-linecap="round"/>
      </g>
    `;
  }

  // 19. Gifts, Flowers & Handicrafts: Fresh Flower Bouquet
  if (
    key === 'flower_bouquet' ||
    key === 'brass_diya' ||
    key === 'ceramic_planter'
  ) {
    return `
      <g>
        <!-- Kraft Paper Bouquet Cone -->
        <polygon points="184,168 356,168 294,282 246,282" fill="#D6C29F" stroke="#A18862" stroke-width="2.5"/>
        <!-- Satin Ribbon Bow -->
        <rect x="242" y="226" width="56" height="14" rx="4" fill="#E11D48"/>
        <!-- Fresh Roses & Foliage -->
        <circle cx="235" cy="144" r="24" fill="#E11D48"/>
        <circle cx="270" cy="132" r="26" fill="#F43F5E"/>
        <circle cx="305" cy="144" r="24" fill="#FB7185"/>
        <circle cx="252" cy="162" r="22" fill="#F59E0B"/>
        <circle cx="288" cy="162" r="22" fill="#E11D48"/>
      </g>
    `;
  }

  // 21. Agriculture & Gardening: Gardening Tool Set
  if (
    key === 'gardening_tools' ||
    key === 'vermicompost' ||
    key === 'garden_sprayer'
  ) {
    return `
      <g>
        <!-- Garden Trowel -->
        <rect x="192" y="192" width="22" height="78" rx="8" fill="#15803D" stroke="#14532D" stroke-width="2"/>
        <path d="M174 192 C174 112, 232 112, 232 192 Z" fill="#64748B" stroke="#334155" stroke-width="2.5"/>
        <!-- Garden Hand Cultivator Fork -->
        <rect x="296" y="192" width="22" height="78" rx="8" fill="#EA580C" stroke="#9A3412" stroke-width="2"/>
        <rect x="282" y="168" width="50" height="14" rx="3" fill="#475569"/>
        <rect x="284" y="122" width="8" height="48" rx="3" fill="#64748B"/>
        <rect x="303" y="122" width="8" height="48" rx="3" fill="#64748B"/>
        <rect x="322" y="122" width="8" height="48" rx="3" fill="#64748B"/>
      </g>
    `;
  }

  // 22. Household & Cleaning Supplies: Floor Cleaning Liquid
  if (
    key === 'floor_cleaner' ||
    key === 'spin_mop' ||
    key === 'dishwash_gel'
  ) {
    return `
      <g>
        <path d="M212 106 L308 106 L324 276 L196 276 Z" fill="#0EA5E9" stroke="#0369A1" stroke-width="3"/>
        <rect x="242" y="72" width="36" height="34" rx="6" fill="#E11D48"/>
        <path d="M308 128 C346 128, 346 196, 314 196" fill="none" stroke="#0EA5E9" stroke-width="14" stroke-linecap="round"/>
        <rect x="214" y="154" width="92" height="84" rx="8" fill="#FFFFFF"/>
        <text x="260" y="188" text-anchor="middle" font-family="sans-serif" font-size="10.5" font-weight="800" fill="#0369A1">FLOOR CLEANER</text>
        <text x="260" y="208" text-anchor="middle" font-family="sans-serif" font-size="10" font-weight="700" fill="#15803D">PINE &amp; CITRUS 1L</text>
      </g>
    `;
  }

  // 23. Handicrafts & Local Products: Handmade Decorative Wall Art
  if (
    key === 'handmade_wall_art' ||
    key === 'wooden_spice_box' ||
    key === 'terracotta_jug'
  ) {
    return `
      <g>
        <!-- Framed Folk Wall Art -->
        <rect x="164" y="88" width="212" height="176" rx="8" fill="#78350F" stroke="#451A03" stroke-width="4"/>
        <rect x="180" y="104" width="180" height="144" rx="4" fill="#B45309"/>
        <!-- Warli / Geometric Folk Artwork Inside Frame -->
        <circle cx="270" cy="176" r="44" fill="none" stroke="#FFFBEB" stroke-width="3" stroke-dasharray="6 4"/>
        <polygon points="270,144 252,174 288,174" fill="#FFFBEB"/>
        <polygon points="270,208 252,178 288,178" fill="#FFFBEB"/>
        <circle cx="270" cy="134" r="6" fill="#FFFBEB"/>
      </g>
    `;
  }

  // 24. Party & Celebration Supplies: Birthday Decoration Kit
  if (
    key === 'birthday_decoration_kit' ||
    key === 'fairy_lights' ||
    key === 'party_tableware'
  ) {
    return `
      <g>
        <!-- Bunting Flags -->
        <polygon points="154,96 194,96 174,136" fill="#F59E0B"/>
        <polygon points="204,104 244,104 224,144" fill="#EC4899"/>
        <polygon points="254,108 294,108 274,148" fill="#3B82F6"/>
        <polygon points="304,104 344,104 324,144" fill="#10B981"/>
        <polygon points="354,96 394,96 374,136" fill="#F59E0B"/>
        <!-- Festive Balloons -->
        <ellipse cx="216" cy="198" rx="34" ry="42" fill="#EC4899"/>
        <ellipse cx="270" cy="184" rx="36" ry="44" fill="#FBBF24"/>
        <ellipse cx="324" cy="198" rx="34" ry="42" fill="#3B82F6"/>
      </g>
    `;
  }

  // 25. Other Local Retail Stores: Multipurpose Storage Organizer
  void categoryId;
  return `
    <g>
      <!-- Woven Ventilated Storage Basket -->
      <polygon points="158,136 382,136 362,272 178,272" fill="#F5F5F4" stroke="#78716C" stroke-width="3"/>
      <rect x="150" y="122" width="240" height="18" rx="6" fill="#D6D3D1" stroke="#78716C" stroke-width="2.5"/>
      <!-- Cutout Handles & Compartment Dividers -->
      <rect x="242" y="156" width="56" height="18" rx="9" fill="#57534E"/>
      <line x1="210" y1="196" x2="330" y2="196" stroke="#A8A29E" stroke-width="3" stroke-dasharray="10 6"/>
      <line x1="216" y1="224" x2="324" y2="224" stroke="#A8A29E" stroke-width="3" stroke-dasharray="10 6"/>
      <line x1="222" y1="252" x2="318" y2="252" stroke="#A8A29E" stroke-width="3" stroke-dasharray="10 6"/>
    </g>
  `;
}

export async function GET(req: NextRequest) {
  const {searchParams} = new URL(req.url);
  const type = searchParams.get('type') || 'product';
  const key = searchParams.get('key') || 'storage_organizer';
  const categoryId = searchParams.get('category') || 'cat-01-grocery-daily-essentials';
  const title = searchParams.get('title') || 'URBANDIRECT Nanded Demo';
  const unit = searchParams.get('unit') || '';

  const palette = getCategoryPalette(categoryId);
  const safeTitle = escapeXml(title.slice(0, 42));
  const safeUnit = escapeXml(unit.slice(0, 36));

  if (type === 'store') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 320" width="640" height="320">
      <defs>
        <linearGradient id="storeBg" x1="0" y1="0" x2="640" y2="320" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="${palette.bgStart}"/>
          <stop offset="100%" stop-color="${palette.bgEnd}"/>
        </linearGradient>
      </defs>
      <rect width="640" height="320" fill="url(#storeBg)"/>
      <!-- Storefront Awning Header -->
      <rect x="0" y="0" width="640" height="44" fill="${palette.badgeBg}"/>
      <circle cx="40" cy="44" r="24" fill="${palette.accent}"/>
      <circle cx="88" cy="44" r="24" fill="${palette.bgStart}"/>
      <circle cx="136" cy="44" r="24" fill="${palette.accent}"/>
      <circle cx="184" cy="44" r="24" fill="${palette.bgStart}"/>
      <circle cx="232" cy="44" r="24" fill="${palette.accent}"/>
      <circle cx="280" cy="44" r="24" fill="${palette.bgStart}"/>
      <circle cx="328" cy="44" r="24" fill="${palette.accent}"/>
      <circle cx="376" cy="44" r="24" fill="${palette.bgStart}"/>
      <circle cx="424" cy="44" r="24" fill="${palette.accent}"/>
      <circle cx="472" cy="44" r="24" fill="${palette.bgStart}"/>
      <circle cx="520" cy="44" r="24" fill="${palette.accent}"/>
      <circle cx="568" cy="44" r="24" fill="${palette.bgStart}"/>
      <circle cx="616" cy="44" r="24" fill="${palette.accent}"/>
      <!-- Category Visual Emblem on Right -->
      <g transform="translate(175, -10) scale(0.9)">
        ${renderProductSubjectSvg(
          categoryId.includes('01-grocery')
            ? 'basmati_rice'
            : categoryId.includes('02-fruits')
              ? 'alphonso_mangoes'
              : categoryId.includes('03-fashion')
                ? 'cotton_shirt'
                : categoryId.includes('04-electronics')
                  ? 'usbc_cable'
                  : categoryId.includes('05-pharmacy')
                    ? 'digital_thermometer'
                    : categoryId.includes('06-bakery')
                      ? 'assorted_pastries'
                      : categoryId.includes('07-restaurants')
                        ? 'veg_thali'
                        : categoryId.includes('08-furniture')
                          ? 'wooden_coffee_table'
                          : categoryId.includes('09-hardware')
                            ? 'pipe_wrench'
                            : categoryId.includes('10-beauty')
                              ? 'aloe_face_wash'
                              : categoryId.includes('11-footwear')
                                ? 'casual_sneakers'
                                : categoryId.includes('12-books')
                                  ? 'a4_notebook'
                                  : categoryId.includes('13-toys')
                                    ? 'building_blocks'
                                    : categoryId.includes('14-jewellery')
                                      ? 'analog_wristwatch'
                                      : categoryId.includes('15-automotive')
                                        ? 'phone_holder'
                                        : categoryId.includes('16-pet')
                                          ? 'dog_food'
                                          : categoryId.includes('17-sports')
                                            ? 'hand_gripper'
                                            : categoryId.includes('18-home-kitchen')
                                              ? 'electric_kettle'
                                              : categoryId.includes('19-gifts')
                                                ? 'flower_bouquet'
                                                : categoryId.includes('20-fabrics')
                                                  ? 'cotton_fabric'
                                                  : categoryId.includes('21-agriculture')
                                                    ? 'gardening_tools'
                                                    : categoryId.includes('22-household')
                                                      ? 'floor_cleaner'
                                                      : categoryId.includes('23-handicrafts')
                                                        ? 'handmade_wall_art'
                                                        : categoryId.includes('24-party')
                                                          ? 'birthday_decoration_kit'
                                                          : 'storage_organizer',
          categoryId
        )}
      </g>
      <rect x="28" y="96" width="290" height="184" rx="16" fill="#FFFFFF" fill-opacity="0.92" stroke="${palette.plinth}" stroke-width="2"/>
      <rect x="46" y="118" width="128" height="24" rx="6" fill="${palette.badgeBg}"/>
      <text x="110" y="134" text-anchor="middle" font-family="sans-serif" font-size="10" font-weight="700" fill="#FFFFFF">NANDED DEMO STORE</text>
      <text x="46" y="174" font-family="sans-serif" font-size="18" font-weight="800" fill="#1C1917">${safeTitle}</text>
      <text x="46" y="202" font-family="sans-serif" font-size="12" font-weight="600" fill="#57534E">Nanded, Maharashtra · INR (₹)</text>
      <text x="46" y="226" font-family="sans-serif" font-size="11" fill="#78716C">Direct local delivery · Pay on delivery</text>
    </svg>`;

    return new NextResponse(svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  }

  const productSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 405" width="540" height="405">
    <defs>
      <linearGradient id="prodBg" x1="0" y1="0" x2="540" y2="405" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="${palette.bgStart}"/>
        <stop offset="100%" stop-color="${palette.bgEnd}"/>
      </linearGradient>
      <radialGradient id="prodShadow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#1C1917" stop-opacity="0.24"/>
        <stop offset="100%" stop-color="#1C1917" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="540" height="405" fill="url(#prodBg)"/>
    <!-- Studio Plinth -->
    <polygon points="86,274 454,274 488,312 52,312" fill="${palette.plinth}"/>
    <rect x="52" y="312" width="436" height="22" fill="${palette.accent}" fill-opacity="0.18"/>
    <ellipse cx="270" cy="284" rx="118" ry="15" fill="url(#prodShadow)"/>
    <!-- Product Subject Illustration -->
    ${renderProductSubjectSvg(key, categoryId)}
    <!-- Bottom Studio Info Caption Strip -->
    <rect x="24" y="346" width="492" height="42" rx="10" fill="#FFFFFF" fill-opacity="0.9"/>
    <text x="42" y="366" font-family="sans-serif" font-size="13" font-weight="700" fill="#1C1917">${safeTitle}</text>
    <text x="42" y="381" font-family="sans-serif" font-size="10.5" font-weight="500" fill="#57534E">${safeUnit || 'Nanded Demo Catalog · INR'}</text>
    <rect x="422" y="355" width="80" height="24" rx="6" fill="${palette.badgeBg}"/>
    <text x="462" y="371" text-anchor="middle" font-family="sans-serif" font-size="10" font-weight="700" fill="#FFFFFF">DEMO ITEM</text>
  </svg>`;

  return new NextResponse(productSvg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
