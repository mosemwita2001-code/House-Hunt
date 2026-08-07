import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ImageOff } from 'lucide-react';
import { optimizeImageUrl } from '../utils/imageUrl';

const apiRoot = () => import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, '') || 'http://localhost:5000';
const defaultPlaceholder = <ImageOff aria-hidden="true" />;

const imageUrl = image => {
  const value = typeof image === 'string' ? image : image?.image_url;
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return optimizeImageUrl(value, { width: 1600 });
  return optimizeImageUrl(`${apiRoot()}${value.startsWith('/') ? value : `/uploads/${value}`}`, { width: 1600 });
};

export default function ImageCarousel({ images = [], alt = 'Photo', className = '', placeholder = defaultPlaceholder, objectFit = 'contain' }) {
  const sources = images.map(imageUrl).filter(Boolean);
  const sourcesKey = sources.join('|');
  const objectFitClass = objectFit === 'cover' ? 'object-cover' : 'object-contain';
  const [current, setCurrent] = useState(0);
  const [failed, setFailed] = useState({});
  const touchStartX = useRef(null);

  useEffect(() => {
    setCurrent(0);
    setFailed({});
  }, [sourcesKey]);

  if (!sources.length) return <div className={`flex h-48 items-center justify-center rounded-xl bg-slate-100 text-slate-400 ${className}`}>{placeholder}</div>;

  const previous = () => setCurrent(index => (index === 0 ? sources.length - 1 : index - 1));
  const next = () => setCurrent(index => (index + 1) % sources.length);
  const handleKeyDown = event => {
    if (event.key === 'ArrowLeft') previous();
    if (event.key === 'ArrowRight') next();
  };
  const handleTouchStart = event => { touchStartX.current = event.changedTouches[0].clientX; };
  const handleTouchEnd = event => {
    if (touchStartX.current === null) return;
    const distance = event.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(distance) >= 50) (distance > 0 ? previous : next)();
  };
  const source = sources[current];

  return (
    <div className={`relative overflow-hidden rounded-xl bg-slate-100 ${className}`} tabIndex={sources.length > 1 ? 0 : undefined} onKeyDown={handleKeyDown} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {failed[source] ? <div className="flex h-full min-h-48 items-center justify-center text-slate-400">{placeholder}</div> : <img src={source} alt={`${alt} photo ${current + 1}`} loading={current === 0 ? 'eager' : 'lazy'} decoding="async" className={`h-full min-h-48 w-full ${objectFitClass}`} onError={() => setFailed(previousErrors => ({ ...previousErrors, [source]: true }))} />}
      {sources.length > 1 && <>
        <button type="button" aria-label="Previous photo" onClick={previous} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-slate-800 shadow-md transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-brand"><ChevronLeft className="h-5 w-5" aria-hidden="true" /></button>
        <button type="button" aria-label="Next photo" onClick={next} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-slate-800 shadow-md transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-brand"><ChevronRight className="h-5 w-5" aria-hidden="true" /></button>
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/70 px-3 py-1 text-xs font-medium text-white" aria-live="polite">{current + 1} / {sources.length}</div>
      </>}
    </div>
  );
}
