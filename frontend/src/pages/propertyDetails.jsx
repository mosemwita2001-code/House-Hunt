import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import API from '../services/api';
import { Phone, MapPin, MessageCircle, ImageOff, Send, Lock, ChevronLeft, ChevronRight } from 'lucide-react';
import { viewAccessHeaders, viewAccessStorageKey } from '../utils/viewAccess';

const cleanPhone = (phone = '') => phone.replace(/\D/g, '').replace(/^0/, '254');
const sessionUser = () => { try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; } };
const parseAmenities = value => {
  if (Array.isArray(value)) return [...new Set(value.filter(item => typeof item === 'string').map(item => item.trim()).filter(Boolean))];
  if (typeof value !== 'string' || !value.trim()) return [];
  try { return parseAmenities(JSON.parse(value)); } catch { return parseAmenities(value.split(',')); }
};

export default function PropertyDetails() {
  const { id } = useParams();
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [imgErrors, setImgErrors] = useState({});
  const [currentImage, setCurrentImage] = useState(0);
  const [imageAspectRatio, setImageAspectRatio] = useState(4 / 3);
  const [galleryAvailableWidth, setGalleryAvailableWidth] = useState(0);
  const [galleryViewportHeight, setGalleryViewportHeight] = useState(0);
  const galleryWrapperRef = useRef(null);
  const touchStartX = useRef(null);
  const [phone, setPhone] = useState('');
  const [billing, setBilling] = useState({ firstName: '', lastName: '', email: '' });
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [inquiry, setInquiry] = useState({ name: '', email: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [inquiryError, setInquiryError] = useState('');

  const viewAccessKey = viewAccessStorageKey(sessionUser()?.id, id);
  const load = useCallback(() => {
    const accessToken = sessionStorage.getItem(viewAccessKey) || '';
    return API.get(`/properties/${id}`, { headers: viewAccessHeaders(accessToken) }).then(res => {
      setProperty(res.data);
    });
  }, [id, viewAccessKey]);
  useEffect(() => {
    setPhone('');
    setLoading(true);
    setLoadError('');
    load().catch(err => setLoadError(err.response?.data?.message || 'Unable to load this property. Please try again.')).finally(() => setLoading(false));
  }, [id, load]);

  const images = property?.image_path ? property.image_path.split(',').map(n => n.trim()).filter(Boolean) : [];

  useEffect(() => {
    setCurrentImage(0);
    setImageAspectRatio(4 / 3);
  }, [id, property?.image_path]);

  useEffect(() => {
    const element = galleryWrapperRef.current;
    if (!element) return undefined;
    const updateGalleryBounds = () => {
      const contentWidth = element.getBoundingClientRect().width;
      const mobileViewport = window.innerWidth < 640;
      setGalleryAvailableWidth(mobileViewport ? contentWidth + 32 : contentWidth);
      setGalleryViewportHeight(window.innerHeight);
    };
    updateGalleryBounds();
    window.addEventListener('resize', updateGalleryBounds);
    return () => window.removeEventListener('resize', updateGalleryBounds);
  }, [property?.image_path]);

  useEffect(() => {
    if (images.length < 2) return undefined;
    const handleKeyDown = event => {
      if (event.key === 'ArrowLeft') setCurrentImage(index => (index === 0 ? images.length - 1 : index - 1));
      if (event.key === 'ArrowRight') setCurrentImage(index => (index + 1) % images.length);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [images.length]);

  const payToView = async () => {
    setPaymentError('');
    if (!phone.trim() || !billing.firstName.trim() || !billing.lastName.trim() || !billing.email.trim()) {
      setPaymentError('Please enter your name, email, and M-Pesa number first.');
      return;
    }
    setPaymentLoading(true);
    try {
      const { data } = await API.post('/payments/view', { property_id: id, phone: phone.trim(), first_name: billing.firstName.trim(), last_name: billing.lastName.trim(), email: billing.email.trim(), country_code: 'KE' });
      if (!data.view_access_token) throw new Error('Payment access token was not returned.');
      sessionStorage.setItem(viewAccessKey, data.view_access_token);
      if (data.redirect_url) window.location.href = data.redirect_url;
      else alert('Payment order created. Complete it through the payment provider.');
    } catch (err) { setPaymentError(err.response?.data?.message || 'Could not start payment.'); }
    finally { setPaymentLoading(false); }
  };

  const handleInquirySubmit = async e => {
    e.preventDefault();
    setInquiryError('');
    if (!inquiry.name.trim() || !inquiry.email.trim() || !inquiry.message.trim() || !phone.trim()) {
      setInquiryError('Please fill in all required fields, including your M-Pesa number, first.');
      return;
    }
    setSubmitting(true);
    try {
      const accessToken = sessionStorage.getItem(viewAccessKey) || '';
      await API.post('/inquiries', { property_id: id, user_name: inquiry.name, user_email: inquiry.email, message: inquiry.message }, { headers: viewAccessHeaders(accessToken) });
      alert('Inquiry sent successfully!');
      setInquiry({ name: '', email: '', message: '' });
    } catch (err) { setInquiryError(err.response?.data?.message || 'A successful KSh 40 view payment is required first.'); }
    finally { setSubmitting(false); }
  };

  if (loading) return <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6">Loading...</div>;
  if (!property) return <div className="text-center py-12" role="alert">{loadError || 'Property asset could not be located.'}<button type="button" className="block mx-auto mt-4 rounded bg-slate-900 px-4 py-2 text-white" onClick={() => { setLoading(true); setLoadError(''); load().catch(err => setLoadError(err.response?.data?.message || 'Unable to load this property. Please try again.')).finally(() => setLoading(false)); }}>Try again</button></div>;
  const full = Boolean(property.full_access && property.description !== undefined);
  const landlordPhone = property.phone_number || '';
  const whatsappPhone = cleanPhone(landlordPhone);
  const amenities = parseAmenities(property.amenities);

  const goToPreviousImage = () => setCurrentImage(index => (index === 0 ? images.length - 1 : index - 1));
  const goToNextImage = () => setCurrentImage(index => (index + 1) % images.length);
  const handleTouchStart = event => {
    touchStartX.current = event.changedTouches[0].clientX;
  };
  const handleTouchEnd = event => {
    if (touchStartX.current === null || images.length < 2) return;
    const distance = event.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(distance) < 50) return;
    if (distance > 0) goToPreviousImage();
    else goToNextImage();
  };
  const currentImageName = images[currentImage] || images[0];
  const currentImageSrc = currentImageName?.startsWith('http') ? currentImageName : `${import.meta.env.VITE_API_URL?.replace('/api','') || 'http://localhost:5000'}/uploads/${currentImageName}`;
  const maxGalleryHeight = (galleryViewportHeight || window.innerHeight) * 0.85;
  const galleryWidth = galleryAvailableWidth ? Math.min(galleryAvailableWidth, maxGalleryHeight * imageAspectRatio) : undefined;
  const galleryHeight = galleryWidth ? galleryWidth / imageAspectRatio : undefined;
  const galleryStyle = galleryWidth ? { width: `${galleryWidth}px`, height: `${galleryHeight}px` } : undefined;
  const handleImageLoad = event => {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (naturalWidth && naturalHeight) setImageAspectRatio(naturalWidth / naturalHeight);
  };

  return <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6">
    <h1 className="text-2xl font-bold text-slate-900 mb-2 sm:text-3xl">{property.title}</h1>
    <div className="flex items-center gap-2 text-slate-500 mb-6"><MapPin className="h-4 w-4" /><span>{property.town}, {property.county}</span></div>
    <div ref={galleryWrapperRef}>
      {images.length ? <>
        <div
          className="relative left-1/2 aspect-[4/3] w-full -translate-x-1/2 touch-pan-y overflow-hidden rounded-xl bg-slate-100 transition-[width,height] duration-300 ease-out"
          style={galleryStyle}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {imgErrors[currentImageName] ? <div className="flex h-full items-center justify-center text-slate-400"><ImageOff /></div> : <img src={currentImageSrc} alt={`${property.title} photo ${currentImage + 1}`} loading="eager" decoding="async" className="h-full w-full object-contain transition-opacity duration-200" onLoad={handleImageLoad} onError={() => setImgErrors(p => ({ ...p, [currentImageName]: true }))} />}
          {images.length > 1 && <>
            <button type="button" aria-label="Previous photo" onClick={goToPreviousImage} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-slate-800 shadow-md transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-brand">
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button type="button" aria-label="Next photo" onClick={goToNextImage} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-slate-800 shadow-md transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-brand">
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </>}
        </div>
        <div className="mt-3 flex items-center justify-center text-sm font-medium text-slate-600" aria-live="polite">{currentImage + 1} / {images.length}</div>
      </> : <div className="flex h-64 items-center justify-center rounded-xl bg-slate-100 text-slate-400">No photos available</div>}
    </div>
    {!full && <div className="mt-8 bg-amber-50 border border-amber-200 rounded-2xl p-5 max-w-2xl"><div className="flex items-center gap-2 font-semibold"><Lock size={17} /> Full location, description and contact details are locked</div><p className="text-sm text-slate-600 mt-2">Pay KSh 40 through PesaPal to view the full listing.</p><div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4"><div><label htmlFor="billing-first-name" className="sr-only">First name</label><input id="billing-first-name" autoComplete="given-name" className="p-3 rounded-xl border w-full" placeholder="First name" value={billing.firstName} onChange={e => setBilling({ ...billing, firstName: e.target.value })} /></div><div><label htmlFor="billing-last-name" className="sr-only">Last name</label><input id="billing-last-name" autoComplete="family-name" className="p-3 rounded-xl border w-full" placeholder="Last name" value={billing.lastName} onChange={e => setBilling({ ...billing, lastName: e.target.value })} /></div><div><label htmlFor="billing-email" className="sr-only">Email address</label><input id="billing-email" autoComplete="email" className="p-3 rounded-xl border w-full" type="email" placeholder="Email address" value={billing.email} onChange={e => setBilling({ ...billing, email: e.target.value })} /></div><div><label htmlFor="billing-phone" className="sr-only">M-Pesa phone number</label><input id="billing-phone" autoComplete="tel" className="p-3 rounded-xl border w-full" placeholder="M-Pesa phone e.g. 0712345678" value={phone} onChange={e => setPhone(e.target.value)} /></div></div>{paymentError && <p className="mt-3 text-sm text-red-600" role="alert">{paymentError}</p>}<button type="button" onClick={payToView} disabled={paymentLoading} className="bg-slate-900 text-white px-4 py-3 rounded-xl mt-2">{paymentLoading ? 'Starting...' : 'Pay KSh 40'}</button></div>}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
      <div className="md:col-span-2"><h2 className="text-xl font-bold border-b pb-4 mb-4">Property Specifications</h2><p className="text-slate-600 leading-relaxed mb-6">{full ? property.description : 'Pay to unlock the full property description.'}</p>{amenities.length > 0 && <div className="mb-6"><h3 className="mb-3 text-sm font-semibold text-slate-900">Amenities</h3><div className="flex flex-wrap gap-2">{amenities.map(amenity => <span key={amenity} className="rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-sm text-brand-dark">{amenity}</span>)}</div></div>}<div className="grid grid-cols-2 gap-4 text-slate-700 bg-slate-100 p-4 rounded-xl"><div><strong>House Type:</strong> {property.house_type}</div><div><strong>Rent:</strong> KES {Number(property.price).toLocaleString()} / {property.payment_cycle}</div><div><strong>Status:</strong> {property.status}</div></div></div>
      <div className="space-y-6"><div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm"><div className="text-2xl font-bold mb-4">KES {Number(property.price).toLocaleString()}</div>{full ? <><div className="border-t pt-4 space-y-3"><div className="font-semibold text-slate-800">{landlordPhone || 'Contact unavailable'}</div><a href={`tel:${landlordPhone}`} className="w-full bg-slate-900 text-white py-3 rounded-xl flex items-center justify-center gap-2"><Phone size={16} /> Call Landlord</a><a href={`https://wa.me/${whatsappPhone}?text=Hi, I'm interested in ${property.title}`} target="_blank" rel="noopener noreferrer" className="w-full bg-emerald-500 text-white py-3 rounded-xl flex items-center justify-center gap-2"><MessageCircle size={16} /> WhatsApp</a></div></> : <p className="text-sm text-slate-500">Contact details unlock after payment.</p>}</div>
      {full && <form onSubmit={handleInquirySubmit} noValidate className="bg-slate-50 border border-slate-200 rounded-3xl p-6 space-y-4"><h3 className="font-bold text-lg">Send an Inquiry</h3><div><label htmlFor="inquiry-name" className="sr-only">Your name</label><input id="inquiry-name" autoComplete="name" type="text" placeholder="Your Name" className="w-full p-3 rounded-xl border" value={inquiry.name} onChange={e => setInquiry({ ...inquiry, name: e.target.value })} /></div><div><label htmlFor="inquiry-email" className="sr-only">Your email</label><input id="inquiry-email" autoComplete="email" type="email" placeholder="Your Email" className="w-full p-3 rounded-xl border" value={inquiry.email} onChange={e => setInquiry({ ...inquiry, email: e.target.value })} /></div><div><label htmlFor="inquiry-phone" className="sr-only">M-Pesa phone number</label><input id="inquiry-phone" autoComplete="tel" type="tel" placeholder="M-Pesa number e.g. 0712345678" className="w-full p-3 rounded-xl border" value={phone} onChange={e => setPhone(e.target.value)} /></div><div><label htmlFor="inquiry-message" className="sr-only">Message</label><textarea id="inquiry-message" placeholder="Message" className="w-full p-3 rounded-xl border h-24" value={inquiry.message} onChange={e => setInquiry({ ...inquiry, message: e.target.value })} /></div>{inquiryError && <p className="text-sm text-red-600" role="alert">{inquiryError}</p>}<button disabled={submitting} type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2">{submitting ? 'Sending...' : <><Send size={16} /> Send Inquiry</>}</button></form>}
      </div>
    </div>
  </div>;
}
