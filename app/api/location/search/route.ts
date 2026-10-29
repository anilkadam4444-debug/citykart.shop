import {NextRequest, NextResponse} from 'next/server';
import {
  GLOBAL_CITY_DIRECTORY,
  normalizeCityId,
} from '@/lib/catalog-data';
import {isVillageOrTalukaPlace} from '@/lib/location-service';

export interface PlaceSuggestion {
  placeId: string;
  cityName: string;
  district: string;
  stateRegion: string;
  country: string;
  countryCode: string;
  postalCode: string;
  localityType: 'CITY' | 'TOWN' | 'VILLAGE' | 'LOCALITY';
  defaultLocality: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  source: 'VERIFIED_DIRECTORY' | 'GEOCODED';
  eligibleForSeller?: boolean;
}

export async function GET(req: NextRequest) {
  const {searchParams} = new URL(req.url);
  const q = (searchParams.get('q') || '').trim();
  const countryFilter = (searchParams.get('country') || '').trim().toLowerCase();
  const forSeller = searchParams.get('forSeller') === 'true' || searchParams.get('role') === 'SELLER';

  if (!q) {
    return NextResponse.json({suggestions: []});
  }

  const lowerQ = q.toLowerCase();
  const results: PlaceSuggestion[] = [];
  const seenIds = new Set<string>();

  // 1. Search built-in global directory of cities, districts, towns
  for (const item of GLOBAL_CITY_DIRECTORY) {
    if (
      countryFilter &&
      item.country.toLowerCase() !== countryFilter &&
      item.countryCode.toLowerCase() !== countryFilter
    ) {
      continue;
    }

    if (forSeller && (item.localityType === 'VILLAGE' || isVillageOrTalukaPlace(item.localityType, item.cityName, item.district))) {
      continue;
    }

    const hay = `${item.cityName} ${item.district || ''} ${item.stateRegion} ${item.country} ${item.postalCode || ''} ${item.defaultLocality}`.toLowerCase();
    if (hay.includes(lowerQ)) {
      seenIds.add(item.cityId);
      results.push({
        placeId: item.cityId,
        cityName: item.cityName,
        district: item.district || '',
        stateRegion: item.stateRegion,
        country: item.country,
        countryCode: item.countryCode,
        postalCode: item.postalCode || '',
        localityType: item.localityType || 'CITY',
        defaultLocality: item.defaultLocality,
        coordinates: item.coordinates,
        source: 'VERIFIED_DIRECTORY',
      });
    }
  }

  // 2. Query OpenStreetMap Nominatim for worldwide towns, villages, districts, and postal codes
  try {
    const queryWithCountry = countryFilter ? `${q}, ${countryFilter}` : q;
    const nomRes = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&q=${encodeURIComponent(
        queryWithCountry
      )}`,
      {
        headers: {
          'User-Agent': 'UrbanDirectGlobalStoreRegistration/1.0',
          'Accept-Language': 'en',
        },
        signal: AbortSignal.timeout(4000),
      }
    );

    if (nomRes.ok) {
      const nomData = await nomRes.json();
      if (Array.isArray(nomData)) {
        for (const row of nomData) {
          const addr = row?.address;
          if (!addr) continue;

          const localityName =
            addr.city ||
            addr.town ||
            addr.village ||
            addr.municipality ||
            addr.hamlet ||
            addr.suburb ||
            row.name;
          const countryName = addr.country;
          if (!localityName || !countryName) continue;

          const stateRegion =
            addr.state || addr.region || addr.province || countryName;
          const district =
            addr.state_district || addr.county || addr.district || '';
          const postalCode = addr.postcode || '';
          const countryCode = String(addr.country_code || '').toUpperCase();

          const placeId = normalizeCityId(
            countryName,
            stateRegion,
            localityName
          );
          if (seenIds.has(placeId)) continue;
          seenIds.add(placeId);

          const localityType: 'CITY' | 'TOWN' | 'VILLAGE' | 'LOCALITY' =
            addr.village || addr.hamlet
              ? 'VILLAGE'
              : addr.town
                ? 'TOWN'
                : addr.city
                  ? 'CITY'
                  : 'LOCALITY';

          if (forSeller && (localityType === 'VILLAGE' || isVillageOrTalukaPlace(localityType, localityName, district))) {
            continue;
          }

          const lat = Number(row.lat);
          const lng = Number(row.lon);

          results.push({
            placeId,
            cityName: String(localityName).trim(),
            district: String(district).trim(),
            stateRegion: String(stateRegion).trim(),
            country: String(countryName).trim(),
            countryCode,
            postalCode: String(postalCode).trim(),
            localityType,
            defaultLocality: String(
              addr.suburb || addr.neighbourhood || localityName
            ).trim(),
            coordinates:
              Number.isFinite(lat) && Number.isFinite(lng)
                ? {lat, lng}
                : undefined,
            source: 'GEOCODED',
          });
        }
      }
    }
  } catch {
    // Do not block registration if external geocoding/search is unreachable
  }

  return NextResponse.json({
    suggestions: results.slice(0, 8),
  });
}
