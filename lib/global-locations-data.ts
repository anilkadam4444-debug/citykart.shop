/**
 * URBANDIRECT — Authoritative Global Location Database
 * 
 * Provides ISO 3166-1 alpha-2 countries, administrative divisions (states/provinces/prefectures/regions),
 * and curated cities/towns with normalized canonical identifiers.
 */

export interface CountryDef {
  code: string; // ISO 3166-1 alpha-2
  name: string;
  regionLabel: string;
  districtLabel: string;
  postalLabel: string;
  currencyCode: string;
}

export interface RegionDef {
  code: string;
  name: string;
  countryCode: string;
  regionType: string;
}

export interface DistrictDef {
  code: string;
  name: string;
  stateRegion: string;
  countryCode: string;
  districtType?: string;
}

export interface CityDef {
  cityId: string;
  cityName: string;
  stateRegion: string;
  country: string;
  countryCode: string;
  district?: string;
  postalCode?: string;
  localityType?: 'CITY' | 'TOWN' | 'VILLAGE' | 'LOCALITY';
  defaultLocality?: string;
  coordinates?: { lat: number; lng: number };
}

export const GLOBAL_COUNTRIES: CountryDef[] = [
  {
    code: 'IN',
    name: 'India',
    regionLabel: 'State / Union Territory',
    districtLabel: 'District / Taluka',
    postalLabel: 'PIN Code',
    currencyCode: 'INR',
  },
  {
    code: 'US',
    name: 'United States',
    regionLabel: 'State',
    districtLabel: 'County',
    postalLabel: 'ZIP Code',
    currencyCode: 'USD',
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    regionLabel: 'Country / Region',
    districtLabel: 'County / Borough',
    postalLabel: 'Postcode',
    currencyCode: 'GBP',
  },
  {
    code: 'CA',
    name: 'Canada',
    regionLabel: 'Province / Territory',
    districtLabel: 'Regional Municipality / County',
    postalLabel: 'Postal Code',
    currencyCode: 'CAD',
  },
  {
    code: 'AU',
    name: 'Australia',
    regionLabel: 'State / Territory',
    districtLabel: 'Local Government Area / Shire',
    postalLabel: 'Postcode',
    currencyCode: 'AUD',
  },
  {
    code: 'AE',
    name: 'United Arab Emirates',
    regionLabel: 'Emirate',
    districtLabel: 'Sector / District',
    postalLabel: 'P.O. Box (Optional)',
    currencyCode: 'AED',
  },
  {
    code: 'JP',
    name: 'Japan',
    regionLabel: 'Prefecture',
    districtLabel: 'Ward / District (Gun)',
    postalLabel: 'Postal Code',
    currencyCode: 'JPY',
  },
  {
    code: 'SG',
    name: 'Singapore',
    regionLabel: 'Region / District',
    districtLabel: 'Planning Area',
    postalLabel: 'Postal Code',
    currencyCode: 'SGD',
  },
  {
    code: 'DE',
    name: 'Germany',
    regionLabel: 'State (Bundesland)',
    districtLabel: 'District (Landkreis)',
    postalLabel: 'Postal Code (PLZ)',
    currencyCode: 'EUR',
  },
  {
    code: 'FR',
    name: 'France',
    regionLabel: 'Region',
    districtLabel: 'Department',
    postalLabel: 'Code Postal',
    currencyCode: 'EUR',
  },
  {
    code: 'NZ',
    name: 'New Zealand',
    regionLabel: 'Region',
    districtLabel: 'District',
    postalLabel: 'Postcode',
    currencyCode: 'NZD',
  },
  {
    code: 'NL',
    name: 'Netherlands',
    regionLabel: 'Province',
    districtLabel: 'Municipality',
    postalLabel: 'Postcode',
    currencyCode: 'EUR',
  },
  {
    code: 'CH',
    name: 'Switzerland',
    regionLabel: 'Canton',
    districtLabel: 'District',
    postalLabel: 'PLZ',
    currencyCode: 'CHF',
  },
  {
    code: 'SE',
    name: 'Sweden',
    regionLabel: 'County (Län)',
    districtLabel: 'Municipality',
    postalLabel: 'Postnummer',
    currencyCode: 'SEK',
  },
  {
    code: 'NO',
    name: 'Norway',
    regionLabel: 'County (Fylke)',
    districtLabel: 'Municipality',
    postalLabel: 'Postnummer',
    currencyCode: 'NOK',
  },
  {
    code: 'IT',
    name: 'Italy',
    regionLabel: 'Region',
    districtLabel: 'Province',
    postalLabel: 'CAP',
    currencyCode: 'EUR',
  },
  {
    code: 'ES',
    name: 'Spain',
    regionLabel: 'Autonomous Community',
    districtLabel: 'Province',
    postalLabel: 'Código Postal',
    currencyCode: 'EUR',
  },
  {
    code: 'BR',
    name: 'Brazil',
    regionLabel: 'State (Estado)',
    districtLabel: 'Município',
    postalLabel: 'CEP',
    currencyCode: 'BRL',
  },
  {
    code: 'ZA',
    name: 'South Africa',
    regionLabel: 'Province',
    districtLabel: 'District Municipality',
    postalLabel: 'Postal Code',
    currencyCode: 'ZAR',
  },
  {
    code: 'MY',
    name: 'Malaysia',
    regionLabel: 'State / Federal Territory',
    districtLabel: 'District (Daerah)',
    postalLabel: 'Poskod',
    currencyCode: 'MYR',
  },
  {
    code: 'ID',
    name: 'Indonesia',
    regionLabel: 'Province',
    districtLabel: 'Regency / City',
    postalLabel: 'Kode Pos',
    currencyCode: 'IDR',
  },
  {
    code: 'PH',
    name: 'Philippines',
    regionLabel: 'Region / Province',
    districtLabel: 'Municipality',
    postalLabel: 'ZIP Code',
    currencyCode: 'PHP',
  },
  {
    code: 'TH',
    name: 'Thailand',
    regionLabel: 'Province (Changwat)',
    districtLabel: 'District (Amphoe)',
    postalLabel: 'Postal Code',
    currencyCode: 'THB',
  },
  {
    code: 'VN',
    name: 'Vietnam',
    regionLabel: 'Province / Municipality',
    districtLabel: 'District',
    postalLabel: 'Postal Code',
    currencyCode: 'VND',
  },
  {
    code: 'MX',
    name: 'Mexico',
    regionLabel: 'State (Estado)',
    districtLabel: 'Municipality',
    postalLabel: 'Código Postal',
    currencyCode: 'MXN',
  },
  {
    code: 'SA',
    name: 'Saudi Arabia',
    regionLabel: 'Province / Region',
    districtLabel: 'Governorate',
    postalLabel: 'Postal Code',
    currencyCode: 'SAR',
  },
  {
    code: 'QA',
    name: 'Qatar',
    regionLabel: 'Municipality',
    districtLabel: 'Zone',
    postalLabel: 'Postal Code',
    currencyCode: 'QAR',
  },
  {
    code: 'KW',
    name: 'Kuwait',
    regionLabel: 'Governorate',
    districtLabel: 'Area',
    postalLabel: 'Postal Code',
    currencyCode: 'KWD',
  },
  {
    code: 'OM',
    name: 'Oman',
    regionLabel: 'Governorate',
    districtLabel: 'Wilayat',
    postalLabel: 'Postal Code',
    currencyCode: 'OMR',
  },
  {
    code: 'BH',
    name: 'Bahrain',
    regionLabel: 'Governorate',
    districtLabel: 'Block',
    postalLabel: 'Postal Code',
    currencyCode: 'BHD',
  },
  {
    code: 'IE',
    name: 'Ireland',
    regionLabel: 'County',
    districtLabel: 'Barony',
    postalLabel: 'Eircode',
    currencyCode: 'EUR',
  },
  {
    code: 'PL',
    name: 'Poland',
    regionLabel: 'Voivodeship',
    districtLabel: 'Powiat',
    postalLabel: 'Kod Pocztowy',
    currencyCode: 'PLN',
  },
  {
    code: 'NG',
    name: 'Nigeria',
    regionLabel: 'State',
    districtLabel: 'LGA',
    postalLabel: 'Postal Code',
    currencyCode: 'NGN',
  },
  {
    code: 'KE',
    name: 'Kenya',
    regionLabel: 'County',
    districtLabel: 'Sub-County',
    postalLabel: 'Postal Code',
    currencyCode: 'KES',
  },
  {
    code: 'EG',
    name: 'Egypt',
    regionLabel: 'Governorate',
    districtLabel: 'Markaz / Kism',
    postalLabel: 'Postal Code',
    currencyCode: 'EGP',
  },
  {
    code: 'LK',
    name: 'Sri Lanka',
    regionLabel: 'Province',
    districtLabel: 'District',
    postalLabel: 'Postal Code',
    currencyCode: 'LKR',
  },
  {
    code: 'BD',
    name: 'Bangladesh',
    regionLabel: 'Division',
    districtLabel: 'District (Zila)',
    postalLabel: 'Postal Code',
    currencyCode: 'BDT',
  },
  {
    code: 'NP',
    name: 'Nepal',
    regionLabel: 'Province',
    districtLabel: 'District',
    postalLabel: 'Postal Code',
    currencyCode: 'NPR',
  },
];

export const GLOBAL_REGIONS: RegionDef[] = [
  // --- INDIA (28 States + 8 UTs) ---
  { code: 'MH', name: 'Maharashtra', countryCode: 'IN', regionType: 'State' },
  { code: 'KA', name: 'Karnataka', countryCode: 'IN', regionType: 'State' },
  { code: 'DL', name: 'Delhi', countryCode: 'IN', regionType: 'Union Territory' },
  { code: 'TN', name: 'Tamil Nadu', countryCode: 'IN', regionType: 'State' },
  { code: 'GJ', name: 'Gujarat', countryCode: 'IN', regionType: 'State' },
  { code: 'TG', name: 'Telangana', countryCode: 'IN', regionType: 'State' },
  { code: 'UP', name: 'Uttar Pradesh', countryCode: 'IN', regionType: 'State' },
  { code: 'WB', name: 'West Bengal', countryCode: 'IN', regionType: 'State' },
  { code: 'KL', name: 'Kerala', countryCode: 'IN', regionType: 'State' },
  { code: 'RJ', name: 'Rajasthan', countryCode: 'IN', regionType: 'State' },
  { code: 'MP', name: 'Madhya Pradesh', countryCode: 'IN', regionType: 'State' },
  { code: 'AP', name: 'Andhra Pradesh', countryCode: 'IN', regionType: 'State' },
  { code: 'PB', name: 'Punjab', countryCode: 'IN', regionType: 'State' },
  { code: 'HR', name: 'Haryana', countryCode: 'IN', regionType: 'State' },
  { code: 'BR', name: 'Bihar', countryCode: 'IN', regionType: 'State' },
  { code: 'GA', name: 'Goa', countryCode: 'IN', regionType: 'State' },
  { code: 'AS', name: 'Assam', countryCode: 'IN', regionType: 'State' },
  { code: 'JH', name: 'Jharkhand', countryCode: 'IN', regionType: 'State' },
  { code: 'OR', name: 'Odisha', countryCode: 'IN', regionType: 'State' },
  { code: 'UT', name: 'Uttarakhand', countryCode: 'IN', regionType: 'State' },
  { code: 'HP', name: 'Himachal Pradesh', countryCode: 'IN', regionType: 'State' },
  { code: 'JK', name: 'Jammu and Kashmir', countryCode: 'IN', regionType: 'Union Territory' },
  { code: 'CH', name: 'Chandigarh', countryCode: 'IN', regionType: 'Union Territory' },
  { code: 'CT', name: 'Chhattisgarh', countryCode: 'IN', regionType: 'State' },
  { code: 'TR', name: 'Tripura', countryCode: 'IN', regionType: 'State' },
  { code: 'ML', name: 'Meghalaya', countryCode: 'IN', regionType: 'State' },
  { code: 'MN', name: 'Manipur', countryCode: 'IN', regionType: 'State' },
  { code: 'NL', name: 'Nagaland', countryCode: 'IN', regionType: 'State' },
  { code: 'MZ', name: 'Mizoram', countryCode: 'IN', regionType: 'State' },
  { code: 'SK', name: 'Sikkim', countryCode: 'IN', regionType: 'State' },
  { code: 'AR', name: 'Arunachal Pradesh', countryCode: 'IN', regionType: 'State' },
  { code: 'PY', name: 'Puducherry', countryCode: 'IN', regionType: 'Union Territory' },
  { code: 'LA', name: 'Ladakh', countryCode: 'IN', regionType: 'Union Territory' },

  // --- UNITED STATES ---
  { code: 'NY', name: 'New York', countryCode: 'US', regionType: 'State' },
  { code: 'CA', name: 'California', countryCode: 'US', regionType: 'State' },
  { code: 'TX', name: 'Texas', countryCode: 'US', regionType: 'State' },
  { code: 'FL', name: 'Florida', countryCode: 'US', regionType: 'State' },
  { code: 'WA', name: 'Washington', countryCode: 'US', regionType: 'State' },
  { code: 'IL', name: 'Illinois', countryCode: 'US', regionType: 'State' },
  { code: 'PA', name: 'Pennsylvania', countryCode: 'US', regionType: 'State' },
  { code: 'MA', name: 'Massachusetts', countryCode: 'US', regionType: 'State' },
  { code: 'OH', name: 'Ohio', countryCode: 'US', regionType: 'State' },
  { code: 'GA', name: 'Georgia', countryCode: 'US', regionType: 'State' },
  { code: 'NC', name: 'North Carolina', countryCode: 'US', regionType: 'State' },
  { code: 'MI', name: 'Michigan', countryCode: 'US', regionType: 'State' },
  { code: 'CO', name: 'Colorado', countryCode: 'US', regionType: 'State' },
  { code: 'NJ', name: 'New Jersey', countryCode: 'US', regionType: 'State' },
  { code: 'VA', name: 'Virginia', countryCode: 'US', regionType: 'State' },
  { code: 'AZ', name: 'Arizona', countryCode: 'US', regionType: 'State' },
  { code: 'TN', name: 'Tennessee', countryCode: 'US', regionType: 'State' },
  { code: 'OR', name: 'Oregon', countryCode: 'US', regionType: 'State' },
  { code: 'MN', name: 'Minnesota', countryCode: 'US', regionType: 'State' },
  { code: 'DC', name: 'District of Columbia', countryCode: 'US', regionType: 'Federal District' },

  // --- UNITED KINGDOM ---
  { code: 'ENG', name: 'England', countryCode: 'GB', regionType: 'Country' },
  { code: 'GL', name: 'Greater London', countryCode: 'GB', regionType: 'Region' },
  { code: 'SCT', name: 'Scotland', countryCode: 'GB', regionType: 'Country' },
  { code: 'WLS', name: 'Wales', countryCode: 'GB', regionType: 'Country' },
  { code: 'NIR', name: 'Northern Ireland', countryCode: 'GB', regionType: 'Country' },
  { code: 'NYK', name: 'North Yorkshire', countryCode: 'GB', regionType: 'County' },
  { code: 'MAN', name: 'Greater Manchester', countryCode: 'GB', regionType: 'Metropolitan County' },
  { code: 'WMD', name: 'West Midlands', countryCode: 'GB', regionType: 'Metropolitan County' },

  // --- CANADA ---
  { code: 'ON', name: 'Ontario', countryCode: 'CA', regionType: 'Province' },
  { code: 'QC', name: 'Quebec', countryCode: 'CA', regionType: 'Province' },
  { code: 'BC', name: 'British Columbia', countryCode: 'CA', regionType: 'Province' },
  { code: 'AB', name: 'Alberta', countryCode: 'CA', regionType: 'Province' },
  { code: 'MB', name: 'Manitoba', countryCode: 'CA', regionType: 'Province' },
  { code: 'SK', name: 'Saskatchewan', countryCode: 'CA', regionType: 'Province' },
  { code: 'NS', name: 'Nova Scotia', countryCode: 'CA', regionType: 'Province' },

  // --- AUSTRALIA ---
  { code: 'NSW', name: 'New South Wales', countryCode: 'AU', regionType: 'State' },
  { code: 'VIC', name: 'Victoria', countryCode: 'AU', regionType: 'State' },
  { code: 'QLD', name: 'Queensland', countryCode: 'AU', regionType: 'State' },
  { code: 'WA', name: 'Western Australia', countryCode: 'AU', regionType: 'State' },
  { code: 'SA', name: 'South Australia', countryCode: 'AU', regionType: 'State' },
  { code: 'TAS', name: 'Tasmania', countryCode: 'AU', regionType: 'State' },
  { code: 'ACT', name: 'Australian Capital Territory', countryCode: 'AU', regionType: 'Territory' },

  // --- UNITED ARAB EMIRATES ---
  { code: 'DXB', name: 'Dubai', countryCode: 'AE', regionType: 'Emirate' },
  { code: 'AUH', name: 'Abu Dhabi', countryCode: 'AE', regionType: 'Emirate' },
  { code: 'SHJ', name: 'Sharjah', countryCode: 'AE', regionType: 'Emirate' },
  { code: 'AJM', name: 'Ajman', countryCode: 'AE', regionType: 'Emirate' },
  { code: 'RAK', name: 'Ras Al Khaimah', countryCode: 'AE', regionType: 'Emirate' },
  { code: 'FUJ', name: 'Fujairah', countryCode: 'AE', regionType: 'Emirate' },
  { code: 'UAQ', name: 'Umm Al Quwain', countryCode: 'AE', regionType: 'Emirate' },

  // --- JAPAN ---
  { code: '13', name: 'Tokyo Metropolis', countryCode: 'JP', regionType: 'Prefecture' },
  { code: '27', name: 'Osaka', countryCode: 'JP', regionType: 'Prefecture' },
  { code: '14', name: 'Kanagawa', countryCode: 'JP', regionType: 'Prefecture' },
  { code: '23', name: 'Aichi', countryCode: 'JP', regionType: 'Prefecture' },
  { code: '26', name: 'Kyoto', countryCode: 'JP', regionType: 'Prefecture' },
  { code: '01', name: 'Hokkaido', countryCode: 'JP', regionType: 'Prefecture' },
  { code: '40', name: 'Fukuoka', countryCode: 'JP', regionType: 'Prefecture' },
  { code: '20', name: 'Nagano', countryCode: 'JP', regionType: 'Prefecture' },

  // --- GERMANY ---
  { code: 'BY', name: 'Bavaria', countryCode: 'DE', regionType: 'State (Bundesland)' },
  { code: 'BE', name: 'Berlin', countryCode: 'DE', regionType: 'State' },
  { code: 'NW', name: 'North Rhine-Westphalia', countryCode: 'DE', regionType: 'State' },
  { code: 'BW', name: 'Baden-Württemberg', countryCode: 'DE', regionType: 'State' },
  { code: 'HH', name: 'Hamburg', countryCode: 'DE', regionType: 'State' },
  { code: 'HE', name: 'Hesse', countryCode: 'DE', regionType: 'State' },

  // --- FRANCE ---
  { code: 'IDF', name: 'Île-de-France', countryCode: 'FR', regionType: 'Region' },
  { code: 'ARA', name: 'Auvergne-Rhône-Alpes', countryCode: 'FR', regionType: 'Region' },
  { code: 'PAC', name: "Provence-Alpes-Côte d'Azur", countryCode: 'FR', regionType: 'Region' },
  { code: 'OCC', name: 'Occitanie', countryCode: 'FR', regionType: 'Region' },

  // --- SINGAPORE ---
  { code: 'SG-C', name: 'Central Region', countryCode: 'SG', regionType: 'Region' },
  { code: 'SG-E', name: 'East Region', countryCode: 'SG', regionType: 'Region' },
  { code: 'SG-W', name: 'West Region', countryCode: 'SG', regionType: 'Region' },
  { code: 'SG-N', name: 'North Region', countryCode: 'SG', regionType: 'Region' },
  { code: 'SG-NE', name: 'North-East Region', countryCode: 'SG', regionType: 'Region' },
];

export const GLOBAL_DISTRICTS: DistrictDef[] = [
  // --- INDIA -> MAHARASHTRA ---
  { code: 'MH-ND', name: 'Nanded District', stateRegion: 'Maharashtra', countryCode: 'IN', districtType: 'District' },
  { code: 'MH-PN', name: 'Pune District', stateRegion: 'Maharashtra', countryCode: 'IN', districtType: 'District' },
  { code: 'MH-MS', name: 'Mumbai Suburban', stateRegion: 'Maharashtra', countryCode: 'IN', districtType: 'District' },
  { code: 'MH-MC', name: 'Mumbai City', stateRegion: 'Maharashtra', countryCode: 'IN', districtType: 'District' },
  { code: 'MH-TH', name: 'Thane District', stateRegion: 'Maharashtra', countryCode: 'IN', districtType: 'District' },
  { code: 'MH-NG', name: 'Nagpur District', stateRegion: 'Maharashtra', countryCode: 'IN', districtType: 'District' },
  { code: 'MH-NS', name: 'Nashik District', stateRegion: 'Maharashtra', countryCode: 'IN', districtType: 'District' },
  { code: 'MH-AU', name: 'Aurangabad District', stateRegion: 'Maharashtra', countryCode: 'IN', districtType: 'District' },
  { code: 'MH-KL', name: 'Kolhapur District', stateRegion: 'Maharashtra', countryCode: 'IN', districtType: 'District' },
  { code: 'MH-SO', name: 'Solapur District', stateRegion: 'Maharashtra', countryCode: 'IN', districtType: 'District' },
  { code: 'MH-AM', name: 'Amravati District', stateRegion: 'Maharashtra', countryCode: 'IN', districtType: 'District' },
  { code: 'MH-LT', name: 'Latur District', stateRegion: 'Maharashtra', countryCode: 'IN', districtType: 'District' },
  { code: 'MH-PR', name: 'Parbhani District', stateRegion: 'Maharashtra', countryCode: 'IN', districtType: 'District' },
  { code: 'MH-HI', name: 'Hingoli District', stateRegion: 'Maharashtra', countryCode: 'IN', districtType: 'District' },
  { code: 'MH-JL', name: 'Jalna District', stateRegion: 'Maharashtra', countryCode: 'IN', districtType: 'District' },
  { code: 'MH-BD', name: 'Beed District', stateRegion: 'Maharashtra', countryCode: 'IN', districtType: 'District' },
  { code: 'MH-OS', name: 'Dharashiv District', stateRegion: 'Maharashtra', countryCode: 'IN', districtType: 'District' },
  { code: 'MH-RG', name: 'Raigad District', stateRegion: 'Maharashtra', countryCode: 'IN', districtType: 'District' },
  { code: 'MH-RT', name: 'Ratnagiri District', stateRegion: 'Maharashtra', countryCode: 'IN', districtType: 'District' },
  { code: 'MH-SN', name: 'Sangli District', stateRegion: 'Maharashtra', countryCode: 'IN', districtType: 'District' },
  { code: 'MH-ST', name: 'Satara District', stateRegion: 'Maharashtra', countryCode: 'IN', districtType: 'District' },
  { code: 'MH-AH', name: 'Ahmednagar District', stateRegion: 'Maharashtra', countryCode: 'IN', districtType: 'District' },
  { code: 'MH-DH', name: 'Dhule District', stateRegion: 'Maharashtra', countryCode: 'IN', districtType: 'District' },
  { code: 'MH-JG', name: 'Jalgaon District', stateRegion: 'Maharashtra', countryCode: 'IN', districtType: 'District' },
  { code: 'MH-PL', name: 'Palghar District', stateRegion: 'Maharashtra', countryCode: 'IN', districtType: 'District' },

  // --- INDIA -> KARNATAKA ---
  { code: 'KA-BU', name: 'Bengaluru Urban', stateRegion: 'Karnataka', countryCode: 'IN', districtType: 'District' },
  { code: 'KA-BR', name: 'Bengaluru Rural', stateRegion: 'Karnataka', countryCode: 'IN', districtType: 'District' },
  { code: 'KA-MY', name: 'Mysuru District', stateRegion: 'Karnataka', countryCode: 'IN', districtType: 'District' },
  { code: 'KA-DK', name: 'Dakshina Kannada', stateRegion: 'Karnataka', countryCode: 'IN', districtType: 'District' },
  { code: 'KA-BG', name: 'Belagavi District', stateRegion: 'Karnataka', countryCode: 'IN', districtType: 'District' },

  // --- INDIA -> DELHI ---
  { code: 'DL-ND', name: 'New Delhi', stateRegion: 'Delhi', countryCode: 'IN', districtType: 'District' },
  { code: 'DL-SD', name: 'South Delhi', stateRegion: 'Delhi', countryCode: 'IN', districtType: 'District' },
  { code: 'DL-CD', name: 'Central Delhi', stateRegion: 'Delhi', countryCode: 'IN', districtType: 'District' },

  // --- INDIA -> TELANGANA ---
  { code: 'TG-HYD', name: 'Hyderabad District', stateRegion: 'Telangana', countryCode: 'IN', districtType: 'District' },
  { code: 'TG-MED', name: 'Medchal-Malkajgiri', stateRegion: 'Telangana', countryCode: 'IN', districtType: 'District' },

  // --- INDIA -> TAMIL NADU ---
  { code: 'TN-CHN', name: 'Chennai District', stateRegion: 'Tamil Nadu', countryCode: 'IN', districtType: 'District' },
  { code: 'TN-CBE', name: 'Coimbatore District', stateRegion: 'Tamil Nadu', countryCode: 'IN', districtType: 'District' },

  // --- UNITED STATES -> CALIFORNIA ---
  { code: 'US-CA-LA', name: 'Los Angeles County', stateRegion: 'California', countryCode: 'US', districtType: 'County' },
  { code: 'US-CA-SF', name: 'San Francisco County', stateRegion: 'California', countryCode: 'US', districtType: 'County' },
  { code: 'US-CA-SCL', name: 'Santa Clara County', stateRegion: 'California', countryCode: 'US', districtType: 'County' },
  { code: 'US-CA-OR', name: 'Orange County', stateRegion: 'California', countryCode: 'US', districtType: 'County' },
  { code: 'US-CA-SD', name: 'San Diego County', stateRegion: 'California', countryCode: 'US', districtType: 'County' },

  // --- UNITED STATES -> NEW YORK ---
  { code: 'US-NY-NY', name: 'New York County (Manhattan)', stateRegion: 'New York', countryCode: 'US', districtType: 'County' },
  { code: 'US-NY-KG', name: 'Kings County (Brooklyn)', stateRegion: 'New York', countryCode: 'US', districtType: 'County' },
  { code: 'US-NY-QN', name: 'Queens County', stateRegion: 'New York', countryCode: 'US', districtType: 'County' },
  { code: 'US-NY-ER', name: 'Erie County', stateRegion: 'New York', countryCode: 'US', districtType: 'County' },

  // --- UNITED KINGDOM -> GREATER LONDON / ENGLAND ---
  { code: 'GB-GL', name: 'Greater London', stateRegion: 'Greater London', countryCode: 'GB', districtType: 'Borough / Region' },
  { code: 'GB-MAN', name: 'Greater Manchester', stateRegion: 'England', countryCode: 'GB', districtType: 'Metropolitan County' },
  { code: 'GB-NYK', name: 'North Yorkshire', stateRegion: 'England', countryCode: 'GB', districtType: 'County' },

  // --- CANADA -> ONTARIO & BRITISH COLUMBIA ---
  { code: 'CA-ON-TOR', name: 'City of Toronto', stateRegion: 'Ontario', countryCode: 'CA', districtType: 'Regional Municipality' },
  { code: 'CA-BC-VAN', name: 'Metro Vancouver', stateRegion: 'British Columbia', countryCode: 'CA', districtType: 'Regional District' },

  // --- AUSTRALIA -> NEW SOUTH WALES & VICTORIA ---
  { code: 'AU-NSW-SYD', name: 'City of Sydney', stateRegion: 'New South Wales', countryCode: 'AU', districtType: 'Local Government Area' },
  { code: 'AU-NSW-BYR', name: 'Byron Shire', stateRegion: 'New South Wales', countryCode: 'AU', districtType: 'Local Government Area' },
  { code: 'AU-VIC-MEL', name: 'City of Melbourne', stateRegion: 'Victoria', countryCode: 'AU', districtType: 'Local Government Area' },

  // --- UNITED ARAB EMIRATES ---
  { code: 'AE-DXB-C', name: 'Deira / Bur Dubai', stateRegion: 'Dubai', countryCode: 'AE', districtType: 'District' },
  { code: 'AE-AUH-I', name: 'Abu Dhabi Island', stateRegion: 'Abu Dhabi', countryCode: 'AE', districtType: 'District' },
];

/**
 * Normalizes any country, state/region, and city name into a stable canonical string ID.
 * Example: ("India", "Maharashtra", "Nanded") -> "india-maharashtra-nanded"
 */
export function normalizeCanonicalLocationId(
  country: string,
  stateRegion: string,
  city: string
): string {
  const clean = (str: string) =>
    str
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const c = clean(country) || 'global';
  const r = clean(stateRegion) || 'region';
  const ct = clean(city) || 'city';
  return `${c}-${r}-${ct}`;
}

export const CURATED_CANONICAL_CITIES: CityDef[] = [
  // --- INDIA -> MAHARASHTRA ---
  {
    cityId: 'india-maharashtra-nanded',
    cityName: 'Nanded',
    district: 'Nanded District',
    stateRegion: 'Maharashtra',
    country: 'India',
    countryCode: 'IN',
    postalCode: '431601',
    localityType: 'CITY',
    defaultLocality: 'Vazirabad',
    coordinates: { lat: 19.1383, lng: 77.321 },
  },
  {
    cityId: 'india-maharashtra-loha',
    cityName: 'Loha',
    district: 'Nanded District',
    stateRegion: 'Maharashtra',
    country: 'India',
    countryCode: 'IN',
    postalCode: '431708',
    localityType: 'TOWN',
    defaultLocality: 'Main Market Loha',
    coordinates: { lat: 18.9675, lng: 77.1052 },
  },
  {
    cityId: 'india-maharashtra-pune',
    cityName: 'Pune',
    district: 'Pune District',
    stateRegion: 'Maharashtra',
    country: 'India',
    countryCode: 'IN',
    postalCode: '411038',
    localityType: 'CITY',
    defaultLocality: 'Kothrud',
    coordinates: { lat: 18.5204, lng: 73.8567 },
  },
  {
    cityId: 'india-maharashtra-mumbai',
    cityName: 'Mumbai',
    district: 'Mumbai Suburban',
    stateRegion: 'Maharashtra',
    country: 'India',
    countryCode: 'IN',
    postalCode: '400050',
    localityType: 'CITY',
    defaultLocality: 'Bandra West',
    coordinates: { lat: 19.076, lng: 72.8777 },
  },
  {
    cityId: 'india-maharashtra-nagpur',
    cityName: 'Nagpur',
    district: 'Nagpur District',
    stateRegion: 'Maharashtra',
    country: 'India',
    countryCode: 'IN',
    postalCode: '440001',
    localityType: 'CITY',
    defaultLocality: 'Dharampeth',
    coordinates: { lat: 21.1458, lng: 79.0882 },
  },
  {
    cityId: 'india-maharashtra-nashik',
    cityName: 'Nashik',
    district: 'Nashik District',
    stateRegion: 'Maharashtra',
    country: 'India',
    countryCode: 'IN',
    postalCode: '422001',
    localityType: 'CITY',
    defaultLocality: 'College Road',
    coordinates: { lat: 19.9975, lng: 73.7898 },
  },
  {
    cityId: 'india-maharashtra-chhatrapati-sambhajinagar',
    cityName: 'Chhatrapati Sambhajinagar (Aurangabad)',
    district: 'Aurangabad District',
    stateRegion: 'Maharashtra',
    country: 'India',
    countryCode: 'IN',
    postalCode: '431001',
    localityType: 'CITY',
    defaultLocality: 'Cidco',
    coordinates: { lat: 19.8762, lng: 75.3433 },
  },
  {
    cityId: 'india-maharashtra-baramati',
    cityName: 'Baramati',
    district: 'Pune District',
    stateRegion: 'Maharashtra',
    country: 'India',
    countryCode: 'IN',
    postalCode: '413102',
    localityType: 'TOWN',
    defaultLocality: 'Bhigwan Road',
    coordinates: { lat: 18.1518, lng: 74.5777 },
  },
  {
    cityId: 'india-maharashtra-thane',
    cityName: 'Thane',
    district: 'Thane District',
    stateRegion: 'Maharashtra',
    country: 'India',
    countryCode: 'IN',
    postalCode: '400601',
    localityType: 'CITY',
    defaultLocality: 'Naupada',
    coordinates: { lat: 19.2183, lng: 72.9781 },
  },
  {
    cityId: 'india-maharashtra-kolhapur',
    cityName: 'Kolhapur',
    district: 'Kolhapur District',
    stateRegion: 'Maharashtra',
    country: 'India',
    countryCode: 'IN',
    postalCode: '416001',
    localityType: 'CITY',
    defaultLocality: 'Rajarampuri',
    coordinates: { lat: 16.705, lng: 74.2433 },
  },

  // --- INDIA -> KARNATAKA ---
  {
    cityId: 'india-karnataka-bengaluru',
    cityName: 'Bengaluru',
    district: 'Bengaluru Urban',
    stateRegion: 'Karnataka',
    country: 'India',
    countryCode: 'IN',
    postalCode: '560038',
    localityType: 'CITY',
    defaultLocality: 'Indiranagar',
    coordinates: { lat: 12.9716, lng: 77.5946 },
  },
  {
    cityId: 'india-karnataka-mysuru',
    cityName: 'Mysuru',
    district: 'Mysuru District',
    stateRegion: 'Karnataka',
    country: 'India',
    countryCode: 'IN',
    postalCode: '570001',
    localityType: 'CITY',
    defaultLocality: 'Gokulam',
    coordinates: { lat: 12.2958, lng: 76.6394 },
  },
  {
    cityId: 'india-karnataka-mangaluru',
    cityName: 'Mangaluru',
    district: 'Dakshina Kannada',
    stateRegion: 'Karnataka',
    country: 'India',
    countryCode: 'IN',
    postalCode: '575001',
    localityType: 'CITY',
    defaultLocality: 'Hampankatta',
    coordinates: { lat: 12.9141, lng: 74.856 },
  },

  // --- INDIA -> DELHI ---
  {
    cityId: 'india-delhi-new-delhi',
    cityName: 'New Delhi',
    district: 'New Delhi',
    stateRegion: 'Delhi',
    country: 'India',
    countryCode: 'IN',
    postalCode: '110001',
    localityType: 'CITY',
    defaultLocality: 'Connaught Place',
    coordinates: { lat: 28.6139, lng: 77.209 },
  },
  {
    cityId: 'india-delhi-south-delhi',
    cityName: 'South Delhi',
    district: 'South Delhi',
    stateRegion: 'Delhi',
    country: 'India',
    countryCode: 'IN',
    postalCode: '110017',
    localityType: 'CITY',
    defaultLocality: 'Hauz Khas',
    coordinates: { lat: 28.5494, lng: 77.2001 },
  },

  // --- INDIA -> TELANGANA ---
  {
    cityId: 'india-telangana-hyderabad',
    cityName: 'Hyderabad',
    district: 'Hyderabad District',
    stateRegion: 'Telangana',
    country: 'India',
    countryCode: 'IN',
    postalCode: '500034',
    localityType: 'CITY',
    defaultLocality: 'Banjara Hills',
    coordinates: { lat: 17.385, lng: 78.4867 },
  },

  // --- INDIA -> TAMIL NADU ---
  {
    cityId: 'india-tamil-nadu-chennai',
    cityName: 'Chennai',
    district: 'Chennai District',
    stateRegion: 'Tamil Nadu',
    country: 'India',
    countryCode: 'IN',
    postalCode: '600028',
    localityType: 'CITY',
    defaultLocality: 'Mylapore',
    coordinates: { lat: 13.0827, lng: 80.2707 },
  },
  {
    cityId: 'india-tamil-nadu-coimbatore',
    cityName: 'Coimbatore',
    district: 'Coimbatore District',
    stateRegion: 'Tamil Nadu',
    country: 'India',
    countryCode: 'IN',
    postalCode: '641001',
    localityType: 'CITY',
    defaultLocality: 'RS Puram',
    coordinates: { lat: 11.0168, lng: 76.9558 },
  },

  // --- UNITED STATES -> NEW YORK ---
  {
    cityId: 'united-states-new-york-new-york',
    cityName: 'New York',
    district: 'New York County (Manhattan)',
    stateRegion: 'New York',
    country: 'United States',
    countryCode: 'US',
    postalCode: '10012',
    localityType: 'CITY',
    defaultLocality: 'SoHo',
    coordinates: { lat: 40.7128, lng: -74.006 },
  },
  {
    cityId: 'united-states-new-york-brooklyn',
    cityName: 'Brooklyn',
    district: 'Kings County',
    stateRegion: 'New York',
    country: 'United States',
    countryCode: 'US',
    postalCode: '11201',
    localityType: 'CITY',
    defaultLocality: 'DUMBO',
    coordinates: { lat: 40.6782, lng: -73.9442 },
  },
  {
    cityId: 'united-states-new-york-buffalo',
    cityName: 'Buffalo',
    district: 'Erie County',
    stateRegion: 'New York',
    country: 'United States',
    countryCode: 'US',
    postalCode: '14201',
    localityType: 'CITY',
    defaultLocality: 'Elmwood Village',
    coordinates: { lat: 42.8864, lng: -78.8784 },
  },

  // --- UNITED STATES -> CALIFORNIA ---
  {
    cityId: 'united-states-california-san-francisco',
    cityName: 'San Francisco',
    district: 'San Francisco County',
    stateRegion: 'California',
    country: 'United States',
    countryCode: 'US',
    postalCode: '94110',
    localityType: 'CITY',
    defaultLocality: 'Mission District',
    coordinates: { lat: 37.7749, lng: -122.4194 },
  },
  {
    cityId: 'united-states-california-los-angeles',
    cityName: 'Los Angeles',
    district: 'Los Angeles County',
    stateRegion: 'California',
    country: 'United States',
    countryCode: 'US',
    postalCode: '90012',
    localityType: 'CITY',
    defaultLocality: 'Downtown LA',
    coordinates: { lat: 34.0522, lng: -118.2437 },
  },
  {
    cityId: 'united-states-california-san-diego',
    cityName: 'San Diego',
    district: 'San Diego County',
    stateRegion: 'California',
    country: 'United States',
    countryCode: 'US',
    postalCode: '92101',
    localityType: 'CITY',
    defaultLocality: 'Little Italy',
    coordinates: { lat: 32.7157, lng: -117.1611 },
  },

  // --- UNITED KINGDOM -> GREATER LONDON / ENGLAND ---
  {
    cityId: 'united-kingdom-greater-london-london',
    cityName: 'London',
    district: 'Greater London',
    stateRegion: 'Greater London',
    country: 'United Kingdom',
    countryCode: 'GB',
    postalCode: 'EC2A',
    localityType: 'CITY',
    defaultLocality: 'Shoreditch',
    coordinates: { lat: 51.5072, lng: -0.1276 },
  },
  {
    cityId: 'united-kingdom-england-manchester',
    cityName: 'Manchester',
    district: 'Greater Manchester',
    stateRegion: 'England',
    country: 'United Kingdom',
    countryCode: 'GB',
    postalCode: 'M1',
    localityType: 'CITY',
    defaultLocality: 'Northern Quarter',
    coordinates: { lat: 53.4808, lng: -2.2426 },
  },
  {
    cityId: 'united-kingdom-north-yorkshire-whitby',
    cityName: 'Whitby',
    district: 'North Yorkshire',
    stateRegion: 'England',
    country: 'United Kingdom',
    countryCode: 'GB',
    postalCode: 'YO21',
    localityType: 'TOWN',
    defaultLocality: 'Harbour Side',
    coordinates: { lat: 54.4858, lng: -0.6206 },
  },

  // --- CANADA -> ONTARIO ---
  {
    cityId: 'canada-ontario-toronto',
    cityName: 'Toronto',
    district: 'Golden Horseshoe',
    stateRegion: 'Ontario',
    country: 'Canada',
    countryCode: 'CA',
    postalCode: 'M5V',
    localityType: 'CITY',
    defaultLocality: 'Queen West',
    coordinates: { lat: 43.6532, lng: -79.3832 },
  },
  {
    cityId: 'canada-british-columbia-vancouver',
    cityName: 'Vancouver',
    district: 'Metro Vancouver',
    stateRegion: 'British Columbia',
    country: 'Canada',
    countryCode: 'CA',
    postalCode: 'V6B',
    localityType: 'CITY',
    defaultLocality: 'Gastown',
    coordinates: { lat: 49.2827, lng: -123.1207 },
  },

  // --- AUSTRALIA -> NEW SOUTH WALES ---
  {
    cityId: 'australia-new-south-wales-sydney',
    cityName: 'Sydney',
    district: 'City of Sydney',
    stateRegion: 'New South Wales',
    country: 'Australia',
    countryCode: 'AU',
    postalCode: '2010',
    localityType: 'CITY',
    defaultLocality: 'Surry Hills',
    coordinates: { lat: -33.8688, lng: 151.2093 },
  },
  {
    cityId: 'australia-new-south-wales-byron-bay',
    cityName: 'Byron Bay',
    district: 'Byron Shire',
    stateRegion: 'New South Wales',
    country: 'Australia',
    countryCode: 'AU',
    postalCode: '2481',
    localityType: 'TOWN',
    defaultLocality: 'Jonson Street',
    coordinates: { lat: -28.6474, lng: 153.602 },
  },
  {
    cityId: 'australia-victoria-melbourne',
    cityName: 'Melbourne',
    district: 'City of Melbourne',
    stateRegion: 'Victoria',
    country: 'Australia',
    countryCode: 'AU',
    postalCode: '3065',
    localityType: 'CITY',
    defaultLocality: 'Fitzroy',
    coordinates: { lat: -37.8136, lng: 144.9631 },
  },

  // --- UNITED ARAB EMIRATES -> DUBAI ---
  {
    cityId: 'united-arab-emirates-dubai-dubai',
    cityName: 'Dubai',
    district: 'Deira / Bur Dubai',
    stateRegion: 'Dubai',
    country: 'United Arab Emirates',
    countryCode: 'AE',
    localityType: 'CITY',
    defaultLocality: 'Downtown Dubai',
    coordinates: { lat: 25.2048, lng: 55.2708 },
  },
  {
    cityId: 'united-arab-emirates-abu-dhabi-abu-dhabi',
    cityName: 'Abu Dhabi',
    district: 'Abu Dhabi Island',
    stateRegion: 'Abu Dhabi',
    country: 'United Arab Emirates',
    countryCode: 'AE',
    localityType: 'CITY',
    defaultLocality: 'Al Zahiyah (Tourist Club)',
    coordinates: { lat: 24.4539, lng: 54.3773 },
  },

  // --- JAPAN -> TOKYO ---
  {
    cityId: 'japan-tokyo-metropolis-tokyo',
    cityName: 'Tokyo',
    district: 'Shibuya Ward',
    stateRegion: 'Tokyo Metropolis',
    country: 'Japan',
    countryCode: 'JP',
    postalCode: '150-0042',
    localityType: 'CITY',
    defaultLocality: 'Shibuya',
    coordinates: { lat: 35.6762, lng: 139.6503 },
  },
  {
    cityId: 'japan-nagano-hakuba',
    cityName: 'Hakuba',
    district: 'Kitaazumi District',
    stateRegion: 'Nagano',
    country: 'Japan',
    countryCode: 'JP',
    postalCode: '399-9301',
    localityType: 'VILLAGE',
    defaultLocality: 'Happo',
    coordinates: { lat: 36.6982, lng: 137.8619 },
  },

  // --- GERMANY -> BAVARIA / BERLIN ---
  {
    cityId: 'germany-berlin-berlin',
    cityName: 'Berlin',
    district: 'Mitte',
    stateRegion: 'Berlin',
    country: 'Germany',
    countryCode: 'DE',
    postalCode: '10115',
    localityType: 'CITY',
    defaultLocality: 'Mitte',
    coordinates: { lat: 52.52, lng: 13.405 },
  },
  {
    cityId: 'germany-bavaria-munich',
    cityName: 'Munich',
    district: 'Upper Bavaria',
    stateRegion: 'Bavaria',
    country: 'Germany',
    countryCode: 'DE',
    postalCode: '80331',
    localityType: 'CITY',
    defaultLocality: 'Altstadt-Lehel',
    coordinates: { lat: 48.1351, lng: 11.582 },
  },

  // --- FRANCE -> ÎLE-DE-FRANCE ---
  {
    cityId: 'france-ile-de-france-paris',
    cityName: 'Paris',
    district: '3rd Arrondissement',
    stateRegion: 'Île-de-France',
    country: 'France',
    countryCode: 'FR',
    postalCode: '75003',
    localityType: 'CITY',
    defaultLocality: 'Le Marais',
    coordinates: { lat: 48.8566, lng: 2.3522 },
  },

  // --- SINGAPORE ---
  {
    cityId: 'singapore-central-region-singapore',
    cityName: 'Singapore',
    district: 'Bukit Merah',
    stateRegion: 'Central Region',
    country: 'Singapore',
    countryCode: 'SG',
    postalCode: '168731',
    localityType: 'CITY',
    defaultLocality: 'Tiong Bahru',
    coordinates: { lat: 1.3521, lng: 103.8198 },
  },
];
