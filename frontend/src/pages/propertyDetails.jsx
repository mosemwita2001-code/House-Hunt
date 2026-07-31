import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import API from '../services/api';
import { Phone, MapPin, MessageCircle, ImageOff, Send, Lock } from 'lucide-react';

const cleanPhone = (phone = '') => phone.replace(/\D/g, '').replace(/^0/, '254');
const sessionUser = () => { try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; } };

export default function PropertyDetails() {
  const { id } = useParams();
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [imgErrors, setImgErrors] = useState({});
  const [phone, setPhone] = useState('');
  const [billing, setBilling] = useState({ firstName: '', lastName: '', email: '' });
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [inquiry, setInquiry] = useState({ name: '', email: '', message: '' });
  const [submitting, setSubmitting] = useState(false);

  const paymentPhoneKey = `view_payment_phone_${sessionUser()?.id || 'guest'}_${id}`;
  const load = () => {
    const paidViewerPhone = sessionStorage.getItem(paymentPhoneKey) || '';
    return API.get(`/properties/${id}`, { params: paidViewerPhone ? { phone: paidViewerPhone } : {} }).then(res => {
      if (res.data.full_access) sessionStorage.removeItem(paymentPhoneKey);
      setProperty(res.data);
    });
  };
  useEffect(() => { setPhone(''); load().catch(err => console.error('Error fetching property:', err)).finally(() => setLoading(false)); }, [id]);

  const payToView = async () => {
    if (!phone.trim() || !billing.firstName.trim() || !billing.lastName.trim() || !billing.email.trim()) return alert('Enter your name, email, and the M-Pesa number that will pay the KSh 10 view fee.');
    setPaymentLoading(true);
    try {
      sessionStorage.setItem(paymentPhoneKey, phone.trim());
      const { data } = await API.post('/payments/view', { property_id: id, phone: phone.trim(), first_name: billing.firstName.trim(), last_name: billing.lastName.trim(), email: billing.email.trim(), country_code: 'KE' });
      if (data.redirect_url) window.location.href = data.redirect_url;
      else alert('Payment order created. Complete it through the payment provider.');
    } catch (err) { alert(err.response?.data?.message || 'Could not start payment.'); }
    finally { setPaymentLoading(false); }
  };

  const handleInquirySubmit = async e => {
    e.preventDefault();
    if (!inquiry.name.trim() || !inquiry.email.trim() || !inquiry.message.trim() || !phone.trim()) return alert('Fill in all fields, including your phone number.');
    setSubmitting(true);
    try {
      await API.post('/inquiries', { property_id: id, user_name: inquiry.name, user_email: inquiry.email, phone, message: inquiry.message });
      alert('Inquiry sent successfully!');
      setInquiry({ name: '', email: '', message: '' });
    } catch (err) { alert(err.response?.data?.message || 'A successful KSh 10 view payment is required first.'); }
    finally { setSubmitting(false); }
  };

  if (loading) return <div className="max-w-6xl mx-auto px-6 py-8">Loading...</div>;
  if (!property) return <div className="text-center py-12">Property asset could not be located.</div>;
  const full = Boolean(property.full_access && property.description !== undefined);
  const landlordPhone = property.phone_number || '';
  const whatsappPhone = cleanPhone(landlordPhone);
  const images = property.image_path ? property.image_path.split(',').map(n => n.trim()).filter(Boolean) : [];
  const user = sessionUser();

  return <div className="max-w-6xl mx-auto px-6 py-8">
    <h1 className="text-3xl font-bold text-slate-900 mb-2">{property.title}</h1>
    <div className="flex items-center gap-2 text-slate-500 mb-6"><MapPin className="h-4 w-4" /><span>{property.town}, {property.county}</span></div>
    <div className="flex flex-col gap-4">
      {images.length ? images.map((img, index) => { const src = img.startsWith('http') ? img : `${import.meta.env.VITE_API_URL?.replace('/api','') || 'http://localhost:5000'}/uploads/${img}`; return imgErrors[img] ? <div key={img} className="bg-slate-100 h-72 flex items-center justify-center"><ImageOff /></div> : <img key={img} src={src} alt={property.title} loading={index === 0 ? 'eager' : 'lazy'} decoding="async" className="w-full h-72 object-cover rounded-xl" onError={() => setImgErrors(p => ({ ...p, [img]: true }))} />; }) : <div className="h-64 bg-slate-100 flex items-center justify-center rounded-xl text-slate-400">No photos available</div>}
    </div>
    {!full && <div className="mt-8 bg-amber-50 border border-amber-200 rounded-2xl p-5 max-w-2xl"><div className="flex items-center gap-2 font-semibold"><Lock size={17} /> Full location, description and contact details are locked</div><p className="text-sm text-slate-600 mt-2">Pay KSh 10 through PesaPal to view the full listing.</p><div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4"><input className="p-3 rounded-xl border" placeholder="First name" value={billing.firstName} onChange={e => setBilling({ ...billing, firstName: e.target.value })} /><input className="p-3 rounded-xl border" placeholder="Last name" value={billing.lastName} onChange={e => setBilling({ ...billing, lastName: e.target.value })} /><input className="p-3 rounded-xl border" type="email" placeholder="Email address" value={billing.email} onChange={e => setBilling({ ...billing, email: e.target.value })} /><input className="p-3 rounded-xl border" placeholder="M-Pesa phone e.g. 0712345678" value={phone} onChange={e => setPhone(e.target.value)} /></div><button onClick={payToView} disabled={paymentLoading} className="bg-slate-900 text-white px-4 py-3 rounded-xl mt-2">{paymentLoading ? 'Starting...' : 'Pay KSh 10'}</button></div>}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
      <div className="md:col-span-2"><h2 className="text-xl font-bold border-b pb-4 mb-4">Property Specifications</h2><p className="text-slate-600 leading-relaxed mb-6">{full ? property.description : 'Pay to unlock the full property description.'}</p><div className="grid grid-cols-2 gap-4 text-slate-700 bg-slate-100 p-4 rounded-xl"><div><strong>House Type:</strong> {property.house_type}</div><div><strong>Rent:</strong> KES {Number(property.price).toLocaleString()} / {property.payment_cycle}</div><div><strong>Status:</strong> {property.status}</div></div></div>
      <div className="space-y-6"><div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm"><div className="text-2xl font-bold mb-4">KES {Number(property.price).toLocaleString()}</div>{full ? <><div className="border-t pt-4 space-y-3"><div className="font-semibold text-slate-800">{landlordPhone || 'Contact unavailable'}</div><a href={`tel:${landlordPhone}`} className="w-full bg-slate-900 text-white py-3 rounded-xl flex items-center justify-center gap-2"><Phone size={16} /> Call Landlord</a><a href={`https://wa.me/${whatsappPhone}?text=Hi, I'm interested in ${property.title}`} target="_blank" rel="noopener noreferrer" className="w-full bg-emerald-500 text-white py-3 rounded-xl flex items-center justify-center gap-2"><MessageCircle size={16} /> WhatsApp</a></div></> : <p className="text-sm text-slate-500">Contact details unlock after payment.</p>}</div>
      {full && <form onSubmit={handleInquirySubmit} className="bg-slate-50 border border-slate-200 rounded-3xl p-6 space-y-4"><h3 className="font-bold text-lg">Send an Inquiry</h3><input required type="text" placeholder="Your Name" className="w-full p-3 rounded-xl border" value={inquiry.name} onChange={e => setInquiry({ ...inquiry, name: e.target.value })} /><input required type="email" placeholder="Your Email" className="w-full p-3 rounded-xl border" value={inquiry.email} onChange={e => setInquiry({ ...inquiry, email: e.target.value })} /><textarea required placeholder="Message" className="w-full p-3 rounded-xl border h-24" value={inquiry.message} onChange={e => setInquiry({ ...inquiry, message: e.target.value })} /><button disabled={submitting} type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2">{submitting ? 'Sending...' : <><Send size={16} /> Send Inquiry</>}</button></form>}
      </div>
    </div>
  </div>;
}
