import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import API from '../services/api';
import { Building2, Phone, MapPin, MessageCircle, Send, Lock } from 'lucide-react';
import { viewAccessHeaders, viewAccessStorageKey } from '../utils/viewAccess';
import LoadingSpinner from '../components/LoadingSpinner';
import ImageCarousel from '../components/ImageCarousel';

const cleanPhone = (phone = '') => phone.replace(/\D/g, '').replace(/^0/, '254');
const sessionUser = () => { try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; } };
const parseAmenities = value => {
  if (Array.isArray(value)) return [...new Set(value.filter(item => typeof item === 'string').map(item => item.trim()).filter(Boolean))];
  if (typeof value !== 'string' || !value.trim()) return [];
  try { return parseAmenities(JSON.parse(value)); } catch { return parseAmenities(value.split(',')); }
};

function RoomAvailability({ roomTypes = [] }) {
  if (!roomTypes.length) return null;
  return (
    <section className="mt-8" aria-labelledby="available-room-types-heading">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div><h2 id="available-room-types-heading" className="text-xl font-bold text-slate-900">Available room types</h2><p className="mt-1 text-sm text-slate-500">Choose from the rooms currently available in this building.</p></div>
      </div>
      <div className="space-y-5">
        {roomTypes.map(roomType => (
          <article key={roomType.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <h3 className="text-lg font-bold text-slate-900">{roomType.house_type}</h3>
              <p className="text-lg font-bold text-brand-dark">KES {Number(roomType.price).toLocaleString()}<span className="ml-1 text-xs font-normal text-slate-500">/mo</span></p>
            </div>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-center">
              <ImageCarousel
                images={roomType.sample_photo ? [roomType.sample_photo] : []}
                alt={roomType.house_type}
                className="aspect-[4/3] w-full rounded-xl"
                objectFit="cover"
                placeholder={<><Building2 aria-hidden="true" size={28} /><span className="text-sm">No photo yet</span></>}
              />
              <p className="text-sm font-semibold text-emerald-600" aria-live="polite">
                {roomType.available_count} room{roomType.available_count === 1 ? '' : 's'} available
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function PropertyDetails() {
  const { id } = useParams();
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
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
      setInquiryError('Please fill in all required fields, including your phone number, first.');
      return;
    }
    setSubmitting(true);
    try {
      const accessToken = sessionStorage.getItem(viewAccessKey) || '';
      await API.post('/inquiries', { property_id: id, user_name: inquiry.name, user_email: inquiry.email, message: inquiry.message }, { headers: viewAccessHeaders(accessToken) });
      alert('Inquiry sent successfully!');
      setInquiry({ name: '', email: '', message: '' });
    } catch (err) { setInquiryError(err.response?.data?.message || 'Could not send the inquiry.'); }
    finally { setSubmitting(false); }
  };

  if (loading) return <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6">Loading...</div>;
  if (!property) return <div className="text-center py-12" role="alert">{loadError || 'Property asset could not be located.'}<button type="button" disabled={loading} aria-busy={loading} className="mx-auto mt-4 flex items-center justify-center gap-2 rounded bg-slate-900 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-70" onClick={() => { setLoading(true); setLoadError(''); load().catch(err => setLoadError(err.response?.data?.message || 'Unable to load this property. Please try again.')).finally(() => setLoading(false)); }}>{loading && <LoadingSpinner size={16} />}{loading ? 'Loading...' : 'Try again'}</button></div>;
  const full = property.payments_enabled === false || Boolean(property.full_access && property.description !== undefined);
  const paymentsEnabled = property.payments_enabled !== false;
  const landlordPhone = property.phone_number || '';
  const whatsappPhone = cleanPhone(landlordPhone);
  const amenities = parseAmenities(property.amenities);

  return <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6">
    <h1 className="text-2xl font-bold text-slate-900 mb-2 sm:text-3xl">{property.title}</h1>
    <div className="flex items-center gap-2 text-slate-500 mb-6"><MapPin className="h-4 w-4" /><span>{property.town}, {property.county}</span></div>
    <ImageCarousel images={images} alt={property.title} className="aspect-[4/3] w-full" />
    {property.listing_type === 'multi_room' && <RoomAvailability roomTypes={property.room_types || []} />}
    {!full && paymentsEnabled && <div className="mt-8 bg-amber-50 border border-amber-200 rounded-2xl p-5 max-w-2xl"><div className="flex items-center gap-2 font-semibold"><Lock size={17} /> Full location, description and contact details are locked</div><p className="text-sm text-slate-600 mt-2">Pay through PesaPal to view the full listing.</p><div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4"><div><label htmlFor="billing-first-name" className="sr-only">First name</label><input id="billing-first-name" autoComplete="given-name" className="p-3 rounded-xl border w-full" placeholder="First name" value={billing.firstName} onChange={e => setBilling({ ...billing, firstName: e.target.value })} /></div><div><label htmlFor="billing-last-name" className="sr-only">Last name</label><input id="billing-last-name" autoComplete="family-name" className="p-3 rounded-xl border w-full" placeholder="Last name" value={billing.lastName} onChange={e => setBilling({ ...billing, lastName: e.target.value })} /></div><div><label htmlFor="billing-email" className="sr-only">Email address</label><input id="billing-email" autoComplete="email" className="p-3 rounded-xl border w-full" type="email" placeholder="Email address" value={billing.email} onChange={e => setBilling({ ...billing, email: e.target.value })} /></div><div><label htmlFor="billing-phone" className="sr-only">Phone number</label><input id="billing-phone" autoComplete="tel" className="p-3 rounded-xl border w-full" placeholder="Phone number" value={phone} onChange={e => setPhone(e.target.value)} /></div></div>{paymentError && <p className="mt-3 text-sm text-red-600" role="alert">{paymentError}</p>}<button type="button" onClick={payToView} disabled={paymentLoading} aria-busy={paymentLoading} className="flex items-center gap-2 bg-slate-900 text-white px-4 py-3 rounded-xl mt-2 disabled:cursor-not-allowed disabled:opacity-70">{paymentLoading && <LoadingSpinner size={16} />}{paymentLoading ? 'Starting...' : 'Continue'}</button></div>}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
      <div className="md:col-span-2"><h2 className="text-xl font-bold border-b pb-4 mb-4">Property Specifications</h2><p className="text-slate-600 leading-relaxed mb-6">{full ? property.description : 'Pay to unlock the full property description.'}</p>{amenities.length > 0 && <div className="mb-6"><h3 className="mb-3 text-sm font-semibold text-slate-900">Amenities</h3><div className="flex flex-wrap gap-2">{amenities.map(amenity => <span key={amenity} className="rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-sm text-brand-dark">{amenity}</span>)}</div></div>}<div className="grid grid-cols-2 gap-4 text-slate-700 bg-slate-100 p-4 rounded-xl"><div><strong>House Type:</strong> {property.house_type}</div><div><strong>Rent:</strong> KES {Number(property.price).toLocaleString()} / {property.payment_cycle}</div><div><strong>Status:</strong> {property.status}</div></div></div>
      <div className="space-y-6"><div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm"><div className="text-2xl font-bold mb-4">KES {Number(property.price).toLocaleString()}</div>{full ? <><div className="border-t pt-4 space-y-3"><div className="font-semibold text-slate-800">{landlordPhone || 'Contact unavailable'}</div><a href={`tel:${landlordPhone}`} className="w-full bg-slate-900 text-white py-3 rounded-xl flex items-center justify-center gap-2"><Phone size={16} /> Call Landlord</a><a href={`https://wa.me/${whatsappPhone}?text=Hi, I'm interested in ${property.title}`} target="_blank" rel="noopener noreferrer" className="w-full bg-emerald-500 text-white py-3 rounded-xl flex items-center justify-center gap-2"><MessageCircle size={16} /> WhatsApp</a></div></> : <p className="text-sm text-slate-500">Contact details are currently unavailable.</p>}</div>
      {full && <form onSubmit={handleInquirySubmit} noValidate className="bg-slate-50 border border-slate-200 rounded-3xl p-6 space-y-4"><h3 className="font-bold text-lg">Send an Inquiry</h3><div><label htmlFor="inquiry-name" className="sr-only">Your name</label><input id="inquiry-name" autoComplete="name" type="text" placeholder="Your Name" className="w-full p-3 rounded-xl border" value={inquiry.name} onChange={e => setInquiry({ ...inquiry, name: e.target.value })} /></div><div><label htmlFor="inquiry-email" className="sr-only">Your email</label><input id="inquiry-email" autoComplete="email" type="email" placeholder="Your Email" className="w-full p-3 rounded-xl border" value={inquiry.email} onChange={e => setInquiry({ ...inquiry, email: e.target.value })} /></div><div><label htmlFor="inquiry-phone" className="sr-only">Phone number</label><input id="inquiry-phone" autoComplete="tel" type="tel" placeholder="Phone number" className="w-full p-3 rounded-xl border" value={phone} onChange={e => setPhone(e.target.value)} /></div><div><label htmlFor="inquiry-message" className="sr-only">Message</label><textarea id="inquiry-message" placeholder="Message" className="w-full p-3 rounded-xl border" value={inquiry.message} onChange={e => setInquiry({ ...inquiry, message: e.target.value })} /></div>{inquiryError && <p className="text-sm text-red-600" role="alert">{inquiryError}</p>}<button disabled={submitting} aria-busy={submitting} type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2">{submitting && <LoadingSpinner size={16} />}{submitting ? 'Sending...' : <><Send size={16} /> Send Inquiry</>}</button></form>}
      </div>
    </div>
  </div>;
}
