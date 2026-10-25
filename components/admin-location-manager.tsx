'use client';

import React, { useState, useMemo } from 'react';
import {
  MapPin,
  Search,
} from 'lucide-react';
import {
  getAllCountries,
  getRegionsByCountry,
  getCitiesByCountryAndRegion,
  loadMissingLocationRequests,
  MissingLocationRequest,
  saveMissingLocationRequest,
} from '@/lib/location-service';
import { LocalStore } from '@/lib/catalog-data';

interface AdminLocationManagerProps {
  stores: LocalStore[];
}

export function AdminLocationManager({ stores }: AdminLocationManagerProps) {
  const [activeTab, setActiveTab] = useState<'hierarchy' | 'requests' | 'stores'>('hierarchy');
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>('IN');
  const [selectedRegionName, setSelectedRegionName] = useState<string>('Maharashtra');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [missingRequests, setMissingRequests] = useState<MissingLocationRequest[]>(() =>
    loadMissingLocationRequests()
  );

  const countries = useMemo(() => getAllCountries(), []);
  const currentCountry = useMemo(() => {
    return countries.find((c) => c.code === selectedCountryCode) || countries[0];
  }, [countries, selectedCountryCode]);

  const regions = useMemo(() => {
    return getRegionsByCountry(currentCountry.code);
  }, [currentCountry]);

  const cities = useMemo(() => {
    return getCitiesByCountryAndRegion(currentCountry.code, selectedRegionName, searchQuery);
  }, [currentCountry, selectedRegionName, searchQuery]);

  // Stores grouped by canonical cityId
  const storesByCityId = useMemo(() => {
    const map = new Map<string, LocalStore[]>();
    stores.forEach((st) => {
      const cid = st.cityId || 'unassigned';
      const arr = map.get(cid) || [];
      arr.push(st);
      map.set(cid, arr);
    });
    return map;
  }, [stores]);

  const handleApproveRequest = (req: MissingLocationRequest) => {
    const updated: MissingLocationRequest = {
      ...req,
      status: 'APPROVED',
    };
    saveMissingLocationRequest(updated);
    setMissingRequests((prev) => [updated, ...prev.filter((r) => r.id !== req.id)]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[#003B8E] text-white">
              Super Admin Workspace
            </span>
            <span className="text-xs text-slate-500">Authoritative Directory</span>
          </div>
          <h2 className="text-xl font-extrabold tracking-tight text-slate-900 mt-1">
            Global Location Hierarchy &amp; Canonical Matcher
          </h2>
          <p className="text-xs text-slate-500">
            Audit canonical IDs, inspect supported countries/states/cities, review missing place requests, and view registered stores per city.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('hierarchy')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer tabular-nums ${
              activeTab === 'hierarchy' ? 'bg-white text-[#003B8E] font-bold shadow-xs' : 'text-slate-600'
            }`}
          >
            Location Tree ({countries.length} Countries)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('requests')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer tabular-nums ${
              activeTab === 'requests' ? 'bg-white text-[#003B8E] font-bold shadow-xs' : 'text-slate-600'
            }`}
          >
            Missing Place Requests ({missingRequests.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('stores')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer tabular-nums ${
              activeTab === 'stores' ? 'bg-white text-[#003B8E] font-bold shadow-xs' : 'text-slate-600'
            }`}
          >
            Store Mapping ({stores.length} Stores)
          </button>
        </div>
      </div>

      {/* TAB 1: LOCATION HIERARCHY EXPLORER */}
      {activeTab === 'hierarchy' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Country Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Country</label>
              <select
                value={selectedCountryCode}
                onChange={(e) => {
                  setSelectedCountryCode(e.target.value);
                  const firstReg = getRegionsByCountry(e.target.value)[0]?.name || '';
                  setSelectedRegionName(firstReg);
                }}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white font-semibold"
              >
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Region Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                {currentCountry.regionLabel}
              </label>
              <select
                value={selectedRegionName}
                onChange={(e) => setSelectedRegionName(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white font-semibold"
              >
                {regions.map((r) => (
                  <option key={r.name} value={r.name}>
                    {r.name} {r.regionType ? `(${r.regionType})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* City Search */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Search Places</label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search city, town, or PIN..."
                  className="w-full text-xs pl-8 pr-3 py-2.5 rounded-xl border border-slate-300 bg-white font-semibold"
                />
              </div>
            </div>
          </div>

          {/* Cities List */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-900">
                Cities &amp; Populated Places in {selectedRegionName}, {currentCountry.name}
              </span>
              <span className="text-slate-500 font-mono tabular-nums">{cities.length} places registered</span>
            </div>

            {cities.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No cities currently loaded for this region. Merchants or buyers can register small towns using the missing location workflow.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto text-xs">
                {cities.map((city) => {
                  const linkedStores = storesByCityId.get(city.cityId) || [];
                  return (
                    <div
                      key={city.cityId}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/50"
                    >
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-[#003B8E] shrink-0" />
                          <span>{city.cityName}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                            {city.localityType || 'CITY'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {city.district ? `${city.district} · ` : ''}
                          {city.postalCode ? `Postal: ${city.postalCode} · ` : ''}
                          Canonical ID: <code className="font-mono bg-slate-100 px-1 rounded text-slate-800">{city.cityId}</code>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold tabular-nums ${
                          linkedStores.length > 0
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {linkedStores.length} {linkedStores.length === 1 ? 'store' : 'stores'} registered
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: MISSING PLACE REQUESTS */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900">
              Community &amp; Merchant Location Submissions
            </h3>
            <span className="text-xs text-slate-500">
              Auto-approved to unblock registration; reviewable here
            </span>
          </div>

          {missingRequests.length === 0 ? (
            <div className="p-10 rounded-2xl bg-white border border-slate-200 text-center text-xs text-slate-500">
              No custom missing place requests have been submitted yet.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="py-3 px-4 font-bold text-slate-900">City / Town</th>
                    <th className="py-3 px-4 font-bold text-slate-900">Region / Country</th>
                    <th className="py-3 px-4 font-bold text-slate-900">Canonical City ID</th>
                    <th className="py-3 px-4 font-bold text-slate-900">Requester</th>
                    <th className="py-3 px-4 font-bold text-slate-900 text-center">Status</th>
                    <th className="py-3 px-4 font-bold text-slate-900 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {missingRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-bold text-slate-900">{req.cityName}</td>
                      <td className="py-3 px-4 text-slate-700">{req.stateRegion}, {req.country}</td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600">{req.canonicalCityId}</td>
                      <td className="py-3 px-4 text-slate-600">
                        {req.requesterRole} {req.requesterPhone && `(${req.requesterPhone})`}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                          req.status === 'APPROVED'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {req.status !== 'APPROVED' ? (
                          <button
                            type="button"
                            onClick={() => handleApproveRequest(req)}
                            className="text-emerald-700 font-bold hover:underline cursor-pointer"
                          >
                            Approve
                          </button>
                        ) : (
                          <span className="text-slate-400">Verified</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: REGISTERED STORES BY CANONICAL LOCATION */}
      {activeTab === 'stores' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900">
              Active Stores Mapped to Canonical Locations
            </h3>
            <span className="text-xs text-slate-500">
              Matches buyer location filter 1:1
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stores.map((st) => (
              <div
                key={st.id}
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-slate-900">{st.name}</h4>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                    st.isActive ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {st.isActive ? 'Active' : 'Paused'}
                  </span>
                </div>
                <div className="text-xs text-slate-600">
                  {st.category} · {st.address}
                </div>
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span className="font-semibold text-slate-800">
                    {st.cityName}, {st.stateRegion}, {st.country}
                  </span>
                  <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                    {st.cityId}
                  </code>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
