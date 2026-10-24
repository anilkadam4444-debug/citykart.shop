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
  const derivedDistrictNames = new Set<string>(staticDistricts.map((d) => d.name.toLowerCase()));
  const extraDistricts: DistrictDef[] = [];

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
        extraDistricts.push({
          code: `${country.code}-${dLower.replace(/\s+/g, '-').substring(0, 10)}`,
          name: dName,
          stateRegion: c.stateRegion,
          countryCode: country.code,
          districtType: country.districtLabel || 'District',
        });
      }
    }
  }

  return [...staticDistricts, ...extraDistricts];
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

    // Also auto-record into custom approved cities so user can immediately proceed
    saveCustomApprovedCity({
      cityId: req.canonicalCityId,
      cityName: req.cityName,
      stateRegion: req.stateRegion,
      country: req.country,
      countryCode: req.countryCode,
      district: req.district,
      postalCode: req.postalCode,
      localityType: req.localityType || 'TOWN',
      defaultLocality: req.cityName,
    });
  } catch {}
}

export function getCitiesByCountryRegionAndDistrict(
  countryCodeOrName?: string | null,
  regionCodeOrName?: string | null,
  districtName?: string | null,
  searchQuery?: string
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
  searchQuery?: string
): CityDef[] {
  return getCitiesByCountryRegionAndDistrict(countryCodeOrName, regionCodeOrName, undefined, searchQuery);
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
