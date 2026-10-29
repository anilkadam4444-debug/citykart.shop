'use client';

import React, {useState, useMemo} from 'react';
import {
  MapPin,
  Navigation,
  Check,
  X,
  AlertCircle,
  Loader2,
  Store,
  Compass,
  Lock,
} from 'lucide-react';
import {
  CustomerShoppingLocation,
  LocalStore,
  normalizeCityId,
  resolveNearestCityFromCoordinates,
} from '@/lib/catalog-data';
import {
  CascadingLocationSelector,
  SelectedLocationPayload,
} from './cascading-location-selector';

interface LocationSelectorModalProps {
  isOpen: boolean;
  canClose: boolean;
  isCityLocked?: boolean;
  currentLocation: CustomerShoppingLocation;
  stores: LocalStore[];
  onConfirmLocation: (location: CustomerShoppingLocation) => void;
  onClose: () => void;
}

const QUICK_GLOBAL_CITIES = [
  {
    country: 'India',
    stateRegion: 'Maharashtra',
    city: 'Nanded',
    locality: 'Vazirabad',
  },
  {
    country: 'India',
    stateRegion: 'Maharashtra',
    city: 'Pune',
    locality: 'Kothrud',
  },
  {
    country: 'India',
    stateRegion: 'Maharashtra',
    city: 'Mumbai',
    locality: 'Bandra West',
  },
  {
    country: 'United Kingdom',
    stateRegion: 'England',
    city: 'London',
    locality: 'Shoreditch',
  },
  {
    country: 'Japan',
    stateRegion: 'Tokyo',
    city: 'Tokyo',
    locality: 'Shibuya',
  },
  {
    country: 'United States',
    stateRegion: 'New York',
    city: 'New York',
    locality: 'SoHo',
  },
];

export function LocationSelectorModal({
  isOpen,
  canClose,
  isCityLocked = false,
  currentLocation,
  stores,
  onConfirmLocation,
  onClose,
}: LocationSelectorModalProps) {
  const [selectedLoc, setSelectedLoc] = useState<SelectedLocationPayload>({
    country: currentLocation.country || 'India',
    countryCode: currentLocation.countryCode || 'IN',
    stateRegion: currentLocation.stateRegion || 'Maharashtra',
    district: currentLocation.district,
    localityType: currentLocation.localityType || 'CITY',
    city: currentLocation.city || 'Nanded',
    cityId:
      currentLocation.cityId ||
      normalizeCityId(
        currentLocation.country || 'India',
        currentLocation.stateRegion || 'Maharashtra',
        currentLocation.city || 'Nanded'
      ),
    locality: currentLocation.locality || '',
    postalCode: currentLocation.postalCode,
  });

  // Geolocation detection states
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [geoErrorMsg, setGeoErrorMsg] = useState<string | null>(null);
  const [detectedCandidate, setDetectedCandidate] =
    useState<SelectedLocationPayload | null>(null);

  // Active stores count in currently chosen city
  const activeStoresInSelection = useMemo(() => {
    if (!selectedLoc.city || !selectedLoc.country) return 0;
    const cid =
      selectedLoc.cityId ||
      normalizeCityId(
        selectedLoc.country,
        selectedLoc.stateRegion || selectedLoc.country,
        selectedLoc.city
      );

    return stores.filter((s) => {
      if (!s.isActive) return false;
      if (s.cityId === cid) return true;
      if (s.servedCityIds?.includes(cid)) return true;
      return (
        s.cityName.toLowerCase() === selectedLoc.city.toLowerCase() &&
        s.country.toLowerCase() === selectedLoc.country.toLowerCase()
      );
    }).length;
  }, [stores, selectedLoc]);

  if (!isOpen) return null;

  if (isCityLocked) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-locked-heading"
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
      >
        <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden p-5 sm:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#003B8E] shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#003B8E] block">
                  Hyperlocal Marketplace
                </span>
                <h2
                  id="location-locked-heading"
                  className="text-base sm:text-lg font-bold text-slate-900"
                >
                  Buyer City Locked to {currentLocation.city}
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="min-w-[40px] min-h-[40px] rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 inline-flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Your shopping city was locked to{' '}
            <strong className="text-slate-900">{currentLocation.city}</strong>{' '}
            during login. Because Citykart is a hyperlocal marketplace, product
            discovery and doorstep delivery are strictly restricted within{' '}
            <strong className="text-slate-900">{currentLocation.city}</strong>{' '}
            only.
          </p>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#F96302] shrink-0" />
              <div>
                <div className="font-bold text-slate-900">
                  {currentLocation.city}
                  {currentLocation.locality
                    ? ` · ${currentLocation.locality}`
                    : ''}
                </div>
                <div className="text-[11px] text-slate-500">
                  {currentLocation.stateRegion}, {currentLocation.country}
                </div>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-[#003B8E] text-[10px] font-bold">
              Locked
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl bg-[#003B8E] hover:bg-[#002D6E] text-white text-xs font-bold cursor-pointer transition-colors"
          >
            Continue Shopping in {currentLocation.city}
          </button>
        </div>
      </div>
    );
  }

  const handleUseCurrentLocation = () => {
    setGeoErrorMsg(null);
    setDetectedCandidate(null);

    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setGeoErrorMsg('Geolocation is not supported in this browser. Please select your location from the dropdowns below.');
      return;
    }

    setIsDetecting(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const {latitude, longitude} = position.coords;
        try {
          const response = await fetch('/api/location/reverse-geocode', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({lat: latitude, lng: longitude}),
          });

          if (response.ok) {
            const data = await response.json();
            if (data && data.city && data.country) {
              const cId =
                data.cityId ||
                normalizeCityId(
                  String(data.country),
                  String(data.stateRegion || data.country),
                  String(data.city)
                );
              const payload: SelectedLocationPayload = {
                country: String(data.country),
                countryCode: data.countryCode ? String(data.countryCode) : undefined,
                stateRegion: String(data.stateRegion || data.country),
                district: data.district ? String(data.district) : undefined,
                city: String(data.city),
                cityId: cId,
                locality: String(data.locality || ''),
                postalCode: data.postalCode ? String(data.postalCode) : undefined,
                source: 'REVERSE_GEOCODED',
              };
              setDetectedCandidate(payload);
              setSelectedLoc(payload);
              setIsDetecting(false);
              return;
            }
          }

          // Fallback nearest city from coordinates
          const fallback = resolveNearestCityFromCoordinates(latitude, longitude);
          const payload: SelectedLocationPayload = {
            country: fallback.cityRecord.country,
            countryCode: fallback.cityRecord.countryCode,
            stateRegion: fallback.cityRecord.stateRegion,
            district: fallback.cityRecord.district,
            city: fallback.cityRecord.cityName,
            cityId: fallback.cityRecord.cityId,
            locality: fallback.cityRecord.defaultLocality,
            source: 'FALLBACK_NEAREST',
          };
          setDetectedCandidate(payload);
          setSelectedLoc(payload);
          setIsDetecting(false);
        } catch {
          setIsDetecting(false);
          setGeoErrorMsg('Could not detect your exact city. Please select using the cascading dropdowns below.');
        }
      },
      (error) => {
        setIsDetecting(false);
        if (error.code === 1) {
          setGeoErrorMsg('Location permission was denied. You can select your country, state, and city below.');
        } else {
          setGeoErrorMsg('Could not detect your GPS location. Please select below.');
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 60000,
      }
    );
  };

  const handleSelectQuickCity = (quick: typeof QUICK_GLOBAL_CITIES[0]) => {
    const cId = normalizeCityId(quick.country, quick.stateRegion, quick.city);
    setSelectedLoc({
      country: quick.country,
      stateRegion: quick.stateRegion,
      city: quick.city,
      cityId: cId,
      locality: quick.locality,
      localityType: 'CITY',
    });
    setDetectedCandidate(null);
    setGeoErrorMsg(null);
  };

  const handleConfirm = () => {
    if (!selectedLoc.city.trim()) {
      setGeoErrorMsg('Please select a city or town to continue.');
      return;
    }

    const effectiveCityId =
      selectedLoc.cityId ||
      normalizeCityId(
        selectedLoc.country,
        selectedLoc.stateRegion || selectedLoc.country,
        selectedLoc.city
      );

    onConfirmLocation({
      mode: 'SELECTED_LOCATION',
      country: selectedLoc.country.trim(),
      countryCode: selectedLoc.countryCode,
      stateRegion: selectedLoc.stateRegion.trim() || selectedLoc.country.trim(),
      district: selectedLoc.district,
      localityType: selectedLoc.localityType || 'CITY',
      city: selectedLoc.city.trim(),
      cityId: effectiveCityId,
      locality: (selectedLoc.locality || '').trim(),
      postalCode: selectedLoc.postalCode,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="location-dialog-heading"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
    >
      <div className="relative w-full max-w-xl max-h-[92dvh] flex flex-col bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden my-auto">
        {/* Top Header */}
        <div className="px-4 sm:px-6 pt-5 pb-4 border-b border-slate-200 bg-slate-50/70 flex items-start justify-between gap-3 shrink-0">
          <div className="space-y-1 min-w-0">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#003B8E]">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span>Hyperlocal Shopping Location</span>
            </div>
            <h2
              id="location-dialog-heading"
              className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight"
            >
              Select your city or town
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Choose your country, state/region, and city to discover verified local stores delivering directly to your neighborhood.
            </p>
          </div>

          {canClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close location selector"
              className="min-w-[44px] min-h-[44px] rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 inline-flex items-center justify-center transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-4 sm:p-6 space-y-5 flex-1 overflow-y-auto overscroll-contain custom-scrollbar">
          {/* Geolocation action + quick popular cities */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <button
                type="button"
                disabled={isDetecting}
                onClick={handleUseCurrentLocation}
                className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-[#003B8E] hover:bg-[#002D6E] disabled:bg-slate-400 text-white text-xs font-semibold transition-colors inline-flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                {isDetecting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Detecting current location...</span>
                  </>
                ) : (
                  <>
                    <Navigation className="w-3.5 h-3.5" />
                    <span>Auto-detect GPS location</span>
                  </>
                )}
              </button>

              <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                <Compass className="w-3.5 h-3.5 text-[#003B8E] shrink-0" />
                <span>Or pick a popular city:</span>
              </div>
            </div>

            {/* Quick city chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              {QUICK_GLOBAL_CITIES.map((q) => {
                const isSelected =
                  selectedLoc.city.toLowerCase() === q.city.toLowerCase() &&
                  selectedLoc.country.toLowerCase() === q.country.toLowerCase();
                return (
                  <button
                    key={`${q.country}-${q.city}`}
                    type="button"
                    onClick={() => handleSelectQuickCity(q)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-[#003B8E] bg-[#003B8E] text-white shadow-2xs'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {q.city} <span className="text-[10px] opacity-75">({q.country})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Geolocation Error Alert */}
          {geoErrorMsg && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <span>{geoErrorMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setGeoErrorMsg(null)}
                className="text-xs font-semibold text-amber-900 hover:text-slate-900 shrink-0 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Detected Candidate Card */}
          {detectedCandidate && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                <div>
                  <strong>Detected:</strong> {detectedCandidate.city}, {detectedCandidate.stateRegion}, {detectedCandidate.country}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetectedCandidate(null)}
                className="text-[11px] font-semibold text-emerald-800 underline cursor-pointer"
              >
                Clear
              </button>
            </div>
          )}

          {/* Cascading Dropdowns Component */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <CascadingLocationSelector
              selectedCountry={selectedLoc.country}
              selectedStateRegion={selectedLoc.stateRegion}
              selectedCity={selectedLoc.city}
              selectedLocality={selectedLoc.locality}
              selectedDistrict={selectedLoc.district}
              selectedPostalCode={selectedLoc.postalCode}
              selectedLocalityType={selectedLoc.localityType}
              onChange={(payload) => {
                setSelectedLoc(payload);
                setGeoErrorMsg(null);
              }}
              allowLocalityInput={true}
              showMissingLocationButton={true}
            />
          </div>

          {/* Active Store Availability Card */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200/60 flex items-center justify-center text-[#003B8E] shrink-0">
                <Store className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">
                  {selectedLoc.city ? (
                    <>
                      <span>{selectedLoc.city}</span>
                      {selectedLoc.stateRegion ? `, ${selectedLoc.stateRegion}` : ''}
                      {selectedLoc.country ? ` (${selectedLoc.country})` : ''}
                    </>
                  ) : (
                    'No city selected'
                  )}
                </div>
                <div className="text-[11px] text-slate-500">
                  {activeStoresInSelection > 0 ? (
                    <span className="text-emerald-700 font-semibold">
                      {activeStoresInSelection} local verified {activeStoresInSelection === 1 ? 'store' : 'stores'} currently serving this city
                    </span>
                  ) : (
                    <span>No stores registered yet — be the first to launch a store here!</span>
                  )}
                </div>
              </div>
            </div>

            <span className="text-[10px] font-mono font-semibold uppercase px-2 py-1 rounded bg-slate-100 text-slate-600 shrink-0">
              {selectedLoc.localityType || 'CITY'}
            </span>
          </div>

          {/* Bottom Action Footer */}
          <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-200">
            <div className="text-xs text-slate-500">
              Location ID:{' '}
              <code className="text-[11px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-800">
                {selectedLoc.cityId || normalizeCityId(selectedLoc.country, selectedLoc.stateRegion || selectedLoc.country, selectedLoc.city)}
              </code>
            </div>

            <button
              type="button"
              disabled={!selectedLoc.city.trim()}
              onClick={handleConfirm}
              className="px-6 py-2.5 rounded-xl bg-[#F96302] hover:bg-[#E05500] disabled:bg-slate-300 text-white text-xs sm:text-sm font-bold transition-colors inline-flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <Check className="w-4 h-4" />
              <span>Show Stores in {selectedLoc.city || 'This City'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
