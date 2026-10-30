'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Globe,
  MapPin,
  ChevronDown,
  Search,
  Check,
  Plus,
  AlertCircle,
  Loader2,
  X,
} from 'lucide-react';
import {
  getAllCountries,
  getRegionsByCountry,
  getDistrictsByCountryAndRegion,
  getCitiesByCountryRegionAndDistrict,
  getCitiesByCountryAndRegion,
  saveMissingLocationRequest,
  MissingLocationRequest,
  isVillageOrTalukaPlace,
} from '@/lib/location-service';
import { CountryDef, RegionDef, DistrictDef, CityDef, normalizeCanonicalLocationId } from '@/lib/global-locations-data';

export interface CascadingLocationValue {
  country: string;
  countryCode?: string;
  stateRegion: string;
  city: string;
  cityId: string;
  district?: string;
  locality?: string;
  postalCode?: string;
  localityType?: 'CITY' | 'TOWN' | 'VILLAGE' | 'LOCALITY';
  source?: string;
}

export type SelectedLocationPayload = CascadingLocationValue;

export interface CascadingLocationSelectorProps {
  value?: Partial<CascadingLocationValue>;
  selectedCountry?: string;
  selectedStateRegion?: string;
  selectedCity?: string;
  selectedLocality?: string;
  selectedDistrict?: string;
  selectedPostalCode?: string;
  selectedLocalityType?: 'CITY' | 'TOWN' | 'VILLAGE' | 'LOCALITY';
  onChange: (newValue: CascadingLocationValue) => void;
  variant?: 'MODAL' | 'FORM' | 'COMPACT';
  showLocalityInput?: boolean;
  allowLocalityInput?: boolean;
  hideDistrict?: boolean;
  showMissingLocationButton?: boolean;
  localityLabel?: string;
  requesterRole?: 'BUYER' | 'SELLER' | 'ADMIN';
  className?: string;
}

export function CascadingLocationSelector({
  value,
  selectedCountry,
  selectedStateRegion,
  selectedCity,
  selectedLocality: propLocality,
  selectedDistrict: propDistrict,
  selectedPostalCode: propPostalCode,
  selectedLocalityType: propLocalityType,
  onChange,
  variant = 'FORM',
  showLocalityInput = true,
  allowLocalityInput = true,
  hideDistrict = false,
  showMissingLocationButton = true,
  localityLabel = 'Locality / Neighborhood / Suburb',
  requesterRole = 'BUYER',
  className = '',
}: CascadingLocationSelectorProps) {
  const countries = useMemo(() => getAllCountries(), []);

  const shouldShowLocality = showLocalityInput && allowLocalityInput;
  void propLocalityType;
  void showMissingLocationButton;

  // Controlled or uncontrolled selection values derived without useEffect
  const [internalCountryCode, setInternalCountryCode] = useState<string>(() => {
    if (value?.countryCode) return value.countryCode;
    const initialCountry = selectedCountry || value?.country || 'India';
    const found = countries.find(
      (c) => c.name.toLowerCase() === initialCountry.toLowerCase()
    );
    return found ? found.code : 'IN';
  });

  const selectedCountryCode = useMemo(() => {
    if (selectedCountry) {
      const found = countries.find(
        (c) => c.name.toLowerCase() === selectedCountry.toLowerCase()
      );
      if (found) return found.code;
    }
    if (value?.countryCode) return value.countryCode;
    if (value?.country) {
      const targetCountry = value.country.toLowerCase();
      const found = countries.find(
        (c) => c.name.toLowerCase() === targetCountry
      );
      if (found) return found.code;
    }
    return internalCountryCode;
  }, [selectedCountry, value, countries, internalCountryCode]);

  const [internalRegionName, setInternalRegionName] = useState<string>(
    value?.stateRegion || 'Maharashtra'
  );
  const selectedRegionName =
    selectedStateRegion !== undefined
      ? selectedStateRegion
      : value?.stateRegion !== undefined
      ? value.stateRegion
      : internalRegionName;

  const [internalCityName, setInternalCityName] = useState<string>(value?.city || '');
  const selectedCityName =
    selectedCity !== undefined
      ? selectedCity
      : value?.city !== undefined
      ? value.city
      : internalCityName;

  const [internalCityId, setInternalCityId] = useState<string>(value?.cityId || '');
  const selectedCityId = useMemo(() => {
    if (value?.cityId) return value.cityId;
    if (selectedCityName && selectedRegionName) {
      const cObj = countries.find((c) => c.code === selectedCountryCode);
      return normalizeCanonicalLocationId(
        cObj?.name || 'India',
        selectedRegionName,
        selectedCityName
      );
    }
    return internalCityId;
  }, [value?.cityId, selectedCityName, selectedRegionName, countries, selectedCountryCode, internalCityId]);

  const [internalLocality, setInternalLocality] = useState<string>(
    propLocality ?? value?.locality ?? ''
  );
  const selectedLocality =
    propLocality !== undefined
      ? propLocality
      : value?.locality !== undefined
      ? value.locality
      : internalLocality;

  const [internalPostalCode, setInternalPostalCode] = useState<string>(
    propPostalCode ?? value?.postalCode ?? ''
  );
  const selectedPostalCode =
    propPostalCode !== undefined
      ? propPostalCode
      : value?.postalCode !== undefined
      ? value.postalCode
      : internalPostalCode;

  const [internalDistrict, setInternalDistrict] = useState<string>(
    propDistrict ?? value?.district ?? ''
  );
  const selectedDistrict =
    propDistrict !== undefined
      ? propDistrict
      : value?.district !== undefined
      ? value.district
      : internalDistrict;

  const setSelectedCountryCode = setInternalCountryCode;
  const setSelectedRegionName = setInternalRegionName;
  const setSelectedCityName = setInternalCityName;
  const setSelectedCityId = setInternalCityId;
  const setSelectedLocality = setInternalLocality;
  const setSelectedPostalCode = setInternalPostalCode;
  const setSelectedDistrict = setInternalDistrict;

  // Dropdown Open States
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [regionDropdownOpen, setRegionDropdownOpen] = useState(false);
  const [districtDropdownOpen, setDistrictDropdownOpen] = useState(false);
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);

  // Search filters inside dropdowns
  const [countrySearch, setCountrySearch] = useState('');
  const [regionSearch, setRegionSearch] = useState('');
  const [districtSearch, setDistrictSearch] = useState('');
  const [citySearch, setCitySearch] = useState('');

  // Dynamic Remote Cities Loading State
  const [remoteCities, setRemoteCities] = useState<CityDef[]>([]);
  const [isLoadingCities, setIsLoadingCities] = useState(false);

  // Missing Location Modal State
  const [isMissingModalOpen, setIsMissingModalOpen] = useState(false);
  const [customCityInput, setCustomCityInput] = useState('');
  const [customRegionInput, setCustomRegionInput] = useState('');
  const [customDistrictInput, setCustomDistrictInput] = useState('');
  const [customPostalInput, setCustomPostalInput] = useState('');
  const [customPhoneInput, setCustomPhoneInput] = useState('');
  const [isSubmittingCustom, setIsSubmittingCustom] = useState(false);

  // Active Country Definition
  const currentCountry = useMemo(() => {
    return countries.find((c) => c.code === selectedCountryCode) || countries[0];
  }, [countries, selectedCountryCode]);

  // Regions for current country
  const availableRegions = useMemo(() => {
    return getRegionsByCountry(currentCountry.code);
  }, [currentCountry]);

  // Districts for selected country & region
  const availableDistricts = useMemo(() => {
    if (!selectedCountryCode || !selectedRegionName) return [];
    return getDistrictsByCountryAndRegion(selectedCountryCode, selectedRegionName);
  }, [selectedCountryCode, selectedRegionName]);

  // Curated instant cities for the selected country, region & optional district
  const instantCities = useMemo(() => {
    if (!selectedCountryCode || !selectedRegionName) return [];
    const forSeller = requesterRole === 'SELLER';
    return getCitiesByCountryRegionAndDistrict(
      selectedCountryCode,
      selectedRegionName,
      selectedDistrict,
      citySearch,
      forSeller
    );
  }, [selectedCountryCode, selectedRegionName, selectedDistrict, citySearch, requesterRole]);

  // Load server-side and OpenStreetMap dynamic places asynchronously
  useEffect(() => {
    let isCancelled = false;
    const controller = new AbortController();

    if (!selectedCountryCode || !selectedRegionName) {
      return;
    }

    const runFetch = async () => {
      await Promise.resolve();
      if (isCancelled) return;
      setIsLoadingCities(true);
      try {
        const params = new URLSearchParams({
          country: selectedCountryCode,
          region: selectedRegionName,
        });
        if (selectedDistrict) {
          params.set('district', selectedDistrict);
        }
        if (citySearch.trim().length >= 2) {
          params.set('q', citySearch.trim());
        }
        if (requesterRole === 'SELLER') {
          params.set('forSeller', 'true');
        }
        const res = await fetch(`/api/locations/cities?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (!isCancelled && data.cities && Array.isArray(data.cities)) {
          setRemoteCities(data.cities);
        }
      } catch {
        // ignore aborted request
      } finally {
        if (!isCancelled) {
          setIsLoadingCities(false);
        }
      }
    };

    runFetch();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [selectedCountryCode, selectedRegionName, selectedDistrict, citySearch, requesterRole]);

  // Combine instant curated and fetched cities cleanly without calling synchronous setState in an effect
  const citiesList = useMemo(() => {
    if (!selectedCountryCode || !selectedRegionName) return [];
    const isSeller = requesterRole === 'SELLER';
    const seen = new Set<string>();
    const merged: CityDef[] = [];

    const isEligible = (c: CityDef) => {
      if (c.localityType === 'VILLAGE') return false;
      return !isVillageOrTalukaPlace(c.localityType, c.cityName, c.district);
    };

    for (const c of instantCities) {
      if (!seen.has(c.cityId) && isEligible(c)) {
        seen.add(c.cityId);
        merged.push(c);
      }
    }
    for (const c of remoteCities) {
      if (!seen.has(c.cityId) && isEligible(c)) {
        seen.add(c.cityId);
        merged.push(c);
      }
    }
    return merged;
  }, [selectedCountryCode, selectedRegionName, instantCities, remoteCities, requesterRole]);

  // Notify parent of location changes
  const emitChange = (updates: Partial<CascadingLocationValue>) => {
    const countryObj = currentCountry;
    const countryName = countryObj.name;
    const countryCode = countryObj.code;
    const stateRegion = updates.stateRegion !== undefined ? updates.stateRegion : selectedRegionName;
    const city = updates.city !== undefined ? updates.city : selectedCityName;
    const cityId =
      updates.cityId !== undefined
        ? updates.cityId
        : city && stateRegion && countryName
        ? normalizeCanonicalLocationId(countryName, stateRegion, city)
        : '';

    const fullValue: CascadingLocationValue = {
      country: countryName,
      countryCode,
      stateRegion,
      city,
      cityId,
      district: updates.district !== undefined ? updates.district : selectedDistrict,
      locality: updates.locality !== undefined ? updates.locality : selectedLocality,
      postalCode: updates.postalCode !== undefined ? updates.postalCode : selectedPostalCode,
      localityType: updates.localityType || 'CITY',
    };

    onChange(fullValue);
  };

  // Handlers for cascading selections
  const handleSelectCountry = (country: CountryDef) => {
    setSelectedCountryCode(country.code);
    setCountryDropdownOpen(false);
    setCountrySearch('');

    // Rule: Selecting a new country clears the previous state and city
    const regions = getRegionsByCountry(country.code);
    const defaultRegion = regions[0]?.name || '';
    setSelectedRegionName(defaultRegion);
    setSelectedCityName('');
    setSelectedCityId('');
    setSelectedDistrict('');
    setSelectedPostalCode('');

    emitChange({
      country: country.name,
      countryCode: country.code,
      stateRegion: defaultRegion,
      city: '',
      cityId: '',
      district: '',
      postalCode: '',
    });
  };

  const handleSelectRegion = (region: RegionDef) => {
    setSelectedRegionName(region.name);
    setRegionDropdownOpen(false);
    setRegionSearch('');

    // Rule: Selecting a new state clears the previous city
    setSelectedCityName('');
    setSelectedCityId('');
    setSelectedDistrict('');

    emitChange({
      stateRegion: region.name,
      city: '',
      cityId: '',
      district: '',
    });
  };

  const handleSelectCity = (city: CityDef) => {
    setSelectedCityName(city.cityName);
    setSelectedCityId(city.cityId);
    setSelectedDistrict(city.district || '');
    if (city.postalCode && !selectedPostalCode) {
      setSelectedPostalCode(city.postalCode);
    }
    if (city.defaultLocality && !selectedLocality) {
      setSelectedLocality(city.defaultLocality);
    }
    setCityDropdownOpen(false);
    setCitySearch('');

    emitChange({
      city: city.cityName,
      cityId: city.cityId,
      district: city.district || '',
      postalCode: city.postalCode || selectedPostalCode,
      locality: city.defaultLocality || selectedLocality,
      localityType: city.localityType || 'CITY',
    });
  };

  // Submit controlled missing location request
  const handleSubmitMissingLocation = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    if (!customCityInput.trim()) return;

    setIsSubmittingCustom(true);
    try {
      const targetRegion = customRegionInput.trim() || selectedRegionName || currentCountry.name;
      const targetCity = customCityInput.trim();

      const res = await fetch('/api/locations/missing-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country: currentCountry.name,
          stateRegion: targetRegion,
          cityName: targetCity,
          district: customDistrictInput.trim(),
          postalCode: customPostalInput.trim(),
          requesterRole,
          requesterPhone: customPhoneInput.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.canonicalCity) {
        saveMissingLocationRequest(data.request);

        // Auto select the new location
        setSelectedCityName(data.canonicalCity.cityName);
        setSelectedCityId(data.canonicalCity.cityId);
        setSelectedRegionName(data.canonicalCity.stateRegion);
        setSelectedDistrict(data.canonicalCity.district || '');
        if (data.canonicalCity.postalCode) {
          setSelectedPostalCode(data.canonicalCity.postalCode);
        }

        emitChange({
          stateRegion: data.canonicalCity.stateRegion,
          city: data.canonicalCity.cityName,
          cityId: data.canonicalCity.cityId,
          district: data.canonicalCity.district || '',
          postalCode: data.canonicalCity.postalCode || selectedPostalCode,
        });

        setIsMissingModalOpen(false);
        setCustomCityInput('');
        setCustomDistrictInput('');
        setCustomPostalInput('');
      }
    } catch {
      // Fallback: local canonical generation
      const canonicalId = normalizeCanonicalLocationId(
        currentCountry.name,
        selectedRegionName,
        customCityInput.trim()
      );
      setSelectedCityName(customCityInput.trim());
      setSelectedCityId(canonicalId);
      emitChange({
        city: customCityInput.trim(),
        cityId: canonicalId,
      });
      setIsMissingModalOpen(false);
    } finally {
      setIsSubmittingCustom(false);
    }
  };

  const handleSelectDistrict = (districtName: string) => {
    setSelectedDistrict(districtName);
    setDistrictDropdownOpen(false);
    setDistrictSearch('');

    // Rule: Selecting a new district clears the previous city
    setSelectedCityName('');
    setSelectedCityId('');

    emitChange({
      district: districtName,
      city: '',
      cityId: '',
    });
  };

  const filteredDistricts = useMemo(() => {
    if (!districtSearch.trim()) return availableDistricts;
    const q = districtSearch.toLowerCase().trim();
    return availableDistricts.filter(
      (d) => d.name.toLowerCase().includes(q) || (d.code && d.code.toLowerCase().includes(q))
    );
  }, [availableDistricts, districtSearch]);

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return countries;
    const q = countrySearch.toLowerCase().trim();
    return countries.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
  }, [countries, countrySearch]);

  const filteredRegions = useMemo(() => {
    if (!regionSearch.trim()) return availableRegions;
    const q = regionSearch.toLowerCase().trim();
    return availableRegions.filter((r) => r.name.toLowerCase().includes(q) || (r.code && r.code.toLowerCase().includes(q)));
  }, [availableRegions, regionSearch]);

  const filteredCities = useMemo(() => {
    if (!citySearch.trim()) return citiesList;
    const q = citySearch.toLowerCase().trim();
    return citiesList.filter(
      (c) =>
        c.cityName.toLowerCase().includes(q) ||
        (c.district && c.district.toLowerCase().includes(q)) ||
        (c.postalCode && c.postalCode.toLowerCase().includes(q))
    );
  }, [citiesList, citySearch]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Cascading Selectors: Country -> State/Region -> (Optional District) -> City/Town */}
      <div
        className={`grid grid-cols-1 sm:grid-cols-2 ${
          hideDistrict ? 'lg:grid-cols-3' : 'lg:grid-cols-4'
        } gap-3`}
      >
        {/* STEP 1: COUNTRY SELECTOR */}
        <div className="relative space-y-1">
          <label className="block text-xs font-semibold text-slate-700">
            1. Country
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setCountryDropdownOpen(!countryDropdownOpen);
                setRegionDropdownOpen(false);
                setDistrictDropdownOpen(false);
                setCityDropdownOpen(false);
              }}
              className="w-full py-2.5 px-3 bg-white border border-slate-300 rounded-xl text-xs text-left font-medium text-slate-900 flex items-center justify-between shadow-2xs hover:border-slate-400 focus:outline-hidden focus:ring-1 focus:ring-[#003B8E] cursor-pointer"
            >
              <span className="truncate flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-[#003B8E] shrink-0" />
                <span>{currentCountry.name}</span>
                <span className="text-[10px] font-mono text-slate-400">({currentCountry.code})</span>
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>

            {countryDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="p-2 border-b border-slate-100 bg-slate-50">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      autoFocus
                      value={countrySearch}
                      onChange={(e) => setCountrySearch(e.target.value)}
                      placeholder="Search country..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-[#003B8E]"
                    />
                  </div>
                </div>
                <div className="max-h-56 overflow-y-auto divide-y divide-slate-50 text-xs">
                  {filteredCountries.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => handleSelectCountry(c)}
                      className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-slate-100 transition-colors cursor-pointer ${
                        c.code === selectedCountryCode ? 'bg-blue-50/70 font-bold text-[#003B8E]' : 'text-slate-700'
                      }`}
                    >
                      <span className="truncate">{c.name}</span>
                      <span className="text-[10px] font-mono text-slate-400">{c.code}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* STEP 2: STATE / PROVINCE / REGION SELECTOR */}
        <div className="relative space-y-1">
          <label className="block text-xs font-semibold text-slate-700">
            2. {currentCountry.regionLabel}
          </label>
          <div className="relative">
            <button
              type="button"
              disabled={!selectedCountryCode}
              onClick={() => {
                setRegionDropdownOpen(!regionDropdownOpen);
                setCountryDropdownOpen(false);
                setDistrictDropdownOpen(false);
                setCityDropdownOpen(false);
              }}
              className="w-full py-2.5 px-3 bg-white border border-slate-300 rounded-xl text-xs text-left font-medium text-slate-900 flex items-center justify-between shadow-2xs hover:border-slate-400 focus:outline-hidden focus:ring-1 focus:ring-[#003B8E] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              <span className="truncate">
                {selectedRegionName || `Select ${currentCountry.regionLabel}...`}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>

            {regionDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="p-2 border-b border-slate-100 bg-slate-50">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      autoFocus
                      value={regionSearch}
                      onChange={(e) => setRegionSearch(e.target.value)}
                      placeholder={`Search ${currentCountry.regionLabel.toLowerCase()}...`}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-[#003B8E]"
                    />
                  </div>
                </div>
                <div className="max-h-56 overflow-y-auto divide-y divide-slate-50 text-xs">
                  {filteredRegions.length === 0 ? (
                    <div className="p-3 text-center text-slate-400 text-xs">
                      No matching {currentCountry.regionLabel.toLowerCase()} found.
                    </div>
                  ) : (
                    filteredRegions.map((r) => (
                      <button
                        key={r.name}
                        type="button"
                        onClick={() => handleSelectRegion(r)}
                        className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-slate-100 transition-colors cursor-pointer ${
                          r.name === selectedRegionName ? 'bg-blue-50/70 font-bold text-[#003B8E]' : 'text-slate-700'
                        }`}
                      >
                        <span className="truncate">{r.name}</span>
                        {r.regionType && (
                          <span className="text-[10px] text-slate-400">{r.regionType}</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* STEP 3: DISTRICT / COUNTY / EQUIVALENT AREA SELECTOR */}
        {!hideDistrict && (
          <div className="relative space-y-1">
            <label className="block text-xs font-semibold text-slate-700">
              3. {currentCountry.districtLabel || 'District / County'}
            </label>
            <div className="relative">
              <button
                type="button"
                disabled={!selectedRegionName}
                onClick={() => {
                  setDistrictDropdownOpen(!districtDropdownOpen);
                  setCountryDropdownOpen(false);
                  setRegionDropdownOpen(false);
                  setCityDropdownOpen(false);
                }}
                className="w-full py-2.5 px-3 bg-white border border-slate-300 rounded-xl text-xs text-left font-medium text-slate-900 flex items-center justify-between shadow-2xs hover:border-slate-400 focus:outline-hidden focus:ring-1 focus:ring-[#003B8E] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                <span className="truncate">
                  {selectedDistrict || `All ${currentCountry.districtLabel || 'Districts'} (Optional)`}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>

              {districtDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden min-w-[240px]">
                  <div className="p-2 border-b border-slate-100 bg-slate-50">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        autoFocus
                        value={districtSearch}
                        onChange={(e) => setDistrictSearch(e.target.value)}
                        placeholder={`Search ${currentCountry.districtLabel.toLowerCase()}...`}
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-[#003B8E]"
                      />
                    </div>
                  </div>
                  <div className="max-h-56 overflow-y-auto divide-y divide-slate-50 text-xs">
                    <button
                      type="button"
                      onClick={() => handleSelectDistrict('')}
                      className={`w-full px-3 py-2 text-left italic text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer ${
                        !selectedDistrict ? 'bg-blue-50/70 font-bold text-[#003B8E]' : ''
                      }`}
                    >
                      All {currentCountry.districtLabel || 'Districts'}
                    </button>
                    {filteredDistricts.length === 0 ? (
                      <div className="p-3 text-center text-slate-400 text-xs">
                        No district pre-indexed. You can select a city directly or type a custom district.
                      </div>
                    ) : (
                      filteredDistricts.map((d) => (
                        <button
                          key={d.code || d.name}
                          type="button"
                          onClick={() => handleSelectDistrict(d.name)}
                          className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-slate-100 transition-colors cursor-pointer ${
                            d.name === selectedDistrict ? 'bg-blue-50/70 font-bold text-[#003B8E]' : 'text-slate-700'
                          }`}
                        >
                          <span className="truncate">{d.name}</span>
                          {d.districtType && (
                            <span className="text-[10px] text-slate-400">{d.districtType}</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 4: CITY / TOWN SELECTOR */}
        <div className="relative space-y-1">
          <label className="block text-xs font-semibold text-slate-700">
            {hideDistrict ? '3. City / Town' : '4. City / Town'}
          </label>
          <div className="relative">
            <button
              type="button"
              disabled={!selectedRegionName}
              onClick={() => {
                setCityDropdownOpen(!cityDropdownOpen);
                setCountryDropdownOpen(false);
                setRegionDropdownOpen(false);
                setDistrictDropdownOpen(false);
              }}
              className="w-full py-2.5 px-3 bg-white border border-slate-300 rounded-xl text-xs text-left font-medium text-slate-900 flex items-center justify-between shadow-2xs hover:border-slate-400 focus:outline-hidden focus:ring-1 focus:ring-[#003B8E] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              <span className="truncate flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#003B8E] shrink-0" />
                <span>{selectedCityName || 'Select city or town...'}</span>
              </span>
              <div className="flex items-center gap-1">
                {isLoadingCities && <Loader2 className="w-3 h-3 text-slate-400 animate-spin" />}
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </div>
            </button>

            {cityDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden min-w-[280px]">
                <div className="p-2 border-b border-slate-100 bg-slate-50 space-y-1.5">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      autoFocus
                      value={citySearch}
                      onChange={(e) => setCitySearch(e.target.value)}
                      placeholder="Search city or town..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-[#003B8E]"
                    />
                  </div>
                  <div className="text-[10px] text-slate-500 px-1">
                    Showing places in {selectedRegionName}, {currentCountry.name}
                  </div>
                </div>

                <div className="max-h-56 overflow-y-auto divide-y divide-slate-50 text-xs">
                  {filteredCities.length === 0 ? (
                    <div className="p-4 text-center space-y-2">
                      <p className="text-slate-500 text-xs">
                        No city or town found matching &ldquo;{citySearch}&rdquo; in {selectedRegionName}.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setCityDropdownOpen(false);
                          setCustomCityInput(citySearch);
                          setCustomRegionInput(selectedRegionName);
                          setIsMissingModalOpen(true);
                        }}
                        className="text-xs font-semibold text-[#003B8E] underline hover:text-[#002D6E] cursor-pointer"
                      >
                        + Request or add missing city
                      </button>
                    </div>
                  ) : (
                    filteredCities.map((city) => (
                      <button
                        key={city.cityId}
                        type="button"
                        onClick={() => handleSelectCity(city)}
                        className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-slate-100 transition-colors cursor-pointer ${
                          city.cityName.toLowerCase() === selectedCityName.toLowerCase()
                            ? 'bg-blue-50/70 font-bold text-[#003B8E]'
                            : 'text-slate-700'
                        }`}
                      >
                        <div className="truncate pr-2">
                          <span className="font-medium text-slate-900">{city.cityName}</span>
                          {city.district && city.district !== city.cityName && (
                            <span className="text-[11px] text-slate-500 block truncate">
                              {city.district}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 shrink-0 uppercase">
                          {city.localityType || 'CITY'}
                        </span>
                      </button>
                    ))
                  )}
                </div>

                {/* Footer link to add a missing location */}
                <div className="p-2 border-t border-slate-100 bg-slate-50 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setCityDropdownOpen(false);
                      setCustomCityInput(citySearch);
                      setCustomRegionInput(selectedRegionName);
                      setIsMissingModalOpen(true);
                    }}
                    className="text-[11px] font-semibold text-[#003B8E] hover:text-[#002D6E] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Don&apos;t see your city or town? Add it</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* OPTIONAL LOCALITY / NEIGHBORHOOD FIELD */}
      {shouldShowLocality && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">
              {localityLabel}
            </label>
            <input
              type="text"
              value={selectedLocality}
              onChange={(e) => {
                setSelectedLocality(e.target.value);
                emitChange({ locality: e.target.value });
              }}
              placeholder="e.g. Vazirabad, Bandra West, Downtown, Kothrud"
              className="w-full py-2.5 px-3 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-[#003B8E]"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">
              {currentCountry.postalLabel}
            </label>
            <input
              type="text"
              value={selectedPostalCode}
              onChange={(e) => {
                setSelectedPostalCode(e.target.value);
                emitChange({ postalCode: e.target.value });
              }}
              placeholder={`e.g. ${currentCountry.code === 'IN' ? '431601' : currentCountry.code === 'US' ? '10012' : 'Postcode'}`}
              className="w-full py-2.5 px-3 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-[#003B8E]"
            />
          </div>
        </div>
      )}

      {/* CANONICAL ID BADGE & ACTIVE SUMMARY */}
      {selectedCityName && (
        <div className="p-3 bg-blue-50/60 border border-blue-200/70 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-[#003B8E] shrink-0" />
            <span className="font-semibold text-slate-900">
              {selectedCityName}, {selectedRegionName}, {currentCountry.name}
            </span>
          </div>
          <div className="font-mono text-[11px] text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
            ID: {selectedCityId || normalizeCanonicalLocationId(currentCountry.name, selectedRegionName, selectedCityName)}
          </div>
        </div>
      )}

      {/* CONTROLLED "REQUEST OR ADD A MISSING LOCATION" MODAL */}
      {isMissingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="font-bold text-sm text-slate-900">Add Missing City or Town</h4>
                <p className="text-[11px] text-slate-500">
                  Register any valid city or town in {currentCountry.name} to start shopping or selling.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMissingModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  City or Town Name *
                </label>
                <input
                  type="text"
                  required
                  value={customCityInput}
                  onChange={(e) => setCustomCityInput(e.target.value)}
                  placeholder="e.g. Mudkhed, Loha, Whitby, Hakuba"
                  className="w-full p-2.5 border border-slate-300 rounded-lg bg-slate-50 font-medium focus:outline-hidden focus:border-[#003B8E] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  {currentCountry.regionLabel} *
                </label>
                <input
                  type="text"
                  required
                  value={customRegionInput || selectedRegionName}
                  onChange={(e) => setCustomRegionInput(e.target.value)}
                  placeholder={`e.g. ${selectedRegionName}`}
                  className="w-full p-2.5 border border-slate-300 rounded-lg bg-slate-50 font-medium focus:outline-hidden focus:border-[#003B8E] focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    {currentCountry.districtLabel} (Optional)
                  </label>
                  <input
                    type="text"
                    value={customDistrictInput}
                    onChange={(e) => setCustomDistrictInput(e.target.value)}
                    placeholder="e.g. Nanded District"
                    className="w-full p-2.5 border border-slate-300 rounded-lg bg-slate-50 focus:outline-hidden focus:border-[#003B8E] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    {currentCountry.postalLabel} (Optional)
                  </label>
                  <input
                    type="text"
                    value={customPostalInput}
                    onChange={(e) => setCustomPostalInput(e.target.value)}
                    placeholder="e.g. 431601"
                    className="w-full p-2.5 border border-slate-300 rounded-lg bg-slate-50 focus:outline-hidden focus:border-[#003B8E] focus:bg-white"
                  />
                </div>
              </div>

              {requesterRole === 'SELLER' && (
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Contact Phone (For verification review)
                  </label>
                  <input
                    type="text"
                    value={customPhoneInput}
                    onChange={(e) => setCustomPhoneInput(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full p-2.5 border border-slate-300 rounded-lg bg-slate-50 font-mono focus:outline-hidden focus:border-[#003B8E] focus:bg-white"
                  />
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsMissingModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitMissingLocation}
                  disabled={isSubmittingCustom}
                  className="px-5 py-2 rounded-lg bg-[#003B8E] text-white font-semibold hover:bg-[#002D6E] disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingCustom ? 'Registering...' : 'Save & Select Location'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
