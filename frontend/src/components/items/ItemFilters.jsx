/**
 * ItemFilters — Search + filter bar
 * Clean, professional, consistent with design system
 */

import { useState, useEffect } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { db } from '../../lib/supabase';

const ItemFilters = ({ filters, onFilterChange, onSearch }) => {
  const [categories, setCategories] = useState([]);
  const [areas, setAreas]           = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [searchInput, setSearchInput] = useState(filters.search || '');

  useEffect(() => {
    const load = async () => {
      try {
        const [cats, areasData] = await Promise.all([
          db.categories.getAll(),
          db.areas.getAll(),
        ]);
        setCategories(cats || []);
        setAreas(areasData || []);
      } catch {}
    };
    load();
  }, []);

  const areasByZone = areas.reduce((acc, area) => {
    if (!acc[area.zone]) acc[area.zone] = [];
    acc[area.zone].push(area);
    return acc;
  }, {});

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    onSearch(searchInput);
  };

  const handleFilter = (key, value) =>
    onFilterChange({ ...filters, [key]: value || null });

  const clearAll = () => {
    setSearchInput('');
    onFilterChange({ status: 'unclaimed' });
    onSearch('');
  };

  const activeCount = [filters.categoryId, filters.areaId, filters.search].filter(Boolean).length;

  return (
    <div className="bg-white border border-surface-border rounded-xl shadow-card p-4 mb-6 space-y-3">

      {/* ── Search row ── */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-subtle pointer-events-none" />
          <input
            type="text"
            placeholder="Search items by title or description…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="input pl-9 pr-3 text-sm"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => { setSearchInput(''); onSearch(''); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button type="submit" className="btn btn-primary">
          Search
        </button>
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className={`btn btn-secondary relative ${showFilters ? 'bg-primary-50 border-primary-200 text-primary-700' : ''}`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span className="hidden sm:inline">Filters</span>
          {activeCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary-600 text-white
                             text-2xs rounded-full flex items-center justify-center font-bold">
              {activeCount}
            </span>
          )}
        </button>
      </form>

      {/* ── Filter panel ── */}
      {showFilters && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-surface-border animate-fade-in">
          {/* Category */}
          <div className="form-group">
            <label className="label">Category</label>
            <select
              value={filters.categoryId || ''}
              onChange={(e) => handleFilter('categoryId', e.target.value)}
              className="input"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
          </div>

          {/* Area */}
          <div className="form-group">
            <label className="label">Area</label>
            <select
              value={filters.areaId || ''}
              onChange={(e) => handleFilter('areaId', e.target.value)}
              className="input"
            >
              <option value="">All Areas</option>
              {Object.entries(areasByZone).map(([zone, zoneAreas]) => (
                <optgroup key={zone} label={zone}>
                  {zoneAreas.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="form-group">
            <label className="label">Status</label>
            <select
              value={filters.status || 'unclaimed'}
              onChange={(e) => handleFilter('status', e.target.value)}
              className="input"
            >
              <option value="unclaimed">Available</option>
              <option value="pending">Pending</option>
              <option value="">All</option>
            </select>
          </div>
        </div>
      )}

      {/* ── Active filter chips ── */}
      {activeCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-surface-border">
          <span className="caption">Active:</span>

          {filters.search && (
            <Chip
              label={`"${filters.search}"`}
              onRemove={() => { setSearchInput(''); onSearch(''); }}
            />
          )}
          {filters.categoryId && (
            <Chip
              label={categories.find((c) => c.id === filters.categoryId)?.name}
              onRemove={() => handleFilter('categoryId', null)}
            />
          )}
          {filters.areaId && (
            <Chip
              label={areas.find((a) => a.id === filters.areaId)?.name}
              onRemove={() => handleFilter('areaId', null)}
            />
          )}

          <button
            onClick={clearAll}
            className="text-xs font-medium text-red-600 hover:text-red-700 transition-colors ml-1"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
};

const Chip = ({ label, onRemove }) => (
  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-50 text-primary-700
                   text-xs font-medium rounded-full ring-1 ring-primary-100">
    {label}
    <button onClick={onRemove} type="button" className="hover:text-primary-900 ml-0.5">
      <X className="w-3 h-3" />
    </button>
  </span>
);

export default ItemFilters;
