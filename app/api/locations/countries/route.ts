import { NextResponse } from 'next/server';
import { getAllCountries } from '@/lib/location-service';

export async function GET() {
  const countries = getAllCountries();
  return NextResponse.json({
    countries,
    count: countries.length,
  });
}
