'use client';

import React, { useState, useMemo, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  X,
  Check,
  Loader2,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  FileText,
  Package,
  Layers,
  Store,
  ShieldCheck,
  Eye,
  Info,
} from 'lucide-react';
import {
  AUTHORITATIVE_STORE_CATEGORIES,
  CategoryDefinition,
  LocalStore,
  Product,
} from '@/lib/catalog-data';
import {
  checkProductQuota,
  ProductQuotaStatus,
} from '@/lib/entitlements';
import {
  BULK_TEMPLATE_HEADERS,
  generateCSVContent,
  generateSampleCSVTemplate,
  isValidImageUrl,
  normalizeImageUrlInput,
  parseCSVText,
  ParsedProductRow,
  resolveCategoryFromInput,
} from '@/lib/csv-parser';
import { buildAuthenticatedHeaders } from '@/lib/firebase';
import { ProductStudioArtwork } from './product-studio-artwork';

export type ImportMode = 'ADD_NEW' | 'UPDATE_EXISTING';

interface SellerBulkUploadModalProps {
  isOpen: boolean;
  activeStore: LocalStore;
  activeSellerId: string;
  ownerUid?: string;
  existingProducts: Product[];
  onClose: () => void;
  onImportComplete: (updatedProducts: Product[]) => void;
}

type ModalStep = 'UPLOAD_FILE' | 'PREVIEW_VALIDATE' | 'IMPORTING_PROGRESS' | 'IMPORT_SUMMARY';

export function SellerBulkUploadModal({
  isOpen,
  activeStore,
  activeSellerId,
  ownerUid,
  existingProducts,
  onClose,
  onImportComplete,
}: SellerBulkUploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<ModalStep>('UPLOAD_FILE');
  const [importMode, setImportMode] = useState<ImportMode>('ADD_NEW');

  const [dragActive, setDragActive] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileReadError, setFileReadError] = useState<string | null>(null);

  const [parsedRows, setParsedRows] = useState<ParsedProductRow[]>([]);
  const [previewFilter, setPreviewFilter] = useState<'ALL' | 'ERRORS_ONLY' | 'VALID_ONLY'>('ALL');

  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importProgressPercent, setImportProgressPercent] = useState<number>(0);
  const [importStatusMessage, setImportStatusMessage] = useState<string>('');

  const [importReport, setImportReport] = useState<{
    createdCount: number;
    updatedCount: number;
    skippedCount: number;
    failedCount: number;
    errors: string[];
    committedProducts: Product[];
  } | null>(null);

  // Store Product Quota Status
  const storeProducts = useMemo(
    () => existingProducts.filter((p) => p.storeId === activeStore.id),
    [existingProducts, activeStore.id]
  );

  const quotaStatus: ProductQuotaStatus = useMemo(
    () => checkProductQuota(activeStore.id, storeProducts.length),
    [activeStore.id, storeProducts.length]
  );

  // Existing SKUs and Product Names in Store
  const existingSkuSet = useMemo(() => {
    const set = new Set<string>();
    storeProducts.forEach((p) => {
      if (p.sku) set.add(p.sku.toLowerCase().trim());
      if (p.id) set.add(p.id.toLowerCase().trim());
    });
    return set;
  }, [storeProducts]);

  const existingNameSet = useMemo(() => {
    const set = new Set<string>();
    storeProducts.forEach((p) => {
      if (p.name) set.add(p.name.toLowerCase().trim());
    });
    return set;
  }, [storeProducts]);

  // Handle Sample Template Download
  const handleDownloadTemplate = () => {
    const csvContent = generateSampleCSVTemplate();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Citykart_Bulk_Product_Template_${activeStore.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle Error Report CSV Download
  const handleDownloadErrorReport = () => {
    const errorRows = parsedRows.filter((r) => r.errors.length > 0 || r.warnings.length > 0);
    if (errorRows.length === 0) return;

    const reportData = errorRows.map((r) => ({
      'Row Number': r.rowNumber,
      'Product Name': r.name || 'Missing Name',
      'SKU': r.sku || 'N/A',
      'Category Input': r.categoryInput || 'N/A',
      'Price Input': r.priceInput || 'N/A',
      'Blocking Errors': r.errors.join(' | ') || 'None',
      'Warnings': r.warnings.join(' | ') || 'None',
    }));

    const csvContent = generateCSVContent(
      ['Row Number', 'Product Name', 'SKU', 'Category Input', 'Price Input', 'Blocking Errors', 'Warnings'],
      reportData
    );

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Citykart_Upload_Error_Report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Parse Raw Uploaded CSV File
  const processUploadedFile = (file: File) => {
    setFileReadError(null);

    const lowerName = (file.name || '').toLowerCase();
    const isSupportedExt =
      lowerName.endsWith('.csv') ||
      lowerName.endsWith('.tsv') ||
      lowerName.endsWith('.txt') ||
      lowerName.endsWith('.xlsx') ||
      lowerName.endsWith('.xls') ||
      file.type === 'text/csv';

    if (!isSupportedExt) {
      setFileReadError('Please upload a valid .csv file exported from Excel or Google Sheets.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setFileReadError('File size exceeds maximum allowed 10MB limit.');
      return;
    }

    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text || !text.trim()) {
          setFileReadError('The uploaded file appears to be empty.');
          return;
        }

        // Detect binary .xlsx ZIP header (PK\x03\x04)
        if (text.startsWith('PK\x03\x04')) {
          setFileReadError(
            'This file is a binary Excel (.xlsx) workbook. Please save or export it as "CSV (Comma delimited) (.csv)" from Excel or Google Sheets and upload the .csv file.'
          );
          return;
        }

        const rawMatrix = parseCSVText(text);
        if (rawMatrix.length < 2) {
          setFileReadError('The uploaded CSV file must contain a header row and at least one product data row.');
          return;
        }

        const headers = rawMatrix[0].map((h) => h.replace(/^\uFEFF/, '').trim().toLowerCase());
        const dataRows = rawMatrix.slice(1);

        // Priority-ordered header index resolver (matches exact headers first, then substring in priority order)
        const getColIdx = (possibleNames: string[]): number => {
          for (const candidate of possibleNames) {
            const target = candidate.toLowerCase();
            const exactIdx = headers.findIndex(
              (h) => h === target || h.startsWith(`${target} (`) || h.startsWith(`${target} [`)
            );
            if (exactIdx !== -1) return exactIdx;
          }
          for (const candidate of possibleNames) {
            const target = candidate.toLowerCase();
            const subIdx = headers.findIndex((h) => h.includes(target));
            if (subIdx !== -1) return subIdx;
          }
          return -1;
        };

        const idxName = getColIdx(['product name', 'item name', 'product title', 'title', 'name']);
        const idxCategory = getColIdx(['category', 'product category', 'type']);
        const idxPrice = getColIdx(['price (inr)', 'selling price', 'price', 'mrp', 'cost']);
        const idxDelivery = getColIdx(['delivery charge (inr)', 'delivery charge', 'delivery fee', 'shipping']);
        const idxSku = getColIdx(['sku', 'product code', 'item code', 'product id', 'code']);
        const idxStock = getColIdx(['stock quantity', 'available stock', 'stock', 'qty', 'quantity']);
        const idxUnit = getColIdx(['unit', 'pack size', 'weight']);
        const idxDesc = getColIdx(['description', 'product description', 'details']);
        const idxDim = getColIdx(['dimensions', 'dimension', 'product size']);
        const idxMat = getColIdx(['materials', 'material', 'ingredients']);
        const idxVar = getColIdx(['product variants', 'variants', 'options']);
        const idxImg = getColIdx(['product image url', 'image url', 'image', 'photo', 'url']);
        const idxStatus = getColIdx(['product status', 'status', 'availability']);

        if (idxName === -1 || idxPrice === -1) {
          setFileReadError(
            'Missing required header columns. The spreadsheet must contain at least "Product Name" and "Price" columns.'
          );
          return;
        }

        const fileSkuTracker = new Set<string>();
        const parsed: ParsedProductRow[] = [];

        dataRows.forEach((rowArray, idx) => {
          if (!rowArray || rowArray.every((cell) => !cell || !cell.trim())) {
            return;
          }
          const rowNum = idx + 2; // Row number in spreadsheet (Header is row 1)
          const name = (rowArray[idxName] || '').trim();
          const categoryInput = idxCategory !== -1 ? (rowArray[idxCategory] || '').trim() : '';
          const priceInput = idxPrice !== -1 ? (rowArray[idxPrice] || '').trim() : '';
          const deliveryChargeInput = idxDelivery !== -1 ? (rowArray[idxDelivery] || '').trim() : '';
          const sku = idxSku !== -1 ? (rowArray[idxSku] || '').trim() : '';
          const stockInput = idxStock !== -1 ? (rowArray[idxStock] || '').trim() : '';
          const unit = idxUnit !== -1 ? (rowArray[idxUnit] || '').trim() : '';
          const description = idxDesc !== -1 ? (rowArray[idxDesc] || '').trim() : '';
          const dimensions = idxDim !== -1 ? (rowArray[idxDim] || '').trim() : '';
          const materials = idxMat !== -1 ? (rowArray[idxMat] || '').trim() : '';
          const variantsInput = idxVar !== -1 ? (rowArray[idxVar] || '').trim() : '';
          const rawImageUrl = idxImg !== -1 ? (rowArray[idxImg] || '').trim() : '';
          const customImageUrl = normalizeImageUrlInput(rawImageUrl);
          const productStatus = idxStatus !== -1 ? (rowArray[idxStatus] || '').trim() : '';

          const errors: string[] = [];
          const warnings: string[] = [];

          // Validation 1: Product Name
          if (!name) {
            errors.push('Product name is required');
          } else if (name.length < 2) {
            errors.push('Product name is too short (min 2 characters)');
          } else if (name.length > 150) {
            errors.push('Product name is too long (max 150 characters)');
          }

          // Validation 2: Price
          const numericPrice = Number(priceInput.replace(/[^0-9.]/g, ''));
          if (!priceInput) {
            errors.push('Price is required');
          } else if (isNaN(numericPrice) || numericPrice <= 0) {
            errors.push('Price must be a valid positive number');
          }

          // Duplicate check against existing store products (safe against undefined sku/name)
          const effectiveSkuForCheck =
            sku || `SKU-${name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase() || idx + 1}`;
          const normalizedSkuForCheck = effectiveSkuForCheck.toLowerCase();
          const matchedBySku = existingProducts.find(
            (p) =>
              p.storeId === activeStore.id &&
              Boolean(p.sku) &&
              String(p.sku).toLowerCase().trim() === normalizedSkuForCheck
          );
          const matchedByName = existingProducts.find(
            (p) =>
              p.storeId === activeStore.id &&
              Boolean(p.name) &&
              String(p.name).toLowerCase().trim() === name.toLowerCase()
          );
          const matchedExisting = matchedBySku || matchedByName;

          // Validation 2B: Delivery Charge
          let resolvedDeliveryCharge = 0;
          if (deliveryChargeInput !== '') {
            const numericDelivery = Number(deliveryChargeInput.replace(/[^0-9.]/g, ''));
            if (isNaN(numericDelivery) || numericDelivery < 0) {
              errors.push('Delivery charge must be a valid non-negative number');
            } else {
              resolvedDeliveryCharge = numericDelivery;
            }
          } else if (matchedExisting) {
            resolvedDeliveryCharge = matchedExisting.deliveryCharge ?? 0;
          } else {
            resolvedDeliveryCharge = 0;
          }

          // Validation 3: Category
          const resolvedCat = resolveCategoryFromInput(categoryInput) || AUTHORITATIVE_STORE_CATEGORIES[0];
          if (!categoryInput) {
            warnings.push(`Category missing — defaulted to "${resolvedCat.name}"`);
          } else if (!resolveCategoryFromInput(categoryInput)) {
            warnings.push(`Category "${categoryInput}" not recognized — matched to "${resolvedCat.name}"`);
          }

          // Validation 4: Stock
          let resolvedStock = 10;
          if (stockInput) {
            const numStock = Number(stockInput.replace(/[^0-9.]/g, ''));
            if (isNaN(numStock) || numStock < 0) {
              errors.push('Stock quantity must be a non-negative number');
            } else {
              resolvedStock = Math.floor(numStock);
            }
          } else {
            warnings.push('Stock not specified — defaulted to 10 units');
          }

          // Validation 5: Image URL
          if (customImageUrl && !isValidImageUrl(customImageUrl)) {
            errors.push('Image URL must start with http:// or https://');
          }

          // Validation 6: Duplicate SKUs within file
          const effectiveSku = effectiveSkuForCheck;
          const normalizedSku = effectiveSku.toLowerCase();

          if (sku && fileSkuTracker.has(normalizedSku)) {
            errors.push(`Duplicate SKU "${sku}" found multiple times in spreadsheet`);
          } else if (sku) {
            fileSkuTracker.add(normalizedSku);
          }

          if (importMode === 'ADD_NEW' && matchedExisting) {
            warnings.push(
              `Item already exists in store ("${matchedExisting.name}") — existing listing will be updated`
            );
          } else if (importMode === 'UPDATE_EXISTING' && !matchedExisting) {
            warnings.push(
              `No existing store product matched SKU "${effectiveSku}" — will be added as a new product`
            );
          }

          // Split variants
          const resolvedVariants = variantsInput
            ? variantsInput.split(/[;,]/).map((v) => v.trim()).filter(Boolean)
            : ['Standard'];

          const isValid = errors.length === 0;
          const hasWarning = warnings.length > 0;

          parsed.push({
            rowNumber: rowNum,
            raw: {
              'Product Name': name,
              'Category': categoryInput,
              'Price': priceInput,
              'SKU': sku,
              'Stock': stockInput,
              'Unit': unit,
              'Description': description,
            },
            name,
            categoryInput,
            priceInput,
            deliveryChargeInput,
            sku: effectiveSku,
            stockInput,
            unit: unit || 'Pcs',
            description,
            dimensions,
            materials,
            variantsInput,
            customImageUrl,
            productStatus,
            isValid,
            hasWarning,
            errors,
            warnings,
            resolvedCategory: resolvedCat,
            resolvedPrice: numericPrice || 0,
            resolvedDeliveryCharge,
            resolvedStock,
            resolvedVariants,
            matchedExistingProduct: matchedExisting,
          });
        });

        if (parsed.length === 0) {
          setFileReadError('No valid product rows were found in the uploaded file.');
          return;
        }

        setParsedRows(parsed);
        setStep('PREVIEW_VALIDATE');
      } catch (err) {
        setFileReadError(
          err instanceof Error
            ? `Failed to parse CSV file: ${err.message}`
            : 'Failed to parse file. Please ensure it is a valid UTF-8 formatted CSV file.'
        );
      }
    };

    reader.readAsText(file);
  };

  // Drag & Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processUploadedFile(e.dataTransfer.files[0]);
    }
  };

  // Preview Row Calculations
  const validRows = useMemo(() => parsedRows.filter((r) => r.isValid), [parsedRows]);
  const errorRows = useMemo(() => parsedRows.filter((r) => !r.isValid), [parsedRows]);
  const warningRows = useMemo(() => parsedRows.filter((r) => r.hasWarning && r.isValid), [parsedRows]);

  const filteredPreviewRows = useMemo(() => {
    if (previewFilter === 'ERRORS_ONLY') return parsedRows.filter((r) => !r.isValid || r.hasWarning);
    if (previewFilter === 'VALID_ONLY') return parsedRows.filter((r) => r.isValid);
    return parsedRows;
  }, [parsedRows, previewFilter]);

  const netNewValidCount = useMemo(
    () => validRows.filter((r) => !r.matchedExistingProduct).length,
    [validRows]
  );

  const canExecuteImport =
    validRows.length > 0 &&
    (quotaStatus.isUnlimited ||
      netNewValidCount <= quotaStatus.remaining ||
      quotaStatus.remaining > 0 ||
      validRows.some((r) => Boolean(r.matchedExistingProduct)));

  // Execute Bulk Upload via Server API Endpoint
  const handleExecuteImport = async () => {
    if (!canExecuteImport) return;

    setFileReadError(null);
    setStep('IMPORTING_PROGRESS');
    setIsImporting(true);
    setImportProgressPercent(10);
    setImportStatusMessage('Preparing bulk product payload...');

    const productsToUploadPayload = validRows.map((row) => ({
      sku: row.sku,
      name: row.name,
      categoryId: row.resolvedCategory?.id || AUTHORITATIVE_STORE_CATEGORIES[0].id,
      category: row.resolvedCategory?.name || AUTHORITATIVE_STORE_CATEGORIES[0].name,
      price: row.resolvedPrice,
      deliveryCharge: row.resolvedDeliveryCharge ?? 0,
      unit: row.unit,
      stock: row.resolvedStock,
      description: row.description,
      dimensions: row.dimensions,
      materials: row.materials,
      variants: row.resolvedVariants,
      customImageUrl: row.customImageUrl || undefined,
    }));

    try {
      setImportProgressPercent(35);
      setImportStatusMessage(`Submitting ${productsToUploadPayload.length} verified products to database...`);

      const headers = await buildAuthenticatedHeaders();
      const res = await fetch('/api/products/bulk-upload', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sellerId: activeSellerId,
          storeId: activeStore.id,
          ownerUid,
          mode: importMode,
          planId: quotaStatus.planId,
          store: activeStore,
          items: productsToUploadPayload,
        }),
      });

      setImportProgressPercent(85);
      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Server error processing bulk product upload.');
      }

      setImportProgressPercent(100);
      setImportStatusMessage('Upload complete!');
      setIsImporting(false);

      const committedList = (data.committedProducts || []) as Product[];

      setImportReport({
        createdCount: data.createdCount || 0,
        updatedCount: data.updatedCount || 0,
        skippedCount: data.skippedCount || 0,
        failedCount: data.failedCount || 0,
        errors: data.errors || [],
        committedProducts: committedList,
      });

      if (committedList.length > 0) {
        onImportComplete(committedList);
      }

      setStep('IMPORT_SUMMARY');
    } catch (err) {
      setIsImporting(false);
      setImportProgressPercent(0);
      setFileReadError(err instanceof Error ? err.message : 'Failed to complete bulk upload.');
      setStep('PREVIEW_VALIDATE');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-upload-dialog-heading"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto"
    >
      <div className="relative w-full max-w-4xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden my-6 flex flex-col max-h-[92vh]">
        {/* Modal Top Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between gap-4 shrink-0">
          <div className="space-y-0.5">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-[#003B8E]">
              <FileSpreadsheet className="w-4 h-4" />
              <span>Seller Inventory Studio</span>
              <span aria-hidden="true">·</span>
              <span className="text-slate-600 font-normal">Store: {activeStore.name}</span>
            </div>
            <h2 id="bulk-upload-dialog-heading" className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Bulk Product Upload (Excel / CSV)
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close bulk upload modal"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Workflow Progress Steps Bar */}
        <div className="px-6 py-3 bg-slate-100/70 border-b border-slate-200/80 flex items-center justify-between gap-2 overflow-x-auto text-xs shrink-0">
          {[
            { id: 'UPLOAD_FILE', label: '1. Select File & Mode', icon: Upload },
            { id: 'PREVIEW_VALIDATE', label: '2. Preview & Validate', icon: Eye },
            { id: 'IMPORTING_PROGRESS', label: '3. Progress & Sync', icon: Loader2 },
            { id: 'IMPORT_SUMMARY', label: '4. Summary Report', icon: ShieldCheck },
          ].map((sStep) => {
            const Icon = sStep.icon;
            const isActive = step === sStep.id;
            return (
              <div
                key={sStep.id}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                  isActive ? 'bg-[#003B8E] text-white shadow-2xs' : 'text-slate-600 bg-transparent'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive && sStep.id === 'IMPORTING_PROGRESS' ? 'animate-spin' : ''}`} />
                <span>{sStep.label}</span>
              </div>
            );
          })}
        </div>

        {/* Scrollable Main Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 custom-scrollbar">
          {/* STEP 1: UPLOAD FILE & IMPORT MODE */}
          {step === 'UPLOAD_FILE' && (
            <div className="space-y-6">
              {/* Active Quota Banner */}
              <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-blue-950">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 text-[#003B8E] flex items-center justify-center shrink-0">
                    <Store className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">
                      Catalog Quota Status — {quotaStatus.planName} Plan
                    </div>
                    <div className="text-slate-600">
                      {quotaStatus.isUnlimited
                        ? 'Unlimited products listing enabled.'
                        : `Currently listed: ${quotaStatus.currentCount} / ${quotaStatus.maxAllowed} allowed items.`}
                    </div>
                  </div>
                </div>

                {!quotaStatus.isUnlimited && (
                  <div className="text-right shrink-0">
                    <span className="font-mono font-bold text-slate-900">
                      {quotaStatus.remaining} items remaining
                    </span>
                  </div>
                )}
              </div>

              {/* Import Mode Selection */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Select Import Behavior
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setImportMode('ADD_NEW')}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                      importMode === 'ADD_NEW'
                        ? 'border-[#003B8E] bg-blue-50/50 ring-2 ring-[#003B8E]/20 shadow-2xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-sm text-slate-900">
                      <span>Mode A — Add New Products</span>
                      {importMode === 'ADD_NEW' && <Check className="w-4 h-4 text-[#003B8E]" />}
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      Adds new products to your store catalog. Existing products matching duplicate SKUs or names will be safely skipped.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setImportMode('UPDATE_EXISTING')}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                      importMode === 'UPDATE_EXISTING'
                        ? 'border-[#003B8E] bg-blue-50/50 ring-2 ring-[#003B8E]/20 shadow-2xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-sm text-slate-900">
                      <span>Mode B — Update Existing Items</span>
                      {importMode === 'UPDATE_EXISTING' && <Check className="w-4 h-4 text-[#003B8E]" />}
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      Matches existing store products by SKU or ID and updates price, stock, and descriptions without duplicating items.
                    </p>
                  </button>
                </div>
              </div>

              {/* Step 1 Sample Template Download Action Card */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-[#003B8E]" />
                    <span>Download Official Spreadsheet Template</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Pre-populated with required headers, Citykart categories, and sample rows for instant upload.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-4 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-bold transition-colors inline-flex items-center justify-center gap-2 cursor-pointer shrink-0 shadow-2xs"
                >
                  <Download className="w-4 h-4 text-[#003B8E]" />
                  <span>Download Sample Template (.CSV)</span>
                </button>
              </div>

              {/* Drag & Drop File Selection Dropzone */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Upload Product Spreadsheet
                </label>

                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
                    dragActive
                      ? 'border-[#003B8E] bg-blue-50/80 scale-[1.01]'
                      : 'border-slate-300 bg-slate-50/50 hover:border-[#003B8E] hover:bg-slate-100/50'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        processUploadedFile(e.target.files[0]);
                      }
                    }}
                  />

                  <div className="w-12 h-12 rounded-2xl bg-blue-100/80 text-[#003B8E] flex items-center justify-center mx-auto mb-3">
                    <Upload className="w-6 h-6" />
                  </div>

                  <div className="text-sm font-bold text-slate-900">
                    Click to choose file or drag and drop here
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Supports .CSV or .XLSX spreadsheets up to 10MB (max 500 products per batch)
                  </div>
                </div>

                {fileReadError && (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <span>{fileReadError}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: PREVIEW & VALIDATION TABLE */}
          {step === 'PREVIEW_VALIDATE' && (
            <div className="space-y-5">
              {/* Top File Summary Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-[#003B8E]" />
                    <span>{selectedFile?.name || 'Uploaded File'}</span>
                    <span className="font-mono text-slate-500">({parsedRows.length} total rows)</span>
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    Mode: <strong className="text-slate-900">{importMode === 'ADD_NEW' ? 'Add New Products' : 'Update Existing Items'}</strong>
                  </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('ALL')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                      previewFilter === 'ALL' ? 'bg-[#003B8E] text-white' : 'bg-white border border-slate-200 text-slate-700'
                    }`}
                  >
                    All ({parsedRows.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('VALID_ONLY')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                      previewFilter === 'VALID_ONLY' ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-700'
                    }`}
                  >
                    Valid ({validRows.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('ERRORS_ONLY')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                      previewFilter === 'ERRORS_ONLY' ? 'bg-amber-600 text-white' : 'bg-white border border-slate-200 text-slate-700'
                    }`}
                  >
                    Issues ({errorRows.length + warningRows.length})
                  </button>
                </div>
              </div>

              {/* Error Banner if API or validation failed */}
              {fileReadError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{fileReadError}</span>
                </div>
              )}

              {/* Quota Warning Banner if net-new rows exceed remaining plan limit */}
              {!quotaStatus.isUnlimited && netNewValidCount > quotaStatus.remaining && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <span>
                    Your current <strong>{quotaStatus.planName}</strong> allows {quotaStatus.maxAllowed} active products ({quotaStatus.remaining} new slots remaining). Up to {quotaStatus.remaining} new products and all existing product updates will be imported.
                  </span>
                </div>
              )}

              {/* Error Report Download Banner */}
              {(errorRows.length > 0 || warningRows.length > 0) && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3 text-xs text-amber-950">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>
                      {errorRows.length > 0
                        ? `${errorRows.length} rows have blocking errors and will be skipped during import.`
                        : `${warningRows.length} rows have non-blocking notes and are ready to import.`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadErrorReport}
                    className="px-3 py-1.5 rounded-lg bg-amber-900 hover:bg-amber-950 text-white font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Report (.CSV)</span>
                  </button>
                </div>
              )}

              {/* Validation Preview Table */}
              <div className="border border-slate-200 rounded-xl overflow-x-auto bg-white max-h-[380px] custom-scrollbar">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 font-bold text-slate-800">
                    <tr>
                      <th className="p-3 w-12 text-center">Row</th>
                      <th className="p-3 w-20">Status</th>
                      <th className="p-3">Product Name &amp; SKU</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Price</th>
                      <th className="p-3">Delivery Fee</th>
                      <th className="p-3">Stock</th>
                      <th className="p-3">Validation Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-700">
                    {filteredPreviewRows.map((row) => (
                      <tr key={row.rowNumber} className={!row.isValid ? 'bg-red-50/40' : row.hasWarning ? 'bg-amber-50/30' : ''}>
                        <td className="p-3 font-mono text-center font-bold text-slate-500">{row.rowNumber}</td>
                        <td className="p-3">
                          {row.isValid ? (
                            row.hasWarning ? (
                              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                                Warning
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                Valid
                              </span>
                            )
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 text-[10px] font-bold">
                              Error
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-slate-900">{row.name || '(Missing Name)'}</div>
                          <div className="text-[11px] font-mono text-slate-500">SKU: {row.sku}</div>
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-slate-800">
                            {row.resolvedCategory?.name || 'Unmapped'}
                          </div>
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-900">
                          ₹{row.resolvedPrice || 0}
                        </td>
                        <td className="p-3 font-mono text-slate-800">
                          {row.resolvedDeliveryCharge && row.resolvedDeliveryCharge > 0 ? (
                            <span className="font-bold text-slate-900">₹{row.resolvedDeliveryCharge}</span>
                          ) : (
                            <span className="text-emerald-700 font-bold">Free</span>
                          )}
                        </td>
                        <td className="p-3 font-mono">
                          {row.resolvedStock || 0} {row.unit}
                        </td>
                        <td className="p-3 space-y-1 max-w-xs">
                          {row.errors.map((err, i) => (
                            <div key={i} className="text-[11px] font-medium text-red-700 flex items-start gap-1">
                              <span>• {err}</span>
                            </div>
                          ))}
                          {row.warnings.map((warn, i) => (
                            <div key={i} className="text-[11px] font-medium text-amber-800 flex items-start gap-1">
                              <span>• {warn}</span>
                            </div>
                          ))}
                          {row.isValid && !row.hasWarning && (
                            <div className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> Ready to import
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 3: IMPORTING PROGRESS */}
          {step === 'IMPORTING_PROGRESS' && (
            <div className="py-12 px-4 text-center space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 text-[#003B8E] flex items-center justify-center mx-auto shadow-inner animate-bounce">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900">
                  Syncing products to your store...
                </h3>
                <p className="text-xs text-slate-600 max-w-md mx-auto">
                  {importStatusMessage}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full max-w-md mx-auto bg-slate-200 h-3 rounded-full overflow-hidden p-0.5">
                <div
                  className="bg-[#003B8E] h-full rounded-full transition-all duration-300"
                  style={{ width: `${importProgressPercent}%` }}
                />
              </div>

              <div className="text-xs font-mono font-bold text-[#003B8E]">
                {importProgressPercent}% Completed
              </div>
            </div>
          )}

          {/* STEP 4: IMPORT SUMMARY REPORT */}
          {step === 'IMPORT_SUMMARY' && importReport && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-4 text-emerald-950">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Bulk Upload Successfully Completed!</h3>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    Your store inventory in {activeStore.cityName} has been updated.
                  </p>
                </div>
              </div>

              {/* Stats Breakdown Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
                  <div className="text-2xl font-extrabold text-emerald-600 font-mono">
                    {importReport.createdCount}
                  </div>
                  <div className="text-xs font-bold text-slate-700 mt-0.5">New Products Created</div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
                  <div className="text-2xl font-extrabold text-blue-600 font-mono">
                    {importReport.updatedCount}
                  </div>
                  <div className="text-xs font-bold text-slate-700 mt-0.5">Products Updated</div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
                  <div className="text-2xl font-extrabold text-amber-600 font-mono">
                    {importReport.skippedCount}
                  </div>
                  <div className="text-xs font-bold text-slate-700 mt-0.5">Duplicates Skipped</div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
                  <div className="text-2xl font-extrabold text-red-600 font-mono">
                    {importReport.failedCount}
                  </div>
                  <div className="text-xs font-bold text-slate-700 mt-0.5">Rows Failed</div>
                </div>
              </div>

              {/* Imported Products Preview Grid */}
              {importReport.committedProducts.length > 0 && (
                <div className="space-y-3">
                  <div className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                    Newly Added / Updated Store Products
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-56 overflow-y-auto custom-scrollbar p-1">
                    {importReport.committedProducts.slice(0, 10).map((prod) => (
                      <div key={prod.id} className="p-3 rounded-xl border border-slate-200 bg-white flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-slate-200">
                          <ProductStudioArtwork
                            preset={prod.artworkPreset}
                            customImageUrl={prod.customImageUrl}
                            alt={prod.name}
                            className="w-full h-full"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-slate-900 truncate">{prod.name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            ₹{prod.price} · {prod.stock} {prod.unit}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Bottom Action Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between gap-4 shrink-0">
          {step === 'UPLOAD_FILE' && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <div className="text-xs text-slate-500 italic">Select a .CSV file to continue</div>
            </>
          )}

          {step === 'PREVIEW_VALIDATE' && (
            <>
              <button
                type="button"
                onClick={() => {
                  setParsedRows([]);
                  setSelectedFile(null);
                  setStep('UPLOAD_FILE');
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Re-upload File</span>
              </button>

              <button
                type="button"
                disabled={!canExecuteImport}
                onClick={handleExecuteImport}
                className="px-6 py-2.5 rounded-xl bg-[#F96302] hover:bg-[#E05500] disabled:bg-slate-300 text-white text-xs font-bold transition-colors inline-flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <Upload className="w-4 h-4" />
                <span>Confirm &amp; Upload {validRows.length} Products</span>
              </button>
            </>
          )}

          {step === 'IMPORT_SUMMARY' && (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-[#003B8E] hover:bg-[#002D6E] text-white text-xs font-bold transition-colors inline-flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <Check className="w-4 h-4" />
                <span>Done &amp; View Store Inventory</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
