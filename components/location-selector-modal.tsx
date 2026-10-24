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
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div className="relative w-full max-w-xl bg-white border border-stone-200 rounded-2xl shadow-2xl overflow-hidden my-6">
        {/* Top Header */}
        <div className="px-6 pt-6 pb-4 border-b border-stone-200 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600">
              <MapPin className="w-3.5 h-3.5 text-stone-900" />
              <span>Hyperlocal Shopping Location</span>
            </div>
            <h2
              id="location-dialog-heading"
              className="text-xl sm:text-2xl font-semibold text-stone-900"
            >
              Select your city or town
            </h2>
            <p className="text-xs sm:text-sm text-stone-600">
              Choose your exact country, state/region, and city to discover local verified retailers and products serving your neighborhood.
            </p>
          </div>

          {canClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close location selector"
              className="p-2 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-6 space-y-5 max-h-[78vh] overflow-y-auto">
          {/* Geolocation action + quick popular cities */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <button
                type="button"
                disabled={isDetecting}
                onClick={handleUseCurrentLocation}
                className="w-full sm:w-auto py-2 px-3.5 rounded-xl bg-stone-900 hover:bg-stone-800 disabled:bg-stone-400 text-white text-xs font-medium transition-colors inline-flex items-center justify-center gap-2 cursor-pointer shadow-xs"
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

              <div className="text-[11px] text-stone-500 flex items-center gap-1">
                <Compass className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                <span>Or pick a popular hub:</span>
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
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-stone-900 bg-stone-900 text-white shadow-xs'
                        : 'border-stone-200 bg-[#FAF9F6] text-stone-700 hover:border-stone-400 hover:text-stone-900'
                    }`}
                  >
                    {q.city} <span className="text-[10px] opacity-70">({q.country})</span>
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
                className="text-xs font-medium text-amber-900 hover:text-stone-900 shrink-0 cursor-pointer"
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
                className="text-[11px] font-medium text-emerald-800 underline cursor-pointer"
              >
                Clear
              </button>
            </div>
          )}

          {/* Cascading Dropdowns Component */}
          <div className="p-4 rounded-xl bg-[#FAF9F6] border border-stone-200">
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
          <div className="p-3.5 rounded-xl border border-stone-200 bg-white flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center text-stone-800 shrink-0">
                <Store className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-medium text-stone-900">
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
                <div className="text-[11px] text-stone-500">
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

            <span className="text-[10px] font-mono uppercase px-2 py-1 rounded bg-stone-100 text-stone-600 shrink-0">
              {selectedLoc.localityType || 'CITY'}
            </span>
          </div>

          {/* Bottom Action Footer */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-stone-100">
            <div className="text-xs text-stone-600">
              Canonical ID:{' '}
              <code className="text-[11px] font-mono bg-stone-100 px-1.5 py-0.5 rounded text-stone-800">
                {selectedLoc.cityId || normalizeCityId(selectedLoc.country, selectedLoc.stateRegion || selectedLoc.country, selectedLoc.city)}
              </code>
            </div>

            <button
              type="button"
              disabled={!selectedLoc.city.trim()}
              onClick={handleConfirm}
              className="px-6 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 text-white text-xs sm:text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <Check className="w-4 h-4" />
              <span>Show stores in this city</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
