export interface CountryCallingRecord {
  code: string; // ISO 3166-1 alpha-2
  name: string;
  dialCode: string; // e.g., '+91'
  minDigits: number;
  maxDigits: number;
  regionLabel: string;
  districtLabel: string;
  postalLabel: string;
  hasDistrictLevel: boolean;
  hasPostalCode: boolean;
  sampleCity: string;
  sampleDistrict: string;
}

export const INTERNATIONAL_COUNTRIES: CountryCallingRecord[] = [
  {
    code: 'IN',
    name: 'India',
    dialCode: '+91',
    minDigits: 10,
    maxDigits: 10,
    regionLabel: 'State or Union Territory',
    districtLabel: 'District / Taluka',
    postalLabel: 'PIN Code',
    hasDistrictLevel: true,
    hasPostalCode: true,
    sampleCity: 'Pune, Nanded, or Baramati',
    sampleDistrict: 'Pune District',
  },
  {
    code: 'US',
    name: 'United States',
    dialCode: '+1',
    minDigits: 10,
    maxDigits: 10,
    regionLabel: 'State',
    districtLabel: 'County',
    postalLabel: 'ZIP Code',
    hasDistrictLevel: true,
    hasPostalCode: true,
    sampleCity: 'New York, Austin, or Hudson',
    sampleDistrict: 'Columbia County',
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    dialCode: '+44',
    minDigits: 10,
    maxDigits: 11,
    regionLabel: 'Country / Region',
    districtLabel: 'County or Borough',
    postalLabel: 'Postcode',
    hasDistrictLevel: true,
    hasPostalCode: true,
    sampleCity: 'London, Oxford, or Whitby',
    sampleDistrict: 'North Yorkshire',
  },
  {
    code: 'AU',
    name: 'Australia',
    dialCode: '+61',
    minDigits: 9,
    maxDigits: 10,
    regionLabel: 'State or Territory',
    districtLabel: 'Local Government Area / Shire',
    postalLabel: 'Postcode',
    hasDistrictLevel: true,
    hasPostalCode: true,
    sampleCity: 'Sydney, Byron Bay, or Mudgee',
    sampleDistrict: 'Mid-Western Regional',
  },
  {
    code: 'AE',
    name: 'United Arab Emirates',
    dialCode: '+971',
    minDigits: 9,
    maxDigits: 9,
    regionLabel: 'Emirate',
    districtLabel: 'Area / Sector',
    postalLabel: 'P.O. Box (Optional)',
    hasDistrictLevel: true,
    hasPostalCode: false,
    sampleCity: 'Dubai, Sharjah, or Hatta',
    sampleDistrict: 'Deira',
  },
  {
    code: 'CA',
    name: 'Canada',
    dialCode: '+1',
    minDigits: 10,
    maxDigits: 10,
    regionLabel: 'Province or Territory',
    districtLabel: 'Regional Municipality / County',
    postalLabel: 'Postal Code',
    hasDistrictLevel: true,
    hasPostalCode: true,
    sampleCity: 'Toronto, Banff, or Lunenburg',
    sampleDistrict: 'Lunenburg County',
  },
  {
    code: 'JP',
    name: 'Japan',
    dialCode: '+81',
    minDigits: 9,
    maxDigits: 11,
    regionLabel: 'Prefecture',
    districtLabel: 'Ward / Gun (District)',
    postalLabel: 'Postal Code',
    hasDistrictLevel: true,
    hasPostalCode: true,
    sampleCity: 'Tokyo, Kamakura, or Hakuba',
    sampleDistrict: 'Kitaazumi District',
  },
  {
    code: 'SG',
    name: 'Singapore',
    dialCode: '+65',
    minDigits: 8,
    maxDigits: 8,
    regionLabel: 'Region',
    districtLabel: 'Planning Area / Town',
    postalLabel: 'Postal Code',
    hasDistrictLevel: true,
    hasPostalCode: true,
    sampleCity: 'Singapore',
    sampleDistrict: 'Tiong Bahru / Bukit Merah',
  },
  {
    code: 'DE',
    name: 'Germany',
    dialCode: '+49',
    minDigits: 9,
    maxDigits: 12,
    regionLabel: 'State (Bundesland)',
    districtLabel: 'District (Landkreis)',
    postalLabel: 'Postal Code (PLZ)',
    hasDistrictLevel: true,
    hasPostalCode: true,
    sampleCity: 'Berlin, Munich, or Rothenburg',
    sampleDistrict: 'Ansbach',
  },
  {
    code: 'FR',
    name: 'France',
    dialCode: '+33',
    minDigits: 9,
    maxDigits: 10,
    regionLabel: 'Region',
    districtLabel: 'Department / Commune',
    postalLabel: 'Code Postal',
    hasDistrictLevel: true,
    hasPostalCode: true,
    sampleCity: 'Paris, Lyon, or Gordes',
    sampleDistrict: 'Vaucluse',
  },
  {
    code: 'NZ',
    name: 'New Zealand',
    dialCode: '+64',
    minDigits: 8,
    maxDigits: 10,
    regionLabel: 'Region',
    districtLabel: 'District',
    postalLabel: 'Postcode',
    hasDistrictLevel: true,
    hasPostalCode: true,
    sampleCity: 'Auckland, Queenstown, or Raglan',
    sampleDistrict: 'Waikato District',
  },
  {
    code: 'ZA',
    name: 'South Africa',
    dialCode: '+27',
    minDigits: 9,
    maxDigits: 9,
    regionLabel: 'Province',
    districtLabel: 'District Municipality',
    postalLabel: 'Postal Code',
    hasDistrictLevel: true,
    hasPostalCode: true,
    sampleCity: 'Cape Town, Stellenbosch, or Clarens',
    sampleDistrict: 'Thabo Mofutsanyana',
  },
  {
    code: 'NG',
    name: 'Nigeria',
    dialCode: '+234',
    minDigits: 10,
    maxDigits: 10,
    regionLabel: 'State',
    districtLabel: 'Local Government Area (LGA)',
    postalLabel: 'Postal Code',
    hasDistrictLevel: true,
    hasPostalCode: true,
    sampleCity: 'Lagos, Abuja, or Epe',
    sampleDistrict: 'Epe LGA',
  },
  {
    code: 'KE',
    name: 'Kenya',
    dialCode: '+254',
    minDigits: 9,
    maxDigits: 9,
    regionLabel: 'County',
    districtLabel: 'Sub-County / Ward',
    postalLabel: 'Postal Code',
    hasDistrictLevel: true,
    hasPostalCode: true,
    sampleCity: 'Nairobi, Naivasha, or Nanyuki',
    sampleDistrict: 'Laikipia East',
  },
  {
    code: 'BR',
    name: 'Brazil',
    dialCode: '+55',
    minDigits: 10,
    maxDigits: 11,
    regionLabel: 'State (UF)',
    districtLabel: 'Municipality / District',
    postalLabel: 'CEP',
    hasDistrictLevel: true,
    hasPostalCode: true,
    sampleCity: 'São Paulo, Paraty, or Gramado',
    sampleDistrict: 'Serra Gaúcha',
  },
  {
    code: 'MX',
    name: 'Mexico',
    dialCode: '+52',
    minDigits: 10,
    maxDigits: 10,
    regionLabel: 'State',
    districtLabel: 'Municipality (Municipio)',
    postalLabel: 'Código Postal',
    hasDistrictLevel: true,
    hasPostalCode: true,
    sampleCity: 'Mexico City, Oaxaca, or Tequila',
    sampleDistrict: 'Jalisco',
  },
  {
    code: 'ID',
    name: 'Indonesia',
    dialCode: '+62',
    minDigits: 9,
    maxDigits: 12,
    regionLabel: 'Province',
    districtLabel: 'Regency (Kabupaten) / Kecamatan',
    postalLabel: 'Kode Pos',
    hasDistrictLevel: true,
    hasPostalCode: true,
    sampleCity: 'Jakarta, Ubud, or Banyuwangi',
    sampleDistrict: 'Gianyar Regency',
  },
  {
    code: 'MY',
    name: 'Malaysia',
    dialCode: '+60',
    minDigits: 9,
    maxDigits: 10,
    regionLabel: 'State or Federal Territory',
    districtLabel: 'District (Daerah)',
    postalLabel: 'Postcode',
    hasDistrictLevel: true,
    hasPostalCode: true,
    sampleCity: 'Kuala Lumpur, Ipoh, or Taiping',
    sampleDistrict: 'Larut, Matang dan Selama',
  },
  {
    code: 'PH',
    name: 'Philippines',
    dialCode: '+63',
    minDigits: 10,
    maxDigits: 10,
    regionLabel: 'Province / Region',
    districtLabel: 'Municipality / Barangay',
    postalLabel: 'ZIP Code',
    hasDistrictLevel: true,
    hasPostalCode: true,
    sampleCity: 'Manila, Cebu, or Vigan',
    sampleDistrict: 'Ilocos Sur',
  },
  {
    code: 'TH',
    name: 'Thailand',
    dialCode: '+66',
    minDigits: 9,
    maxDigits: 9,
    regionLabel: 'Province (Changwat)',
    districtLabel: 'District (Amphoe / Tambon)',
    postalLabel: 'Postal Code',
    hasDistrictLevel: true,
    hasPostalCode: true,
    sampleCity: 'Bangkok, Chiang Mai, or Pai',
    sampleDistrict: 'Mae Hong Son',
  },
  {
    code: 'VN',
    name: 'Vietnam',
    dialCode: '+84',
    minDigits: 9,
    maxDigits: 10,
    regionLabel: 'Province / Municipality',
    districtLabel: 'District / Ward (Quận / Huyện)',
    postalLabel: 'Postal Code',
    hasDistrictLevel: true,
    hasPostalCode: true,
    sampleCity: 'Ho Chi Minh City, Hội An, or Sa Pa',
    sampleDistrict: 'Lào Cai',
  },
  {
    code: 'SA',
    name: 'Saudi Arabia',
    dialCode: '+966',
    minDigits: 9,
    maxDigits: 9,
    regionLabel: 'Province / Region',
    districtLabel: 'Governorate / District',
    postalLabel: 'Postal Code',
    hasDistrictLevel: true,
    hasPostalCode: true,
    sampleCity: 'Riyadh, Jeddah, or AlUla',
    sampleDistrict: 'Medina Province',
  },
  {
    code: 'QA',
    name: 'Qatar',
    dialCode: '+974',
    minDigits: 8,
    maxDigits: 8,
    regionLabel: 'Municipality',
    districtLabel: 'Zone',
    postalLabel: 'Zone Number (Optional)',
    hasDistrictLevel: true,
    hasPostalCode: false,
    sampleCity: 'Doha or Al Wakrah',
    sampleDistrict: 'Al Wakrah',
  },
  {
    code: 'NP',
    name: 'Nepal',
    dialCode: '+977',
    minDigits: 10,
    maxDigits: 10,
    regionLabel: 'Province',
    districtLabel: 'District / Municipality',
    postalLabel: 'Postal Code',
    hasDistrictLevel: true,
    hasPostalCode: true,
    sampleCity: 'Kathmandu, Pokhara, or Bandipur',
    sampleDistrict: 'Tanahun District',
  },
  {
    code: 'LK',
    name: 'Sri Lanka',
    dialCode: '+94',
    minDigits: 9,
    maxDigits: 9,
    regionLabel: 'Province',
    districtLabel: 'District / Divisional Secretariat',
    postalLabel: 'Postal Code',
    hasDistrictLevel: true,
    hasPostalCode: true,
    sampleCity: 'Colombo, Kandy, or Ella',
    sampleDistrict: 'Badulla District',
  },
  {
    code: 'BD',
    name: 'Bangladesh',
    dialCode: '+880',
    minDigits: 10,
    maxDigits: 10,
    regionLabel: 'Division',
    districtLabel: 'District (Zila) / Upazila',
    postalLabel: 'Post Code',
    hasDistrictLevel: true,
    hasPostalCode: true,
    sampleCity: 'Dhaka, Sylhet, or Sreemangal',
    sampleDistrict: 'Moulvibazar District',
  },
  {
    code: 'IE',
    name: 'Ireland',
    dialCode: '+353',
    minDigits: 9,
    maxDigits: 9,
    regionLabel: 'Province / County',
    districtLabel: 'Townland / Municipal District',
    postalLabel: 'Eircode',
    hasDistrictLevel: true,
    hasPostalCode: true,
    sampleCity: 'Dublin, Galway, or Dingle',
    sampleDistrict: 'County Kerry',
  },
  {
    code: 'IT',
    name: 'Italy',
    dialCode: '+39',
    minDigits: 9,
    maxDigits: 11,
    regionLabel: 'Region',
    districtLabel: 'Province / Comune',
    postalLabel: 'CAP (Postal Code)',
    hasDistrictLevel: true,
    hasPostalCode: true,
    sampleCity: 'Rome, Milan, or Montepulciano',
    sampleDistrict: 'Province of Siena',
  },
  {
    code: 'ES',
    name: 'Spain',
    dialCode: '+34',
    minDigits: 9,
    maxDigits: 9,
    regionLabel: 'Autonomous Community',
    districtLabel: 'Province / Comarca',
    postalLabel: 'Código Postal',
    hasDistrictLevel: true,
    hasPostalCode: true,
    sampleCity: 'Madrid, Barcelona, or Ronda',
    sampleDistrict: 'Málaga',
  },
  {
    code: 'NL',
    name: 'Netherlands',
    dialCode: '+31',
    minDigits: 9,
    maxDigits: 9,
    regionLabel: 'Province',
    districtLabel: 'Municipality (Gemeente)',
    postalLabel: 'Postcode',
    hasDistrictLevel: true,
    hasPostalCode: true,
    sampleCity: 'Amsterdam, Utrecht, or Giethoorn',
    sampleDistrict: 'Steenwijkerland',
  },
  {
    code: 'CH',
    name: 'Switzerland',
    dialCode: '+41',
    minDigits: 9,
    maxDigits: 9,
    regionLabel: 'Canton',
    districtLabel: 'District / Municipality',
    postalLabel: 'Postal Code (PLZ)',
    hasDistrictLevel: true,
    hasPostalCode: true,
    sampleCity: 'Zurich, Geneva, or Zermatt',
    sampleDistrict: 'Visp District',
  },
  {
    code: 'SE',
    name: 'Sweden',
    dialCode: '+46',
    minDigits: 7,
    maxDigits: 10,
    regionLabel: 'County (Län)',
    districtLabel: 'Municipality (Kommun)',
    postalLabel: 'Postal Code',
    hasDistrictLevel: true,
    hasPostalCode: true,
    sampleCity: 'Stockholm, Gothenburg, or Visby',
    sampleDistrict: 'Gotland',
  },
  {
    code: 'KR',
    name: 'South Korea',
    dialCode: '+82',
    minDigits: 9,
    maxDigits: 11,
    regionLabel: 'Province / Metropolitan City',
    districtLabel: 'District (Gu / Gun)',
    postalLabel: 'Postal Code',
    hasDistrictLevel: true,
    hasPostalCode: true,
    sampleCity: 'Seoul, Busan, or Gyeongju',
    sampleDistrict: 'North Gyeongsang',
  },
];

export function getCountryRecordByCodeOrName(
  query?: string | null
): CountryCallingRecord {
  if (!query) return INTERNATIONAL_COUNTRIES[0];
  const q = query.trim().toLowerCase();
  const found = INTERNATIONAL_COUNTRIES.find(
    (c) =>
      c.code.toLowerCase() === q ||
      c.name.toLowerCase() === q ||
      c.dialCode === q
  );
  if (found) return found;
  return {
    code: query.trim().slice(0, 2).toUpperCase() || 'GL',
    name: query.trim() || 'International',
    dialCode: '+1',
    minDigits: 6,
    maxDigits: 15,
    regionLabel: 'State, Province, or Region',
    districtLabel: 'District, County, or Municipality',
    postalLabel: 'Postal or ZIP Code',
    hasDistrictLevel: true,
    hasPostalCode: true,
    sampleCity: 'Your town, village, or city',
    sampleDistrict: 'Your local district',
  };
}

export function validatePhoneNumberForCountry(
  subscriberNumber: string,
  country: CountryCallingRecord
): {isValid: boolean; digitsOnly: string; e164: string; error?: string} {
  const digitsOnly = subscriberNumber.replace(/\D/g, '').replace(/^0+/, '');
  console.log('Validation Debug:', { subscriberNumber, digitsOnly, countryDialCode: country.dialCode });

  // If the number starts with the country dial code, remove it for validation
  const dialDigits = country.dialCode.replace(/\D/g, '');
  let cleanedDigits = digitsOnly;
  if (digitsOnly.startsWith(dialDigits)) {
    cleanedDigits = digitsOnly.slice(dialDigits.length);
  } else if (digitsOnly.startsWith(dialDigits.slice(1))) {
    cleanedDigits = digitsOnly.slice(dialDigits.slice(1).length);
  }

  // Use the length that matches criteria better, fallback to digitsOnly if stripped length is invalid
  const finalDigits = (cleanedDigits.length >= country.minDigits && cleanedDigits.length <= country.maxDigits) 
    ? cleanedDigits 
    : digitsOnly;

  console.log('Validation Debug Final:', { finalDigits, min: country.minDigits, max: country.maxDigits });

  if (
    finalDigits.length < country.minDigits ||
    finalDigits.length > country.maxDigits
  ) {
    const lengthDesc =
      country.minDigits === country.maxDigits
        ? `${country.minDigits} digits`
        : `${country.minDigits} to ${country.maxDigits} digits`;
    return {
      isValid: false,
      digitsOnly: finalDigits,
      e164: '',
      error: `Please enter a valid mobile number for ${country.name} (must be ${lengthDesc}).`,
    };
  }

  return {
    isValid: true,
    digitsOnly: finalDigits,
    e164: `+${dialDigits}${finalDigits}`,
  };
}

export function maskPhoneNumber(e164: string, dialCode?: string): string {
  const clean = e164.trim();
  if (clean.length <= 6) return clean;
  const prefix = dialCode || clean.slice(0, 3);
  const lastFour = clean.slice(-4);
  return `${prefix} •••••• ${lastFour}`;
}
