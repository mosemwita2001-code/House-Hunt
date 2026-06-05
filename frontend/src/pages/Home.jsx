import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import API from '/src/api.js';

export default function Home() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        setLoading(true);
        const response = await API.get('/properties');
        setProperties(Array.isArray(response.data) ? response.data : []);
        setError(null);
      } catch (err) {
        console.error("Home View Fetch Failure:", err);
        setError("Could not connect to the server.");
      } finally {
        setLoading(false);
      }
    };

    fetchProperties();
  }, []);

  // Takes image_path like "img1.jpg,img2.jpg" and returns only the first image URL
  const getFirstImage = (image_path) => {
    if (!image_path) return null;
    const first = image_path.split(',')[0].trim();
    if (!first) return null;
    return `http://localhost:5000/uploads/${first}`;
  };

  return (
    <div className="flex flex-col w-full">
      {/* Hero Section */}
      <div
        className="relative bg-cover bg-center bg-no-repeat w-full min-h-[500px] flex items-center justify-center px-4 py-24"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80')" }}
      >
        <div className="absolute inset-0 bg-black/50" />
        <h2 className="relative text-4xl font-extrabold text-white sm:text-6xl drop-shadow-md z-10">
          Find Your Next Perfect Stay
        </h2>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-12 w-full">
        <h3 className="text-2xl font-bold text-slate-900 mb-8">Featured Properties</h3>

        {loading && <p className="text-center py-10">Loading listings...</p>}
        {error && <p className="text-center text-red-500 py-10">{error}</p>}

        <div className="grid md:grid-cols-3 gap-6">
          {properties.map((house) => {
            const imageUrl = getFirstImage(house.image_path);
            return (
              <Link to={`/property/${house.id}`} key={house.id} className="block group">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-lg transition">

                  {/* Image Section */}
                  <div className="h-48 bg-slate-200 overflow-hidden">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={house.title}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.parentElement.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#94a3b8">No Image</div>';
                        }}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-slate-400">No Image</div>
                    )}
                  </div>

                  <div className="p-4">
                    <h3 className="font-bold text-lg text-slate-900 truncate">{house.title}</h3>
                    <p className="text-slate-500 text-sm">{house.town}, {house.county}</p>
                    <p className="text-brand-DEFAULT font-bold mt-2">KES {Number(house.price).toLocaleString()}/mo</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}