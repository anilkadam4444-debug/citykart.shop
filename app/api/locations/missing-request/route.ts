import { NextRequest, NextResponse } from 'next/server';
import {
  MissingLocationRequest,
  getCountryByCodeOrName,
  isVillageOrTalukaPlace,
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
      localityType = 'CITY',
      requesterRole = 'SELLER',
      requesterPhone = '',
      notes = '',
    } = body;

    if (!country || !cityName) {
      return NextResponse.json(
        { error: 'Country and City name are required to submit a city expansion request.' },
        { status: 400 }
      );
    }

    const cleanCityName = cityName.trim();
    const cleanDistrict = district.trim();

    if (
      localityType === 'VILLAGE' ||
      isVillageOrTalukaPlace(localityType, cleanCityName, cleanDistrict)
    ) {
      return NextResponse.json(
        {
          error:
            'CityKart focuses on medium and large cities. Small villages, hamlets, and taluka/tehsil administrative blocks cannot be independently activated.',
        },
        { status: 400 }
      );
    }

    const countryDef = getCountryByCodeOrName(country);
    const countryName = countryDef?.name || country.trim();
    const countryCode = countryDef?.code || 'GL';
    const regionName = (stateRegion || countryName).trim();

    const canonicalCityId = normalizeCanonicalLocationId(countryName, regionName, cleanCityName);

    const now = new Date();
    const locationRequest: MissingLocationRequest = {
      id: `loc_req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      country: countryName,
      countryCode,
      stateRegion: regionName,
      cityName: cleanCityName,
      district: cleanDistrict,
      postalCode: postalCode.trim(),
      localityType: 'CITY',
      requesterRole,
      requesterPhone: requesterPhone.trim(),
      notes: notes.trim(),
      canonicalCityId,
      status: 'PENDING', // New city activation is controlled by Super Admin / Admin approval
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
        district: cleanDistrict,
        postalCode: postalCode.trim(),
        localityType: 'CITY',
        defaultLocality: cleanCityName,
      },
      message: `City expansion request for "${cleanCityName}, ${regionName}, ${countryName}" submitted for Admin activation review.`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to process location request';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

