import {NextRequest, NextResponse} from 'next/server';
import {
  normalizeCityId,
  resolveNearestCityFromCoordinates,
} from '@/lib/catalog-data';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const lat = Number(body.lat);
    const lng = Number(body.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json(
        {
          error: "We couldn't detect your city. Please enter it manually.",
        },
        {status: 400}
      );
    }

    // 1. OpenStreetMap Nominatim Reverse Geocoding (high-accuracy street level zoom=18)
    try {
      const nomRes = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
          String(lat)
        )}&lon=${encodeURIComponent(String(lng))}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'UrbanDirectHyperlocalCommerce/1.0',
            'Accept-Language': 'en',
          },
          signal: AbortSignal.timeout(4500),
        }
      );

      if (nomRes.ok) {
        const nomData = await nomRes.json();
        const addr = nomData?.address;
        if (addr) {
          const detectedCity =
            addr.city ||
            addr.town ||
            addr.municipality ||
            addr.village ||
            addr.state_district ||
            addr.county;
          const detectedState =
            addr.state || addr.region || addr.province || '';
          const detectedCountry = addr.country || '';
          const detectedCountryCode = String(
            addr.country_code || ''
          ).toUpperCase();
          const detectedLocality =
            addr.suburb ||
            addr.neighbourhood ||
            addr.quarter ||
            addr.residential ||
            '';
          const road = addr.road || addr.street || addr.pedestrian || addr.footway || '';
          const houseNumber = addr.house_number || addr.building || '';
          const postalCode = addr.postcode || '';

          const streetParts = [
            houseNumber ? `#${houseNumber}` : '',
            road,
            detectedLocality,
          ].filter(Boolean);
          const streetAddress = streetParts.length > 0 ? streetParts.join(', ') : (detectedLocality || detectedCity);

          if (detectedCity && detectedCountry) {
            const isAmbiguous = !addr.city && !addr.town;
            return NextResponse.json({
              city: String(detectedCity).trim(),
              stateRegion: String(detectedState || detectedCountry).trim(),
              country: String(detectedCountry).trim(),
              countryCode: detectedCountryCode,
              locality: String(detectedLocality).trim(),
              streetAddress: String(streetAddress).trim(),
              postalCode: String(postalCode).trim(),
              formattedAddress: nomData?.display_name || `${streetAddress}, ${detectedCity}, ${detectedState} ${postalCode}, ${detectedCountry}`,
              lat,
              lng,
              cityId: normalizeCityId(
                detectedCountry,
                detectedState || detectedCountry,
                detectedCity
              ),
              isUncertain: isAmbiguous,
              source: 'nominatim',
            });
          }
        }
      }
    } catch {
      // Fall through to deterministic global city coordinate lookup
    }

    // 2. Deterministic Global City Directory Coordinate Fallback (zero external API cost)
    const resolved = resolveNearestCityFromCoordinates(lat, lng);
    return NextResponse.json({
      city: resolved.cityRecord.cityName,
      stateRegion: resolved.cityRecord.stateRegion,
      country: resolved.cityRecord.country,
      countryCode: resolved.cityRecord.countryCode,
      locality: resolved.cityRecord.defaultLocality,
      cityId: resolved.cityRecord.cityId,
      isUncertain: resolved.isUncertain,
      distanceKm: resolved.distanceKm,
      source: 'coordinate_directory',
    });
  } catch {
    return NextResponse.json(
      {
        error: "We couldn't detect your city. Please enter it manually.",
      },
      {status: 500}
    );
  }
}
