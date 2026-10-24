import { NextRequest, NextResponse } from 'next/server';
import {
  MissingLocationRequest,
  getCountryByCodeOrName,
} from '@/lib/location-service';
import { normalizeCanonicalLocationId } from '@/lib/global-locations-data';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      country,
      stateRegion,
      cityName,
      district = '',
      postalCode = '',
      localityType = 'TOWN',
      requesterRole = 'SELLER',
      requesterPhone = '',
      notes = '',
    } = body;

    if (!country || !cityName) {
      return NextResponse.json(
        { error: 'Country and City/Town name are required to submit a location request.' },
        { status: 400 }
      );
    }

    const countryDef = getCountryByCodeOrName(country);
    const countryName = countryDef?.name || country.trim();
    const countryCode = countryDef?.code || 'GL';
    const regionName = (stateRegion || countryName).trim();
    const cleanCityName = cityName.trim();

    const canonicalCityId = normalizeCanonicalLocationId(countryName, regionName, cleanCityName);

    const now = new Date();
    const locationRequest: MissingLocationRequest = {
      id: `loc_req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      country: countryName,
      countryCode,
      stateRegion: regionName,
      cityName: cleanCityName,
      district: district.trim(),
      postalCode: postalCode.trim(),
      localityType,
      requesterRole,
      requesterPhone: requesterPhone.trim(),
      notes: notes.trim(),
      canonicalCityId,
      status: 'APPROVED', // Immediately approved to unblock user seamlessly with canonical ID
      createdAt: now.toISOString(),
    };

    return NextResponse.json({
      success: true,
      request: locationRequest,
      canonicalCity: {
        cityId: canonicalCityId,
        cityName: cleanCityName,
        stateRegion: regionName,
        country: countryName,
        countryCode,
        district: district.trim(),
        postalCode: postalCode.trim(),
        localityType,
        defaultLocality: cleanCityName,
      },
      message: `Location "${cleanCityName}, ${regionName}, ${countryName}" registered with canonical ID "${canonicalCityId}".`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to process location request';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
