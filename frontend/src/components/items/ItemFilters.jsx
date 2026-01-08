/**
 * Item Filters Component
 * Search and filter controls
 */

import { useState, useEffect } from 'react';
import { Search, Filter, X, ChevronDown } from 'lucide-react';
import { db } from '../../lib/supabase';

const ItemFilters = ({ filters, onFilterChange, onSearch }) => {
  const [categories, setCategories] = useState([]);
  const [areas, setAreas] = useState([]);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [searchInput, setSearchInput] = useState(filters.search || '');

  // Load categories and areas
  useEffect(() => {
    const loadFiltersData = async () => {
      try {
        const [categoriesData, areasData] = await Promise.all([
          db.categories.getAll(),
          db.areas.getAll(),
        ]);
        setCategories(categoriesData || []);
        setAreas(areasData || []);
      } catch (error) {
        console.error('Error loading filter data:', error);
      }
    };
    loadFiltersData();
  }, []);

  // Group areas by zone
  const areasByZone = areas.reduce((acc, area) => {
    if (!acc[area.zone]) acc[area.zone] = [];
    acc[area.zone].push(area);
    return acc;
  }, {});

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    onSearch(searchInput);
  };

  const handleFilterChange = (key, value) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    setSearchInput('');
    onFilterChange({});
    onSearch('');
  };

  const hasActiveFilters = filters.categoryId || filters.areaId || filters.search;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
      {/* Search Bar */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search for lost items..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="input pl-10 w-full"
          />
        </div>
        <button type="submit" className="btn btn-primary">
          Search
        </button>
        <button
          type="button"
          onClick={() => setShowMobileFilters(!showMobileFilters)}
          className="btn btn-secondary md:hidden flex items-center gap-2"
        >
          <Filter className="w-4 h-4" />
          Filters
        </button>
      </form>

      {/* Desktop Filters */}
      <div className={`mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 ${showMobileFilters ? '' : 'hidden md:grid'}`}>
        {/* Category Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <select
            value={filters.categoryId || ''}
            onChange={(e) => handleFilterChange('categoryId', e.target.value || null)}
            className="input w-full"
          >
            <option value="">All Categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.icon} {category.name}
              </option>
            ))}
          </select>
        </div>

        {/* Area Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Area
          </label>
          <select
            value={filters.areaId || ''}
            onChange={(e) => handleFilterChange('areaId', e.target.value || null)}
            className="input w-full"
          >
            <option value="">All Areas</option>
            {Object.entries(areasByZone).map(([zone, zoneAreas]) => (
              <optgroup key={zone} label={zone}>
                {zoneAreas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            value={filters.status || 'unclaimed'}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="input w-full"
          >
            <option value="unclaimed">Available</option>
            <option value="pending">Pending Claim</option>
            <option value="">All Status</option>
          </select>
        </div>
      </div>

      {/* Active Filters */}
      {hasActiveFilters && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-500">Active filters:</span>
          {filters.search && (
            <FilterTag
              label={`Search: "${filters.search}"`}
              onRemove={() => {
                setSearchInput('');
                onSearch('');
              }}
            />
          )}
          {filters.categoryId && (
            <FilterTag
              label={categories.find(c => c.id === filters.categoryId)?.name}
              onRemove={() => handleFilterChange('categoryId', null)}
            />
          )}
          {filters.areaId && (
            <FilterTag
              label={areas.find(a => a.id === filters.areaId)?.name}
              onRemove={() => handleFilterChange('areaId', null)}
            />
          )}
          <button
            onClick={clearFilters}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
};

// Filter tag component
const FilterTag = ({ label, onRemove }) => (
  <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary-50 text-primary-700 rounded-full text-sm">
    {label}
    <button onClick={onRemove} className="hover:text-primary-900">
      <X className="w-3 h-3" />
    </button>
  </span>
);

export default ItemFilters;
