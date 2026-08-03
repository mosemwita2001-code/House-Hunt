import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../services/api';

export default function Favorites() {
  const [favorites, setFavorites] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, hasMore: false });

  useEffect(() => {
    setLoading(true);
    API.get('/favorites', { params: { page, limit: 24 } })
      .then(({ data }) => { setFavorites(data?.data || data || []); setPagination(data?.pagination || { page, hasMore: (data?.data || data || []).length === 24 }); })
      .catch(err => setError(err.response?.data?.message || 'Unable to load favorites.'))
      .finally(() => setLoading(false));
  }, [page]);

  if (loading) return <main className="mx-auto max-w-6xl px-4 py-10">Loading favorites…</main>;
  if (error) return <main className="mx-auto max-w-6xl px-4 py-10" role="alert">{error}</main>;

  return <main className="mx-auto max-w-6xl px-4 py-10">
    <h1 className="mb-6 text-2xl font-bold text-slate-900">Saved properties</h1>
    {!favorites.length ? <p className="text-slate-600">You have no saved properties yet.</p> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {favorites.map(property => <Link key={property.id} to={`/property/${property.id}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-400">
        <h2 className="font-semibold text-slate-900">{property.title}</h2>
        <p className="mt-1 text-sm text-slate-600">{property.town}, {property.county}</p>
        <p className="mt-3 font-medium text-slate-900">KES {Number(property.price).toLocaleString()}</p>
      </Link>)}
    </div>}
    {!loading && (page > 1 || pagination.hasMore) && <nav aria-label="Saved property pages" className="mt-8 flex items-center justify-center gap-4">
      <button type="button" disabled={page === 1} onClick={() => setPage(current => Math.max(1, current - 1))} className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50">Previous</button>
      <span className="text-sm text-slate-600">Page {page}</span>
      <button type="button" disabled={!pagination.hasMore} onClick={() => setPage(current => current + 1)} className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50">Next</button>
    </nav>}
  </main>;
}
