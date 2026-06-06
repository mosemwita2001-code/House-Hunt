import { useEffect, useState } from 'react';

import { useParams } from 'react-router-dom';

import API from '../services/api';

import { Phone, MapPin, MessageCircle, ImageOff, Send } from 'lucide-react';



const cleanPhone = (phone = '') => phone.replace(/\D/g, '').replace(/^0/, '254');



export default function PropertyDetails() {

  const { id } = useParams();

  const [property, setProperty] = useState(null);

  const [loading, setLoading] = useState(true);

  const [imgErrors, setImgErrors] = useState({});

  

  // Inquiry form state

  const [inquiry, setInquiry] = useState({ name: '', email: '', message: '' });

  const [submitting, setSubmitting] = useState(false);



  useEffect(() => {

    API.get(`/properties/${id}`)

      .then(res => setProperty(res.data))

      .catch(err => console.error("Error fetching property:", err))

      .finally(() => setLoading(false));

  }, [id]);



const handleInquirySubmit = async (e) => {

    e.preventDefault();

    

    // Validate inputs

    if (!inquiry.name.trim() || !inquiry.email.trim() || !inquiry.message.trim()) {

      alert("Please fill in all fields.");

      return;

    }



    setSubmitting(true);

    try {

      // Send directly to /inquiries. The API base URL handles the /api prefix.

      await API.post('/inquiries', { 

        property_id: id,

        user_name: inquiry.name,

        user_email: inquiry.email,

        message: inquiry.message 

      });

      

      alert("Inquiry sent successfully!");

      setInquiry({ name: '', email: '', message: '' });

    } catch (err) {

      console.error("Submission failed:", err.response?.data || err.message);

      alert("Failed to send inquiry. Please check your network.");

    } finally {

      setSubmitting(false);

    }

  };



  if (loading) return <div className="max-w-6xl mx-auto px-6 py-8 animate-pulse">Loading...</div>;

  if (!property) return <div className="text-center py-12">Property asset could not be located.</div>;



  const phone = property.phone_number || '';

  const whatsappPhone = cleanPhone(phone);

  const images = property.image_path ? property.image_path.split(',').map(n => n.trim()).filter(Boolean) : [];



  return (

    <div className="max-w-6xl mx-auto px-6 py-8">

      <h1 className="text-3xl font-bold text-slate-900 mb-2">{property.title}</h1>

      <div className="flex items-center gap-2 text-slate-500 mb-6">

        <MapPin className="h-4 w-4" />

        <span>{property.town}, {property.county}</span>

      </div>



      {/* Image Gallery */}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {images.length > 0 ? (

          images.map((imgName) => {

            const finalImageUrl = imgName.startsWith('http') ? imgName : `${import.meta.env.VITE_API_URL?.replace('/api','') || 'http://localhost:5000'}/uploads/${imgName}`;

            if (imgErrors[imgName]) return <div key={imgName} className="bg-slate-100 h-72 flex items-center justify-center text-slate-400"><ImageOff size={32} /></div>;

            return <img key={imgName} src={finalImageUrl} alt={property.title} className="w-full h-72 object-cover rounded-xl" onError={() => setImgErrors(prev => ({ ...prev, [imgName]: true }))} />;

          })

        ) : (

          <div className="h-64 bg-slate-100 flex items-center justify-center rounded-xl text-slate-400">No photos available</div>

        )}

      </div>



      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">

        <div className="md:col-span-2">

          <h2 className="text-xl font-bold border-b pb-4 mb-4">Property Specifications</h2>

          <p className="text-slate-600 leading-relaxed mb-6">{property.description}</p>

          <div className="grid grid-cols-2 gap-4 text-slate-700 bg-slate-100 p-4 rounded-xl">

            <div><strong>House Type:</strong> {property.house_type}</div>

            <div><strong>Bedrooms:</strong> {property.bedrooms}</div>

            <div><strong>Bathrooms:</strong> {property.bathrooms}</div>

          </div>

        </div>



        {/* Sidebar: Price, Contact, and New Inquiry Form */}

        <div className="space-y-6">

          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">

            <div className="text-2xl font-bold mb-4">KES {Number(property.price).toLocaleString()}</div>

            <div className="border-t pt-4 space-y-3">

              <div className="font-semibold text-slate-800 mb-2">{phone || "Contact via WhatsApp"}</div>

              <a href={`tel:${phone}`} className="w-full bg-slate-900 text-white py-3 rounded-xl flex items-center justify-center gap-2"><Phone className="h-4 w-4" /> Call Landlord</a>

              <a href={`https://wa.me/${whatsappPhone}?text=Hi, I'm interested in ${property.title}`} target="_blank" rel="noopener noreferrer" className="w-full bg-emerald-500 text-white py-3 rounded-xl flex items-center justify-center gap-2"><MessageCircle className="h-4 w-4" /> WhatsApp</a>

            </div>

          </div>



          <form onSubmit={handleInquirySubmit} className="bg-slate-50 border border-slate-200 rounded-3xl p-6 space-y-4">

            <h3 className="font-bold text-lg">Send an Inquiry</h3>

            <input required type="text" placeholder="Your Name" className="w-full p-3 rounded-xl border" value={inquiry.name} onChange={e => setInquiry({...inquiry, name: e.target.value})} />

            <input required type="email" placeholder="Your Email" className="w-full p-3 rounded-xl border" value={inquiry.email} onChange={e => setInquiry({...inquiry, email: e.target.value})} />

            <textarea required placeholder="Message" className="w-full p-3 rounded-xl border h-24" value={inquiry.message} onChange={e => setInquiry({...inquiry, message: e.target.value})} />

            <button disabled={submitting} type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2">

              {submitting ? 'Sending...' : <><Send className="h-4 w-4" /> Send Inquiry</>}

            </button>

          </form>

        </div>

      </div>

    </div>

  );

}