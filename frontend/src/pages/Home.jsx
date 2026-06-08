import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import API from '../api.js';

const HOUSE_TYPES = [
  "Bedsitter","Single Room","One Bedroom","Two Bedroom","Three Bedroom",
  "Four Bedroom","Penthouse","Studio","Maisonette","Bungalow",
  "Mansion","Townhouse","Apartment","Commercial"
];

const COUNTIES = [
  "Nairobi","Mombasa","Kisumu","Nakuru","Kiambu","Machakos","Kajiado",
  "Uasin Gishu","Meru","Kilifi","Kwale","Kakamega","Kericho","Migori",
  "Nyeri","Murang'a","Kirinyaga","Nyandarua","Laikipia","Samburu",
  "Trans Nzoia","West Pokot","Siaya","Kisii","Nyamira","Homa Bay",
  "Bomet","Vihiga","Bungoma","Busia","Tharaka Nithi","Embu","Kitui",
  "Makueni","Nandi","Baringo","Elgeyo Marakwet","Narok","Turkana",
  "Marsabit","Isiolo","Garissa","Wajir","Mandera","Taita Taveta",
  "Tana River","Lamu","Nyamira","Mombasa"
];

const getFirstImage = (image_path) => {
  if (!image_path) return null;
  const first = image_path.split(',')[0].trim();
  if (!first) return null;
  return first.startsWith('http')
    ? first
    : `${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000'}/uploads/${first}`;
};

const formatPrice = (price) => {
  const n = Number(price);
  if (n >= 1000000) return `KES ${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `KES ${(n / 1000).toFixed(0)}K`;
  return `KES ${n.toLocaleString()}`;
};

export default function Home() {
  const [properties, setProperties]   = useState([]);
  const [filtered, setFiltered]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [search, setSearch]           = useState('');
  const [houseType, setHouseType]     = useState('');
  const [county, setCounty]           = useState('');
  const [minPrice, setMinPrice]       = useState('');
  const [maxPrice, setMaxPrice]       = useState('');
  const [sortBy, setSortBy]           = useState('newest');
  const [showFilters, setShowFilters] = useState(false);
  const [hoveredId, setHoveredId]     = useState(null);
  const heroRef = useRef(null);

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        setLoading(true);
        const response = await API.get('/properties');
        const data = Array.isArray(response.data) ? response.data : [];
        setProperties(data);
        setFiltered(data);
        setError(null);
      } catch (err) {
        console.error("Fetch error:", err);
        setError("Could not connect to the server.");
      } finally {
        setLoading(false);
      }
    };
    fetchProperties();
  }, []);

  useEffect(() => {
    let result = [...properties];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.title?.toLowerCase().includes(q) ||
        p.town?.toLowerCase().includes(q) ||
        p.county?.toLowerCase().includes(q) ||
        p.house_type?.toLowerCase().includes(q)
      );
    }
    if (houseType) result = result.filter(p => p.house_type === houseType);
    if (county)    result = result.filter(p => p.county === county);
    if (minPrice)  result = result.filter(p => Number(p.price) >= Number(minPrice));
    if (maxPrice)  result = result.filter(p => Number(p.price) <= Number(maxPrice));
    if (sortBy === 'lowest')  result.sort((a, b) => Number(a.price) - Number(b.price));
    if (sortBy === 'highest') result.sort((a, b) => Number(b.price) - Number(a.price));
    if (sortBy === 'newest')  result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    setFiltered(result);
  }, [search, houseType, county, minPrice, maxPrice, sortBy, properties]);

  const clearFilters = () => {
    setSearch(''); setHouseType(''); setCounty('');
    setMinPrice(''); setMaxPrice(''); setSortBy('newest');
  };

  const hasFilters = search || houseType || county || minPrice || maxPrice || sortBy !== 'newest';

  return (
    <div style={{ minHeight: '100vh', background: '#f8f7f4', fontFamily: "'DM Sans', sans-serif" }}>

      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
        .card-hover { transition: transform 0.3s ease, box-shadow 0.3s ease; }
        .card-hover:hover { transform: translateY(-6px); box-shadow: 0 20px 60px rgba(0,0,0,0.12) !important; }
        .fade-up { animation: fadeUp 0.6s ease both; }
        .fade-up-2 { animation: fadeUp 0.6s ease 0.1s both; }
        .fade-up-3 { animation: fadeUp 0.6s ease 0.2s both; }
        .shimmer { background: linear-gradient(90deg, #e8e8e8 25%, #f5f5f5 50%, #e8e8e8 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; }
        input:focus, select:focus { outline: none; }
        ::placeholder { color: #9ca3af; }
        .tag { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; letter-spacing: 0.03em; }
      `}</style>

      {/* ── HERO ── */}
      <div ref={heroRef} style={{
        position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        minHeight: 520, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '80px 24px 60px',
      }}>
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: -100, right: -100, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(234,179,8,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -80, left: -80, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 40, left: '30%', width: 2, height: 120, background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.08), transparent)', pointerEvents: 'none' }} />

        <div style={{ textAlign: 'center', maxWidth: 760, position: 'relative', zIndex: 1 }}>
          {/* Badge */}
          <div className="fade-up" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.25)', borderRadius: 30, padding: '6px 16px', marginBottom: 24 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#eab308', display: 'inline-block' }} />
            <span style={{ color: '#eab308', fontSize: 12, fontWeight: 600, letterSpacing: '0.08em' }}>KENYA'S TRUSTED RENTAL PLATFORM</span>
          </div>

          <h1 className="fade-up-2" style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 800, color: '#ffffff', lineHeight: 1.1, marginBottom: 16 }}>
            Find Your Perfect<br />
            <span style={{ color: '#eab308' }}>Home in Kenya</span>
          </h1>

          <p className="fade-up-3" style={{ color: 'rgba(255,255,255,0.55)', fontSize: 17, lineHeight: 1.7, marginBottom: 40, maxWidth: 500, margin: '0 auto 40px' }}>
            Browse verified rental properties across Kenya. From cozy bedsitters to luxury mansions.
          </p>

          {/* ── SEARCH BAR ── */}
          <div className="fade-up-3" style={{
            background: 'rgba(255,255,255,0.97)', borderRadius: 20,
            padding: '8px 8px 8px 20px', display: 'flex', alignItems: 'center',
            gap: 8, boxShadow: '0 24px 80px rgba(0,0,0,0.3)', maxWidth: 680, margin: '0 auto',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by location, title or house type..."
              style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 15, color: '#1f2937', fontFamily: 'inherit' }}
            />
            <button
              onClick={() => setShowFilters(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: showFilters ? '#1a1a2e' : '#f3f4f6',
                color: showFilters ? 'white' : '#374151',
                border: 'none', borderRadius: 12, padding: '10px 16px',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.2s',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
              </svg>
              Filters {hasFilters && <span style={{ background: '#eab308', color: '#1a1a2e', borderRadius: '50%', width: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>!</span>}
            </button>
            <button
              style={{
                background: 'linear-gradient(135deg, #1a1a2e, #0f3460)',
                color: 'white', border: 'none', borderRadius: 14,
                padding: '10px 22px', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
              }}
            >
              Search
            </button>
          </div>

          {/* Stats */}
          <div className="fade-up-3" style={{ display: 'flex', justifyContent: 'center', gap: 32, marginTop: 36 }}>
            {[
              { label: 'Listed Properties', value: properties.length },
              { label: 'Counties Covered', value: [...new Set(properties.map(p => p.county))].length },
              { label: 'House Types', value: [...new Set(properties.map(p => p.house_type))].length },
            ].map(stat => (
              <div key={stat.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#eab308', fontFamily: "'Playfair Display', serif" }}>{stat.value || '—'}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em', marginTop: 2 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── FILTERS PANEL ── */}
      {showFilters && (
        <div style={{
          background: 'white', borderBottom: '1px solid #e5e7eb',
          padding: '20px 24px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
        }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'end' }}>
            {/* House Type */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 6, letterSpacing: '0.06em' }}>HOUSE TYPE</label>
              <select value={houseType} onChange={e => setHouseType(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 13, color: '#1f2937', background: 'white', fontFamily: 'inherit', cursor: 'pointer' }}>
                <option value="">All Types</option>
                {HOUSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* County */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 6, letterSpacing: '0.06em' }}>COUNTY</label>
              <select value={county} onChange={e => setCounty(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 13, color: '#1f2937', background: 'white', fontFamily: 'inherit', cursor: 'pointer' }}>
                <option value="">All Counties</option>
                {COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Min Price */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 6, letterSpacing: '0.06em' }}>MIN PRICE (KES)</label>
              <input type="number" placeholder="e.g. 5000" value={minPrice} onChange={e => setMinPrice(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 13, color: '#1f2937', fontFamily: 'inherit' }} />
            </div>

            {/* Max Price */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 6, letterSpacing: '0.06em' }}>MAX PRICE (KES)</label>
              <input type="number" placeholder="e.g. 50000" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 13, color: '#1f2937', fontFamily: 'inherit' }} />
            </div>

            {/* Sort */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 6, letterSpacing: '0.06em' }}>SORT BY</label>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 13, color: '#1f2937', background: 'white', fontFamily: 'inherit', cursor: 'pointer' }}>
                <option value="newest">Newest First</option>
                <option value="lowest">Price: Low to High</option>
                <option value="highest">Price: High to Low</option>
              </select>
            </div>

            {/* Clear */}
            {hasFilters && (
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'transparent', marginBottom: 6 }}>_</label>
                <button onClick={clearFilters} style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #fca5a5', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#ef4444', background: '#fef2f2', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── QUICK FILTER CHIPS ── */}
      <div style={{ background: 'white', borderBottom: '1px solid #f3f4f6', padding: '14px 24px', overflowX: 'auto' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#9ca3af', whiteSpace: 'nowrap', marginRight: 4 }}>Quick:</span>
          {HOUSE_TYPES.slice(0, 8).map(type => (
            <button
              key={type}
              onClick={() => setHouseType(houseType === type ? '' : type)}
              style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                border: `1.5px solid ${houseType === type ? '#1a1a2e' : '#e5e7eb'}`,
                background: houseType === type ? '#1a1a2e' : 'white',
                color: houseType === type ? 'white' : '#6b7280',
                cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* ── RESULTS ── */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px' }}>

        {/* Results header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 700, color: '#1f2937' }}>
              {hasFilters ? 'Search Results' : 'Featured Properties'}
            </h2>
            <p style={{ color: '#9ca3af', fontSize: 13, marginTop: 4 }}>
              {loading ? 'Loading...' : `${filtered.length} ${filtered.length === 1 ? 'property' : 'properties'} found`}
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 14, padding: '16px 20px', color: '#dc2626', fontSize: 14, marginBottom: 24 }}>
            ⚠️ {error}
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 24 }}>
            {[1,2,3,4,5,6].map(i => (
              <div key={i} style={{ borderRadius: 20, overflow: 'hidden', background: 'white' }}>
                <div className="shimmer" style={{ height: 220 }} />
                <div style={{ padding: 20 }}>
                  <div className="shimmer" style={{ height: 18, borderRadius: 6, marginBottom: 10, width: '70%' }} />
                  <div className="shimmer" style={{ height: 14, borderRadius: 6, marginBottom: 8, width: '50%' }} />
                  <div className="shimmer" style={{ height: 20, borderRadius: 6, width: '40%' }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No results */}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🏠</div>
            <h3 style={{ fontSize: 20, fontWeight: 600, color: '#374151', marginBottom: 8 }}>No properties found</h3>
            <p style={{ color: '#9ca3af', marginBottom: 24 }}>Try adjusting your search or filters</p>
            <button onClick={clearFilters} style={{ background: '#1a1a2e', color: 'white', border: 'none', borderRadius: 12, padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              Clear all filters
            </button>
          </div>
        )}

        {/* Property Grid */}
        {!loading && filtered.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 24 }}>
            {filtered.map((house, i) => {
              const imageUrl = getFirstImage(house.image_path);
              const isHovered = hoveredId === house.id;
              return (
                <Link
                  to={`/property/${house.id}`}
                  key={house.id}
                  style={{ textDecoration: 'none' }}
                  onMouseEnter={() => setHoveredId(house.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  <div
                    className="card-hover"
                    style={{
                      background: 'white', borderRadius: 20,
                      overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
                      border: '1px solid #f3f4f6',
                      animation: `fadeUp 0.5s ease ${i * 0.05}s both`,
                    }}
                  >
                    {/* Image */}
                    <div style={{ position: 'relative', height: 220, background: '#f3f4f6', overflow: 'hidden' }}>
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={house.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s ease', transform: isHovered ? 'scale(1.07)' : 'scale(1)' }}
                          onError={e => { e.target.onerror = null; e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f3f4f6, #e5e7eb)', color: '#9ca3af', flexDirection: 'column', gap: 8 }}>
                          <span style={{ fontSize: 36 }}>🏠</span>
                          <span style={{ fontSize: 12 }}>No image</span>
                        </div>
                      )}
                      {/* Overlay */}
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 50%)', pointerEvents: 'none' }} />
                      {/* House type badge */}
                      <div style={{ position: 'absolute', top: 14, left: 14 }}>
                        <span style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', color: 'white', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                          {house.house_type}
                        </span>
                      </div>
                      {/* Payment cycle badge */}
                      <div style={{ position: 'absolute', top: 14, right: 14 }}>
                        <span style={{ background: house.payment_cycle === 'semester' ? 'rgba(234,179,8,0.9)' : 'rgba(16,185,129,0.9)', color: 'white', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                          {house.payment_cycle === 'semester' ? 'Per Semester' : 'Per Month'}
                        </span>
                      </div>
                    </div>

                    {/* Content */}
                    <div style={{ padding: '18px 20px 20px' }}>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1f2937', marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {house.title}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#6b7280', fontSize: 13, marginBottom: 14 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                        </svg>
                        {house.town}, {house.county}
                      </div>

                      {/* Details row */}
                      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                        {house.bedrooms && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#6b7280' }}>
                            🛏 {house.bedrooms} bed
                          </span>
                        )}
                        {house.bathrooms && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#6b7280' }}>
                            🚿 {house.bathrooms} bath
                          </span>
                        )}
                      </div>

                      {/* Price + CTA */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: 20, fontWeight: 800, color: '#1a1a2e', fontFamily: "'Playfair Display', serif" }}>
                            {formatPrice(house.price)}
                          </span>
                          <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 4 }}>
                            /{house.payment_cycle === 'semester' ? 'sem' : 'mo'}
                          </span>
                        </div>
                        <div style={{
                          background: isHovered ? '#1a1a2e' : '#f3f4f6',
                          color: isHovered ? 'white' : '#374151',
                          padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                          transition: 'all 0.2s',
                        }}>
                          View →
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      {/* ── FOOTER CTA ── */}
      {!loading && properties.length > 0 && (
        <div style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)', padding: '60px 24px', textAlign: 'center', marginTop: 40 }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, color: 'white', marginBottom: 12 }}>
            Are you a Landlord?
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 15, marginBottom: 28, maxWidth: 400, margin: '0 auto 28px' }}>
            List your property and reach thousands of tenants across Kenya
          </p>
          <Link to="/register" style={{
            display: 'inline-block', background: '#eab308', color: '#1a1a2e',
            padding: '14px 32px', borderRadius: 14, fontSize: 15, fontWeight: 700,
            textDecoration: 'none', fontFamily: 'inherit',
          }}>
            List Your Property →
          </Link>
        </div>
      )}
    </div>
  );
}#   u p d a t e d  
 