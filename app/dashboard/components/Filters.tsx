"use client";

import type React from "react";
import { Icon } from "@/components/Icons";
import { DICT } from "@/i18n";
import { type LookupItem } from "@/lib/api";
import { type FiltersState } from "../_lib";

export function Filters({
  filters,
  setFilters,
  clearFilters,
  toggleGroup,
  isCollapsed,
  setCounter,
  toggleAmenity,
  toggleFlag,
  propertyTypes,
  amenities,
  open,
  t,
}: {
  filters: FiltersState;
  setFilters: React.Dispatch<React.SetStateAction<FiltersState>>;
  clearFilters: () => void;
  toggleGroup: (n: string) => void;
  isCollapsed: (n: string) => boolean;
  setCounter: (k: "bedrooms" | "bathrooms" | "beds" | "capacity", dir: number) => void;
  toggleAmenity: (id: number) => void;
  toggleFlag: (v: string) => void;
  propertyTypes: LookupItem[];
  amenities: LookupItem[];
  /** Mobile-only — controls the drawer slide. Ignored on desktop layout. */
  open: boolean;
  t: typeof DICT["en"];
}) {
  const counterLabel = {
    bedrooms: t.filters.bedrooms, bathrooms: t.filters.bathrooms, beds: t.filters.beds, capacity: t.filters.capacity,
  };
  const cnt = (k: "bedrooms" | "bathrooms" | "beds" | "capacity") => {
    const v = filters[k];
    return v === 0 ? t.common.any : v + (v >= 10 ? "+" : "");
  };

  return (
    <aside className={`filters ${open ? "open" : ""}`}>
      <div className="filters-head">
        <div className="filters-title"><Icon.Filter /> {t.filters.title}</div>
        <button className="filters-clear" onClick={clearFilters}>{t.filters.clearAll}</button>
      </div>

      <div className={`filter-group ${isCollapsed("price") ? "collapsed" : ""}`}>
        <div className="filter-group-head" onClick={() => toggleGroup("price")}>
          <span>{t.filters.price}</span><Icon.ChevronDown />
        </div>
        <div className="filter-group-body">
          <div className="price-range">
            <input
              type="number"
              className="price-input"
              placeholder={t.filters.min}
              value={filters.priceMin}
              onChange={(e) => setFilters((f) => ({ ...f, priceMin: parseInt(e.target.value) || 0 }))}
            />
            <span className="price-dash">—</span>
            <input
              type="number"
              className="price-input"
              placeholder={t.filters.max}
              value={filters.priceMax}
              onChange={(e) => setFilters((f) => ({ ...f, priceMax: parseInt(e.target.value) || 200000 }))}
            />
          </div>
        </div>
      </div>

      <div className={`filter-group ${isCollapsed("type") ? "collapsed" : ""}`}>
        <div className="filter-group-head" onClick={() => toggleGroup("type")}>
          <span>{t.filters.type}</span><Icon.ChevronDown />
        </div>
        <div className="filter-group-body">
          <div className="type-grid">
            <button
              className={`type-pill ${filters.type === null ? "active" : ""}`}
              onClick={() => setFilters((f) => ({ ...f, type: null }))}
            >
              {t.filters.types.all}
            </button>
            {propertyTypes.map((opt) => (
              <button
                key={opt.id}
                className={`type-pill ${filters.type === opt.id ? "active" : ""}`}
                onClick={() => setFilters((f) => ({ ...f, type: opt.id }))}
              >
                {opt.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={`filter-group ${isCollapsed("rooms") ? "collapsed" : ""}`}>
        <div className="filter-group-head" onClick={() => toggleGroup("rooms")}>
          <span>{t.filters.rooms}</span><Icon.ChevronDown />
        </div>
        <div className="filter-group-body">
          {(["bedrooms", "bathrooms", "beds", "capacity"] as const).map((k) => (
            <div className="counter-row" key={k}>
              <span>{counterLabel[k]}</span>
              <div className="counter-controls">
                <button className="counter-btn" onClick={() => setCounter(k, -1)}>−</button>
                <span className="counter-val">{cnt(k)}</span>
                <button className="counter-btn" onClick={() => setCounter(k, 1)}>+</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={`filter-group ${isCollapsed("area") ? "collapsed" : ""}`}>
        <div className="filter-group-head" onClick={() => toggleGroup("area")}>
          <span>{t.filters.area}</span><Icon.ChevronDown />
        </div>
        <div className="filter-group-body">
          <div className="area-display"><b>{filters.areaMin}</b> m² — <b>{filters.areaMax}</b> m²</div>
          <input
            type="range"
            min={30}
            max={500}
            step={10}
            value={filters.areaMax}
            onChange={(e) => setFilters((f) => ({ ...f, areaMax: parseInt(e.target.value) }))}
          />
        </div>
      </div>

      <div className={`filter-group ${isCollapsed("amenities") ? "collapsed" : ""}`}>
        <div className="filter-group-head" onClick={() => toggleGroup("amenities")}>
          <span>{t.filters.essentials}</span><Icon.ChevronDown />
        </div>
        <div className="filter-group-body">
          {amenities.map((a) => (
            <label className="check-row" key={a.id}>
              <input
                type="checkbox"
                checked={filters.amenities.has(a.id)}
                onChange={() => toggleAmenity(a.id)}
              />
              <span className="check-box"><Icon.Check /></span>
              {a.name}
            </label>
          ))}
        </div>
      </div>

      <div className={`filter-group ${isCollapsed("booking") ? "collapsed" : ""}`}>
        <div className="filter-group-head" onClick={() => toggleGroup("booking")}>
          <span>{t.filters.bookingOpts}</span><Icon.ChevronDown />
        </div>
        <div className="filter-group-body">
          {(["instantBook"] as const).map((f) => (
            <label className="check-row" key={f}>
              <input
                type="checkbox"
                checked={filters.flags.has(f)}
                onChange={() => toggleFlag(f)}
              />
              <span className="check-box"><Icon.Check /></span>
              {t.filters.flags[f]}
            </label>
          ))}
        </div>
      </div>
    </aside>
  );
}
