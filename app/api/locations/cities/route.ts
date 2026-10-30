import { NextRequest, NextResponse } from 'next/server';
import {
  getCitiesByCountryRegionAndDistrict,
  getCountryByCodeOrName,
  getRegionByCodeOrName,
  isVillageOrTalukaPlace,
} from '@/lib/location-service';
import { normalizeCanonicalLocationId, CityDef } from '@/lib/global-locations-data';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const countryParam = searchParams.get('country') || '';
  const regionParam = searchParams.get('region') || '';
  const districtParam = searchParams.get('district') || '';
  const forSeller = searchParams.get('forSeller') === 'true' || searchParams.get('role') === 'SELLER';
  const q = (searchParams.get('q') || '').trim();

  if (!countryParam) {
    return NextResponse.json({ error: 'Missing country parameter' }, { status: 400 });
  }

  const country = getCountryByCodeOrName(countryParam);
  if (!country) {
    return NextResponse.json({ error: `Country "${countryParam}" not found` }, { status: 404 });
  }

  const region = regionParam ? getRegionByCodeOrName(country.code, regionParam) : undefined;
  const regionName = region ? region.name : regionParam;

  // 1. Get curated and locally approved cities matching criteria
  const localResults = getCitiesByCountryRegionAndDistrict(
    country.code,
    regionName,
    districtParam,
    q,
    forSeller
  );
  const seenIds = new Set<string>(localResults.map((c) => c.cityId));
  const finalCities: CityDef[] = [...localResults];

  // 2. If a specific search query was entered and we need broader coverage of small towns/villages:
  if (q.length >= 2) {
    try {
      const parts = [q];
      if (regionName) parts.push(regionName);
      parts.push(country.name);
      const queryStr = parts.join(', ');

      const nomRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=8&q=${encodeURIComponent(
          queryStr
        )}`,
        {
          headers: {
            'User-Agent': 'UrbanDirectCascadingLocationService/1.0',
            'Accept-Language': 'en',
          },
          signal: AbortSignal.timeout(3500),
        }
      );

      if (nomRes.ok) {
        const nomData = await nomRes.json();
        if (Array.isArray(nomData)) {
          for (const item of nomData) {
            const addr = item?.address;
            if (!addr) continue;

            const locName =
              addr.city ||
              addr.town ||
              addr.village ||
              addr.municipality ||
              addr.hamlet ||
              addr.suburb ||
              item.name;

            if (!locName) continue;

            const stRegion =
              addr.state || addr.region || addr.province || regionName || country.name;
            const district =
              addr.state_district || addr.county || addr.district || '';
            const postalCode = addr.postcode || '';

            const cityId = normalizeCanonicalLocationId(country.name, stRegion, locName);
            if (seenIds.has(cityId)) continue;
            seenIds.add(cityId);

            const localityType: 'CITY' | 'TOWN' | 'VILLAGE' | 'LOCALITY' =
              addr.village || addr.hamlet
                ? 'VILLAGE'
                : addr.town
                ? 'TOWN'
                : addr.city
                ? 'CITY'
                : 'LOCALITY';

            if (localityType === 'VILLAGE' || isVillageOrTalukaPlace(localityType, locName, district)) {
              continue;
            }

            const lat = Number(item.lat);
            const lng = Number(item.lon);

            finalCities.push({
              cityId,
              cityName: String(locName).trim(),
              district: String(district).trim(),
              stateRegion: String(stRegion).trim(),
              country: country.name,
              countryCode: country.code,
              postalCode: String(postalCode).trim(),
              localityType,
              defaultLocality: String(addr.suburb || locName).trim(),
              coordinates:
                Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : undefined,
            });
          }
        }
      }
    } catch {
      // Graceful fallback to curated data
    }
  }

  return NextResponse.json({
    country,
    region: region || { name: regionName, code: '', countryCode: country.code, regionType: country.regionLabel },
    cities: finalCities.slice(0, 50),
    count: finalCities.length,
  });
}
