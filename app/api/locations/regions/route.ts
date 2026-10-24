import { NextRequest, NextResponse } from 'next/server';
import { getRegionsByCountry, getCountryByCodeOrName } from '@/lib/location-service';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const countryParam = searchParams.get('country') || '';

  if (!countryParam) {
    return NextResponse.json({ error: 'Missing country parameter' }, { status: 400 });
  }

  const country = getCountryByCodeOrName(countryParam);
  if (!country) {
    return NextResponse.json({ error: `Country "${countryParam}" not found` }, { status: 404 });
  }

  const regions = getRegionsByCountry(country.code);

  return NextResponse.json({
    country,
    regions,
    count: regions.length,
  });
}
