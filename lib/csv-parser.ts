import {
  AUTHORITATIVE_STORE_CATEGORIES,
  CategoryDefinition,
  Product,
  StoreCategoryId,
  StoreCategoryName,
} from './catalog-data';

export interface ParsedProductRow {
  rowNumber: number;
  raw: Record<string, string>;
  name: string;
  categoryInput: string;
  priceInput: string;
  deliveryChargeInput?: string;
  sku: string;
  stockInput: string;
  unit: string;
  description: string;
  dimensions: string;
  materials: string;
  variantsInput: string;
  customImageUrl: string;
  productStatus: string;
  
  // Validation Results
  isValid: boolean;
  hasWarning: boolean;
  errors: string[];
  warnings: string[];
  
  // Resolved Data
  resolvedCategory?: CategoryDefinition;
  resolvedPrice?: number;
  resolvedDeliveryCharge?: number;
  resolvedStock?: number;
  resolvedVariants?: string[];
  resolvedImageUrl?: string;
  
  // Mode B Matching
  matchedExistingProduct?: Product;
}

export interface BulkUploadSummary {
  totalRows: number;
  validRowsCount: number;
  warningRowsCount: number;
  errorRowsCount: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  errorsReportCsv?: string;
}

/**
 * Robust RFC 4180 compliant CSV/TSV Parser.
 * Handles UTF-8 BOM (\uFEFF), auto-detected delimiters (comma, tab, semicolon),
 * quoted fields, nested commas, escaped double-quotes (""),
 * Unicode characters, and multi-line strings cleanly.
 */
export function parseCSVText(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  // Strip UTF-8 BOM (\uFEFF) and normalize Windows CRLF / CR line endings
  const text = csvText
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  // Auto-detect delimiter from the first non-empty line (comma vs tab vs semicolon)
  const firstLine = (text.split('\n').find((l) => l.trim().length > 0) || '').trim();
  let delimiter = ',';
  if (!firstLine.includes(',')) {
    if (firstLine.includes('\t')) {
      delimiter = '\t';
    } else if (firstLine.includes(';')) {
      delimiter = ';';
    }
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (insideQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped double quote inside quoted field
          currentField += '"';
          i++; // Skip second quote
        } else {
          // End of quoted field
          insideQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
      } else if (char === delimiter) {
        currentRow.push(currentField.replace(/^\uFEFF/, '').trim());
        currentField = '';
      } else if (char === '\n') {
        currentRow.push(currentField.replace(/^\uFEFF/, '').trim());
        if (currentRow.some((field) => field.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  // Push final field/row if present
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.replace(/^\uFEFF/, '').trim());
    if (currentRow.some((field) => field.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Converts array of row objects into valid escaped CSV content.
 */
export function generateCSVContent(
  headers: string[],
  rows: Array<Record<string, string | number>>
): string {
  const escapeField = (val: string | number | undefined | null): string => {
    if (val === undefined || val === null) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = headers.map(escapeField).join(',');
  const rowLines = rows.map((row) =>
    headers.map((h) => escapeField(row[h])).join(',')
  );

  return [headerLine, ...rowLines].join('\n');
}

/**
 * Template Column Headers for Citykart Bulk Upload
 */
export const BULK_TEMPLATE_HEADERS = [
  'Product Name',
  'Category',
  'Price (INR)',
  'Delivery Charge (INR)',
  'SKU',
  'Stock Quantity',
  'Unit',
  'Description',
  'Dimensions',
  'Materials',
  'Product Variants',
  'Product Image URL',
  'Product Status',
];

/**
 * Sample rows pre-populated in downloadable template
 */
export const SAMPLE_TEMPLATE_ROWS: Array<Record<string, string | number>> = [
  {
    'Product Name': 'Amul Taaza Toned Milk 1L',
    'Category': 'Grocery & Daily Essentials',
    'Price (INR)': 72,
    'Delivery Charge (INR)': 0,
    'SKU': 'AMUL-TAAZA-1L',
    'Stock Quantity': 50,
    'Unit': '1 Liter',
    'Description': 'Fresh pasteurized toned milk from local dairy',
    'Dimensions': '10x10x20 cm',
    'Materials': 'Toned Milk 3.0% Fat',
    'Product Variants': '500ml; 1L',
    'Product Image URL': 'https://picsum.photos/seed/amul-milk/600/600',
    'Product Status': 'In Stock',
  },
  {
    'Product Name': 'Fresh Organic Alphonsos (1 Dozen)',
    'Category': 'Fruits & Vegetables',
    'Price (INR)': 650,
    'Delivery Charge (INR)': 40,
    'SKU': 'MANGO-ALPHONSO-12P',
    'Stock Quantity': 25,
    'Unit': '1 Dozen (12 Pcs)',
    'Description': 'Naturally ripened Ratnagiri Alphonso mangoes from local orchard',
    'Dimensions': 'Standard Box',
    'Materials': '100% Organic Fruit',
    'Product Variants': '6 Pcs; 12 Pcs',
    'Product Image URL': 'https://picsum.photos/seed/mangoes/600/600',
    'Product Status': 'In Stock',
  },
  {
    'Product Name': 'Pure Cotton Handloom Kurti',
    'Category': 'Fashion & Clothing',
    'Price (INR)': 899,
    'Delivery Charge (INR)': 0,
    'SKU': 'KURTI-COTTON-RED-M',
    'Stock Quantity': 15,
    'Unit': '1 Piece',
    'Description': 'Handmade breathable cotton kurti with traditional ethnic embroidery',
    'Dimensions': 'Chest 38 in, Length 42 in',
    'Materials': '100% Breathable Cotton',
    'Product Variants': 'Small; Medium; Large; XL',
    'Product Image URL': 'https://picsum.photos/seed/kurti-cotton/600/600',
    'Product Status': 'In Stock',
  },
];

/**
 * Generates the official downloadable sample CSV template with comments and instructions.
 */
export function generateSampleCSVTemplate(): string {
  return generateCSVContent(BULK_TEMPLATE_HEADERS, SAMPLE_TEMPLATE_ROWS);
}

/**
 * Helper to match category string input to official Citykart category.
 */
export function resolveCategoryFromInput(
  input?: string | null
): CategoryDefinition | null {
  if (!input || !input.trim()) return null;
  const cleaned = input.trim().toLowerCase();

  // Try exact ID match e.g. cat-01-grocery-daily-essentials
  const byId = AUTHORITATIVE_STORE_CATEGORIES.find(
    (c) => c.id.toLowerCase() === cleaned
  );
  if (byId) return byId;

  // Try slug match
  const bySlug = AUTHORITATIVE_STORE_CATEGORIES.find(
    (c) => c.slug.toLowerCase() === cleaned
  );
  if (bySlug) return bySlug;

  // Try exact Name match
  const byName = AUTHORITATIVE_STORE_CATEGORIES.find(
    (c) => c.name.toLowerCase() === cleaned
  );
  if (byName) return byName;

  // Fuzzy match keywords e.g. "grocery", "fruits", "clothing", "electronics", "bakery"
  const fuzzy = AUTHORITATIVE_STORE_CATEGORIES.find(
    (c) =>
      c.name.toLowerCase().includes(cleaned) ||
      cleaned.includes(c.name.toLowerCase()) ||
      c.slug.includes(cleaned)
  );
  if (fuzzy) return fuzzy;

  // Synonym keyword fallback
  const keywordAliases: Array<{ keywords: string[]; matchSlugPart: string }> = [
    { keywords: ['kirana', 'grocery', 'staple', 'atta', 'rice', 'spice', 'oil', 'pantry', 'daily'], matchSlugPart: 'grocery' },
    { keywords: ['fruit', 'vegetable', 'veggie', 'produce', 'organic farm'], matchSlugPart: 'fruits' },
    { keywords: ['dairy', 'milk', 'paneer', 'curd', 'butter', 'cheese', 'egg'], matchSlugPart: 'dairy' },
    { keywords: ['bakery', 'cake', 'bread', 'sweet', 'mithai', 'confectionery'], matchSlugPart: 'bakery' },
    { keywords: ['meat', 'chicken', 'mutton', 'fish', 'seafood', 'poultry'], matchSlugPart: 'meat' },
    { keywords: ['pharmacy', 'medicine', 'medical', 'health', 'wellness', 'chemist'], matchSlugPart: 'pharmacy' },
    { keywords: ['fashion', 'clothing', 'apparel', 'garment', 'kurti', 'shirt', 'saree', 'dress'], matchSlugPart: 'fashion' },
    { keywords: ['footwear', 'shoe', 'sandal', 'slipper'], matchSlugPart: 'footwear' },
    { keywords: ['electronic', 'mobile', 'phone', 'laptop', 'computer', 'gadget', 'audio'], matchSlugPart: 'electronics' },
    { keywords: ['appliance', 'kitchen', 'cookware', 'utensil', 'kettle', 'mixer'], matchSlugPart: 'appliances' },
    { keywords: ['beauty', 'cosmetic', 'skincare', 'personal care', 'grooming', 'salon'], matchSlugPart: 'personal-care' },
    { keywords: ['stationery', 'book', 'office', 'school', 'paper', 'pen'], matchSlugPart: 'books' },
    { keywords: ['hardware', 'tool', 'paint', 'plumbing', 'electrical'], matchSlugPart: 'hardware' },
    { keywords: ['furniture', 'decor', 'furnishing', 'mattress', 'lighting'], matchSlugPart: 'home' },
    { keywords: ['jewel', 'gold', 'silver', 'ornament', 'watch', 'accessory'], matchSlugPart: 'jewellery' },
    { keywords: ['toy', 'baby', 'kid', 'game', 'gift'], matchSlugPart: 'toys' },
    { keywords: ['sport', 'fitness', 'gym', 'cycle'], matchSlugPart: 'sports' },
    { keywords: ['pet', 'dog', 'cat'], matchSlugPart: 'pet' },
    { keywords: ['flower', 'florist', 'plant', 'nursery', 'bouquet'], matchSlugPart: 'flowers' },
    { keywords: ['auto', 'car', 'bike', 'tyre', 'spare'], matchSlugPart: 'automotive' },
  ];

  for (const entry of keywordAliases) {
    if (entry.keywords.some((kw) => cleaned.includes(kw))) {
      const matched = AUTHORITATIVE_STORE_CATEGORIES.find(
        (c) =>
          c.slug.toLowerCase().includes(entry.matchSlugPart) ||
          c.name.toLowerCase().includes(entry.matchSlugPart)
      );
      if (matched) return matched;
    }
  }

  return null;
}

/**
 * Normalizes optional image URL inputs from CSV spreadsheets.
 * Treats placeholder tokens like "N/A", "none", "-", "null" as empty.
 */
export function normalizeImageUrlInput(url?: string | null): string {
  if (!url || !url.trim()) return '';
  const trimmed = url.trim();
  if (/^(n\/a|na|none|null|nil|-|--|default)$/i.test(trimmed)) {
    return '';
  }
  return trimmed;
}

/**
 * Validates image URL format (accepts http://, https://, data:image/, or root-relative / paths).
 */
export function isValidImageUrl(url?: string | null): boolean {
  const normalized = normalizeImageUrlInput(url);
  if (!normalized) return true; // Optional field
  if (normalized.startsWith('/') || normalized.startsWith('data:image/')) {
    return true;
  }
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    return false;
  }
  try {
    new URL(normalized);
    return true;
  } catch {
    return false;
  }
}
