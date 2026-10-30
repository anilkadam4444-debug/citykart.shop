import {
  CountryDef,
  RegionDef,
  DistrictDef,
  CityDef,
  GLOBAL_COUNTRIES,
  GLOBAL_REGIONS,
  GLOBAL_DISTRICTS,
  CURATED_CANONICAL_CITIES,
  normalizeCanonicalLocationId,
} from './global-locations-data';

export const MISSING_LOCATIONS_STORAGE_KEY = 'urbandirect_missing_location_requests_v1';
export const APPROVED_CUSTOM_CITIES_STORAGE_KEY = 'urbandirect_approved_custom_cities_v1';

export interface MissingLocationRequest {
  id: string;
  country: string;
  countryCode: string;
  stateRegion: string;
  cityName: string;
  district?: string;
  postalCode?: string;
  localityType?: 'CITY' | 'TOWN' | 'VILLAGE' | 'LOCALITY';
  requesterRole: 'BUYER' | 'SELLER' | 'ADMIN';
  requesterPhone?: string;
  notes?: string;
  canonicalCityId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

export function getAllCountries(): CountryDef[] {
  return GLOBAL_COUNTRIES;
}

export function getCountryByCodeOrName(identifier?: string | null): CountryDef | undefined {
  if (!identifier) return undefined;
  const clean = identifier.trim().toLowerCase();
  return GLOBAL_COUNTRIES.find(
    (c) => c.code.toLowerCase() === clean || c.name.toLowerCase() === clean
  );
}

export function getRegionsByCountry(countryCodeOrName?: string | null): RegionDef[] {
  if (!countryCodeOrName) return [];
  const country = getCountryByCodeOrName(countryCodeOrName);
  if (!country) return [];
  return GLOBAL_REGIONS.filter(
    (r) => r.countryCode.toLowerCase() === country.code.toLowerCase()
  );
}

export function getRegionByCodeOrName(
  countryCodeOrName: string,
  regionCodeOrName?: string | null
): RegionDef | undefined {
  if (!regionCodeOrName) return undefined;
  const regions = getRegionsByCountry(countryCodeOrName);
  const clean = regionCodeOrName.trim().toLowerCase();
  return regions.find(
    (r) => r.code.toLowerCase() === clean || r.name.toLowerCase() === clean
  );
}

export function getDistrictsByCountryAndRegion(
  countryCodeOrName?: string | null,
  regionCodeOrName?: string | null
): DistrictDef[] {
  if (!countryCodeOrName || !regionCodeOrName) return [];
  const country = getCountryByCodeOrName(countryCodeOrName);
  if (!country) return [];

  const region = getRegionByCodeOrName(country.code, regionCodeOrName);
  const cleanRegionName = (region ? region.name : regionCodeOrName).trim().toLowerCase();

  // 1. Static pre-defined districts
  const staticDistricts = GLOBAL_DISTRICTS.filter(
    (d) =>
      d.countryCode.toLowerCase() === country.code.toLowerCase() &&
      d.stateRegion.toLowerCase() === cleanRegionName
  );

  // 2. Discover districts embedded within curated and custom-approved cities
  const customApproved = loadCustomApprovedCities();
  const combinedCities = [...CURATED_CANONICAL_CITIES, ...customApproved];
  const derivedDistrictNames = new Set<string>();
  const dedupedDistricts: DistrictDef[] = [];

  for (const d of staticDistricts) {
    const dLower = d.name.toLowerCase();
    if (!derivedDistrictNames.has(dLower)) {
      derivedDistrictNames.add(dLower);
      dedupedDistricts.push(d);
    }
  }

  for (const c of combinedCities) {
    if (
      (c.countryCode.toLowerCase() === country.code.toLowerCase() ||
        c.country.toLowerCase() === country.name.toLowerCase()) &&
      c.stateRegion.toLowerCase() === cleanRegionName &&
      c.district &&
      c.district.trim()
    ) {
      const dName = c.district.trim();
      const dLower = dName.toLowerCase();
      if (!derivedDistrictNames.has(dLower)) {
        derivedDistrictNames.add(dLower);
        dedupedDistricts.push({
          code: `${country.code}-${dLower.replace(/\s+/g, '-').substring(0, 10)}`,
          name: dName,
          stateRegion: c.stateRegion,
          countryCode: country.code,
          districtType: country.districtLabel || 'District',
        });
      }
    }
  }

  return dedupedDistricts;
}

export function loadCustomApprovedCities(): CityDef[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(APPROVED_CUSTOM_CITIES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCustomApprovedCity(city: CityDef): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = loadCustomApprovedCities();
    if (!existing.some((c) => c.cityId === city.cityId)) {
      const updated = [city, ...existing];
      window.localStorage.setItem(APPROVED_CUSTOM_CITIES_STORAGE_KEY, JSON.stringify(updated));
    }
  } catch {}
}

export function loadMissingLocationRequests(): MissingLocationRequest[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(MISSING_LOCATIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveMissingLocationRequest(req: MissingLocationRequest): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = loadMissingLocationRequests();
    const updated = [req, ...existing.filter((r) => r.id !== req.id)];
    window.localStorage.setItem(MISSING_LOCATIONS_STORAGE_KEY, JSON.stringify(updated));

    // Only record into custom approved cities when explicitly approved by Super Admin / Admin
    if (
      req.status === 'APPROVED' &&
      !isVillageOrTalukaPlace(req.localityType, req.cityName, req.district)
    ) {
      saveCustomApprovedCity({
        cityId: req.canonicalCityId,
        cityName: req.cityName,
        stateRegion: req.stateRegion,
        country: req.country,
        countryCode: req.countryCode,
        district: req.district,
        postalCode: req.postalCode,
        localityType: req.localityType || 'CITY',
        defaultLocality: req.cityName,
      });
    }
  } catch {}
}

/**
 * Detects if a location is classified as a village, hamlet, or taluka/sub-district administrative unit.
 */
export function isVillageOrTalukaPlace(
  localityType?: string,
  cityName?: string,
  districtName?: string
): boolean {
  if (localityType === 'VILLAGE') return true;

  const cleanCity = (cityName || '').trim().toLowerCase();
  const cleanDistrict = (districtName || '').trim().toLowerCase();

  const villageKeywords = ['village', 'gram', 'hamlet', 'gaon', 'grama', 'wadi', 'palli'];
  const talukaKeywords = ['taluka', 'tehsil', 'mouzah', 'sub-district', 'subdistrict', 'block', 'mandal'];

  for (const kw of villageKeywords) {
    if (cleanCity.includes(` ${kw}`) || cleanCity.startsWith(`${kw} `) || cleanCity === kw) {
      return true;
    }
  }

  for (const kw of talukaKeywords) {
    if (cleanCity.includes(` ${kw}`) || cleanCity.startsWith(`${kw} `) || cleanCity === kw) {
      return true;
    }
  }

  return false;
}

/**
 * Validates whether a location is eligible for seller onboarding.
 * Policy: Seller onboarding is open to large and medium-sized cities worldwide.
 * Taluka and village locations are not allowed yet.
 */
export function validateSellerLocationEligibility(location: {
  localityType?: string;
  cityName?: string;
  district?: string;
}): { eligible: boolean; reason?: string } {
  if (isVillageOrTalukaPlace(location.localityType, location.cityName, location.district)) {
    return {
      eligible: false,
      reason:
        'Seller onboarding is currently open to large and medium-sized cities worldwide. Onboarding for villages and talukas is not enabled yet. Please select your nearest large or medium city hub.',
    };
  }
  return { eligible: true };
}

export function getCitiesByCountryRegionAndDistrict(
  countryCodeOrName?: string | null,
  regionCodeOrName?: string | null,
  districtName?: string | null,
  searchQuery?: string,
  forSellerOnboarding?: boolean
): CityDef[] {
  if (!countryCodeOrName) return [];
  const country = getCountryByCodeOrName(countryCodeOrName);
  if (!country) return [];

  const customApproved = loadCustomApprovedCities();
  const combined = [...CURATED_CANONICAL_CITIES, ...customApproved];

  const cleanCountry = country.name.toLowerCase();
  const cleanCode = country.code.toLowerCase();

  const region = regionCodeOrName
    ? getRegionByCodeOrName(country.code, regionCodeOrName)
    : undefined;
  const cleanRegion = (region ? region.name : regionCodeOrName || '').toLowerCase().trim();
  const cleanDistrict = (districtName || '').toLowerCase().trim();

  let filtered = combined.filter((c) => {
    if (c.localityType === 'VILLAGE' || isVillageOrTalukaPlace(c.localityType, c.cityName, c.district)) {
      return false;
    }

    const matchCountry =
      c.country.toLowerCase() === cleanCountry ||
      c.countryCode.toLowerCase() === cleanCode;

    if (!matchCountry) return false;
    if (cleanRegion && c.stateRegion.toLowerCase() !== cleanRegion && region?.code && c.stateRegion.toLowerCase() !== region.code.toLowerCase()) {
      return false;
    }

    if (cleanDistrict) {
      const cityDistrict = (c.district || '').toLowerCase().trim();
      if (cityDistrict && !cityDistrict.includes(cleanDistrict) && !cleanDistrict.includes(cityDistrict)) {
        return false;
      }
    }

    return true;
  });

  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    filtered = filtered.filter(
      (c) =>
        c.cityName.toLowerCase().includes(q) ||
        (c.district && c.district.toLowerCase().includes(q)) ||
        (c.postalCode && c.postalCode.toLowerCase().includes(q))
    );
  }

  // Deduplicate by cityId
  const seen = new Set<string>();
  const deduped: CityDef[] = [];
  for (const c of filtered) {
    if (!seen.has(c.cityId)) {
      seen.add(c.cityId);
      deduped.push(c);
    }
  }

  return deduped;
}

export function getCitiesByCountryAndRegion(
  countryCodeOrName?: string | null,
  regionCodeOrName?: string | null,
  searchQuery?: string,
  forSellerOnboarding?: boolean
): CityDef[] {
  return getCitiesByCountryRegionAndDistrict(
    countryCodeOrName,
    regionCodeOrName,
    undefined,
    searchQuery,
    forSellerOnboarding
  );
}

/**
 * Validates and matches a store against a customer's shopping location.
 * Strictly uses canonical cityId matching while ensuring country and state alignment.
 */
export function isStoreCanonicalLocationMatch(
  store: {
    cityId?: string;
    cityName?: string;
    stateRegion?: string;
    country?: string;
    countryCode?: string;
    servedCityIds?: string[];
  },
  buyerLocation: {
    cityId?: string;
    city?: string;
    stateRegion?: string;
    country?: string;
    countryCode?: string;
  }
): boolean {
  if (!buyerLocation.city || !buyerLocation.country) return false;

  const targetCityId =
    buyerLocation.cityId ||
    normalizeCanonicalLocationId(
      buyerLocation.country,
      buyerLocation.stateRegion || buyerLocation.country,
      buyerLocation.city
    );

  // 1. Direct canonical city ID match
  if (store.cityId && store.cityId === targetCityId) {
    return true;
  }

  // 2. Direct servedCityIds cross-city configured coverage
  if (store.servedCityIds && store.servedCityIds.includes(targetCityId)) {
    return true;
  }

  // 3. Fallback: normalized triplet matching
  const storeGeneratedId = normalizeCanonicalLocationId(
    store.country || '',
    store.stateRegion || store.country || '',
    store.cityName || ''
  );

  return storeGeneratedId === targetCityId;
}

export function normalizeCityToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizeCityId(
  country: string,
  stateRegion: string,
  cityName: string,
  district?: string
): string {
  const c = normalizeCityToken(country || 'global');
  const s = normalizeCityToken(stateRegion || 'region');
  const city = normalizeCityToken(cityName || 'city');
  void district;
  return `${c}-${s}-${city}`;
}

export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function resolveNearestCityFromCoordinates(
  lat: number,
  lng: number
): {
  cityRecord: CityDef;
  distanceKm: number;
  isUncertain: boolean;
} {
  let closest = CURATED_CANONICAL_CITIES[0];
  let minDistance = Infinity;

  for (const record of CURATED_CANONICAL_CITIES) {
    if (!record.coordinates) continue;
    const dist = calculateDistanceKm(
      lat,
      lng,
      record.coordinates.lat,
      record.coordinates.lng
    );
    if (dist < minDistance) {
      minDistance = dist;
      closest = record;
    }
  }

  return {
    cityRecord: closest,
    distanceKm: Math.round(minDistance * 10) / 10,
    isUncertain: minDistance > 40,
  };
}

