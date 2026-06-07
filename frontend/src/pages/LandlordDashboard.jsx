import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import {
  LayoutDashboard, Home, PlusSquare, MessageSquare, User, LogOut,
  Menu, X, Bell, ChevronRight, Building2, MapPin, Bed, Bath,
  Edit2, Trash2, Eye, Search, Upload, Loader2, AlertTriangle,
  CheckCircle, XCircle, AlertCircle, Info, Lock, ArrowRight,
} from "lucide-react";

// ─── Axios instance (replaces `import API from "../services/api"`) ───────────
// ─── Updated Axios instance ──────────────────────────────────────────────────
const API = axios.create({ baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api" });

API.interceptors.request.use((c) => {
  // Retrieve the 'user' object from localStorage
  const userData = localStorage.getItem("user");
  
  if (userData) {
    try {
      // Parse the stored JSON to extract the token
      const { token } = JSON.parse(userData);
      if (token) {
        c.headers.Authorization = `Bearer ${token}`;
      }
    } catch (err) {
      console.error("Error parsing user data from localStorage:", err);
    }
  }
  return c;
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
const propertyImage = (p, size = "400x260") => {
  if (p.image_path) {
    // image_path is comma-separated — take only the first filename
    const first = p.image_path.split(',')[0].trim();
    if (first) return first.startsWith("http") ? first : `${import.meta.env.VITE_API_URL?.replace("/api","") || "http://localhost:5000"}/uploads/${first}`;
  }
  return p.images?.[0]?.image_url || `https://placehold.co/${size}/1a1a2e/444?text=No+Image`;
};

const normalizeProperty = (p) => ({
  ...p,
  status:
    p.verification_status === "approved"
      ? "active"
      : p.verification_status || p.status || "pending",
  phoneNumber: p.phone_number || p.phoneNumber || "",
  rentPeriod:  p.payment_cycle || p.rentPeriod || "month",
  images:      p.images || (p.image_path
    ? p.image_path.split(',').map(n => n.trim()).filter(Boolean).map(n => ({ image_url: n.startsWith("http") ? n : `${import.meta.env.VITE_API_URL?.replace("/api","") || "http://localhost:5000"}/uploads/${n}` }))
    : []),
});

// ─── Toast ────────────────────────────────────────────────────────────────────
const TOAST_ICONS  = { success: CheckCircle, error: XCircle, warning: AlertCircle, info: Info };
const TOAST_BORDER = { success: "#34d399", error: "#f87171", warning: "#fbbf24", info: "#60a5fa" };
const TOAST_BG     = { success: "#052e16", error: "#450a0a", warning: "#431407", info: "#0c1a2e" };

function ToastItem({ toast, onRemove }) {
  const Icon = TOAST_ICONS[toast.type] || Info;
  return (
    <div style={{ background: TOAST_BG[toast.type], border: `1px solid ${TOAST_BORDER[toast.type]}`, borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "flex-start", gap: 10 }}>
      <Icon size={15} color={TOAST_BORDER[toast.type]} style={{ marginTop: 1, flexShrink: 0 }} />
      <p style={{ fontSize: 13, color: "white", flex: 1, lineHeight: 1.4, margin: 0 }}>{toast.message}</p>
      <button onClick={() => onRemove(toast.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", padding: 0, flexShrink: 0 }}><X size={13} /></button>
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] = useState([]);
  const add    = useCallback((message, type = "info") => { const id = Date.now(); setToasts(p => [...p, { id, message, type }]); setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500); }, []);
  const remove = useCallback((id) => setToasts(p => p.filter(t => t.id !== id)), []);
  return { toasts, add, remove };
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const inputStyle = {
  width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "white", outline: "none",
  fontFamily: "inherit", transition: "border-color 0.15s",
};
const onFocus = (e) => (e.target.style.borderColor = "rgba(124,58,237,0.6)");
const onBlur  = (e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)");

const STATUS_STYLE = {
  active:   { background: "rgba(16,185,129,0.12)",  color: "#34d399",                border: "1px solid rgba(16,185,129,0.25)"  },
  pending:  { background: "rgba(245,158,11,0.12)",  color: "#fbbf24",                border: "1px solid rgba(245,158,11,0.25)"  },
  inactive: { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)",  border: "1px solid rgba(255,255,255,0.1)"  },
  rejected: { background: "rgba(239,68,68,0.1)",    color: "#f87171",                border: "1px solid rgba(239,68,68,0.2)"    },
};

// ─── Stat card ────────────────────────────────────────────────────────────────
const ACCENT = {
  violet:  { bg: "rgba(124,58,237,0.12)",  border: "rgba(124,58,237,0.22)"  },
  emerald: { bg: "rgba(16,185,129,0.1)",   border: "rgba(16,185,129,0.2)"   },
  amber:   { bg: "rgba(245,158,11,0.1)",   border: "rgba(245,158,11,0.2)"   },
  sky:     { bg: "rgba(14,165,233,0.1)",   border: "rgba(14,165,233,0.2)"   },
};

function StatCard({ label, value, icon, color = "violet", loading }) {
  const a = ACCENT[color];
  if (loading) return (
    <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18, padding: 20 }}>
      <div style={{ height: 10, background: "rgba(255,255,255,0.06)", borderRadius: 6, width: "60%", marginBottom: 12 }} />
      <div style={{ height: 26, background: "rgba(255,255,255,0.06)", borderRadius: 6, width: "40%" }} />
    </div>
  );
  return (
    <div style={{ background: a.bg, border: `1px solid ${a.border}`, borderRadius: 18, padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>{label}</p>
        <span style={{ fontSize: 18 }}>{icon}</span>
      </div>
      <p style={{ fontSize: 30, fontWeight: 800, color: "white", margin: 0 }}>{value ?? "—"}</p>
    </div>
  );
}

// ─── Property card ────────────────────────────────────────────────────────────
function PropertyCard({ property, onEdit, onDelete }) {
  const ss = STATUS_STYLE[property.status] || STATUS_STYLE.pending;
  return (
    <div style={{ background: "#0f0f23", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, overflow: "hidden" }}>
      <div style={{ position: "relative", height: 176, background: "rgba(255,255,255,0.03)" }}>
        <img src={propertyImage(property)} alt={property.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.55), transparent)" }} />
        <span style={{ position: "absolute", top: 12, right: 12, fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20, ...ss }}>
          {(property.status || "pending").charAt(0).toUpperCase() + (property.status || "pending").slice(1)}
        </span>
      </div>
      <div style={{ padding: 16 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: "white", margin: "0 0 4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{property.title}</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 4, color: "rgba(255,255,255,0.4)", fontSize: 11, marginBottom: 12 }}>
          <MapPin size={11} /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{property.town}, {property.county}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 14 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Bed size={12} />{property.bedrooms} bed</span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Bath size={12} />{property.bathrooms} bath</span>
          <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: "#a78bfa" }}>
            KSh {Number(property.price).toLocaleString()}
            <span style={{ fontWeight: 400, color: "rgba(255,255,255,0.3)", fontSize: 11 }}>/{property.rentPeriod === "semester" ? "sem" : "mo"}</span>
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "8px 0", borderRadius: 10, fontSize: 11, fontWeight: 600, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}>
            <Eye size={12} /> View
          </button>
          <button onClick={() => onEdit(property)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "8px 0", borderRadius: 10, fontSize: 11, fontWeight: 600, background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.2)", color: "#a78bfa", cursor: "pointer" }}>
            <Edit2 size={12} /> Edit
          </button>
          <button onClick={() => onDelete(property.id)} style={{ padding: "8px 12px", borderRadius: 10, fontSize: 11, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", color: "#f87171", cursor: "pointer" }}>
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Confirm modal ────────────────────────────────────────────────────────────
function ConfirmModal({ open, title, message, onConfirm, onCancel, loading }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={onCancel} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} />
      <div style={{ position: "relative", background: "#131326", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: 24, maxWidth: 380, width: "100%", boxShadow: "0 25px 60px rgba(0,0,0,0.5)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <AlertTriangle size={18} color="#f87171" />
          </div>
          <h3 style={{ color: "white", fontWeight: 700, fontSize: 16, margin: 0 }}>{title}</h3>
        </div>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>{message}</p>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "none", color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          <button onClick={onConfirm} disabled={loading} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", borderRadius: 12, border: "none", background: "#dc2626", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: loading ? 0.5 : 1 }}>
            {loading && <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />} Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Property form ────────────────────────────────────────────────────────────
const COUNTIES = ["Nairobi","Mombasa","Kisumu","Nakuru","Eldoret","Thika","Nyeri","Kakamega","Tharaka Nithi","Migori","Lamu","Meru","Kisii","Kilifi","Machakos","Kericho","Kiambu","Laikipia","Narok","Kajiado","Makueni","Kitui"];
const HOUSE_TYPES = ["Bedsitter","Single Room","One Bedroom","Two Bedroom","Three Bedroom","Four Bedroom","Penthouse","Studio","Maisonette","Bungalow","Mansion","Townhouse","Apartment","Commercial"];
const AMENITIES_LIST = ["Wi-Fi","Parking","Security","CCTV","Swimming Pool","Gym","Elevator","Backup Power","Water 24/7","Furnished","Balcony","Garden","Laundry","Air Conditioning","Servants Quarters"];

// Field wrapper — defined OUTSIDE every component so it's never recreated
function Field({ label, error, children }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.45)", marginBottom: 6 }}>{label}</label>
      {children}
      {error && <p style={{ fontSize: 11, color: "#f87171", marginTop: 4 }}>{error}</p>}
    </div>
  );
}

function PropertyForm({ initial, onSubmit, loading, onCancel }) {
  const [form, setForm] = useState(() => ({
    title: "", price: "", deposit: "", county: "", town: "",
    house_type: "", bedrooms: 1, bathrooms: 1, description: "",
    status: "available",
    ...initial,
    phoneNumber:  initial?.phone_number  || initial?.phoneNumber  || "",
    rentPeriod:   initial?.payment_cycle || initial?.rentPeriod   || "month",
    amenities:    initial?.amenities
      ? (Array.isArray(initial.amenities) ? initial.amenities : initial.amenities.split(",").map(a => a.trim()).filter(Boolean))
      : [],
  }));
  const [previews, setPreviews] = useState(() => {
    if (initial?.images?.length) return initial.images.map(i => i.image_url);
    if (initial?.image_path) return initial.image_path.split(',').map(n => n.trim()).filter(Boolean).map(n => n.startsWith("http") ? n : `${import.meta.env.VITE_API_URL?.replace("/api","") || "http://localhost:5000"}/uploads/${n}`);
    return [];
  });
  const [newImages, setNewImages] = useState([]);
  const [errors,    setErrors]   = useState({});
  const fileRef = useRef();

  // Stable setter — never causes child re-renders via new function references
  const set = useCallback((k, v) => setForm(p => ({ ...p, [k]: v })), []);
  const toggleAmenity = useCallback((a) => setForm(p => ({
    ...p,
    amenities: p.amenities.includes(a) ? p.amenities.filter(x => x !== a) : [...p.amenities, a],
  })), []);

  const handleFiles = (e) => {
    const files = Array.from(e.target.files);
    setNewImages(p => [...p, ...files].slice(0, 10));
    setPreviews(p => [...p, ...files.map(f => URL.createObjectURL(f))].slice(0, 10));
  };
  const removeImg = (i) => {
    setPreviews(p => p.filter((_, idx) => idx !== i));
    setNewImages(p => p.filter((_, idx) => idx !== i));
  };

  const validate = () => {
    const e = {};
    if (!form.title.trim())         e.title       = "Required";
    if (!form.price || isNaN(+form.price)) e.price = "Valid price required";
    if (!form.county)               e.county      = "Required";
    if (!form.town.trim())          e.town        = "Required";
    if (!form.house_type)           e.house_type  = "Required";
    if (!form.description.trim())   e.description = "Required";
    if (!form.phoneNumber.trim())   e.phoneNumber = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    const fd = new FormData();
    fd.append("title",         form.title);
    fd.append("price",         form.price);
    fd.append("deposit",       form.deposit || 0);
    fd.append("county",        form.county);
    fd.append("town",          form.town);
    fd.append("house_type",    form.house_type);
    fd.append("bedrooms",      form.bedrooms);
    fd.append("bathrooms",     form.bathrooms);
    fd.append("description",   form.description);
    fd.append("status",        form.status);
    fd.append("phone_number",  form.phoneNumber);
    fd.append("payment_cycle", form.rentPeriod);
    fd.append("amenities",     form.amenities.join(","));
    newImages.forEach(img => fd.append("images", img));
    onSubmit(fd, form);
  };

  const sel = { ...inputStyle, cursor: "pointer", appearance: "none", WebkitAppearance: "none" };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Image upload */}
      <div>
        <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.45)", marginBottom: 8 }}>
          Property Images <span style={{ color: "rgba(255,255,255,0.2)" }}>(up to 10)</span>
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {previews.map((src, i) => (
            <div key={i} style={{ position: "relative", width: 76, height: 76, borderRadius: 12, overflow: "hidden", background: "rgba(255,255,255,0.05)" }}>
              <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <button type="button" onClick={() => removeImg(i)}
                style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer", opacity: 0 }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "1")} onMouseLeave={e => (e.currentTarget.style.opacity = "0")}>
                <X size={16} color="white" />
              </button>
            </div>
          ))}
          {previews.length < 10 && (
            <button type="button" onClick={() => fileRef.current.click()}
              style={{ width: 76, height: 76, borderRadius: 12, border: "2px dashed rgba(255,255,255,0.12)", background: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, color: "rgba(255,255,255,0.3)" }}>
              <Upload size={16} /><span style={{ fontSize: 10 }}>Add</span>
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" multiple accept="image/*" onChange={handleFiles} style={{ display: "none" }} />
      </div>

      {/* Two-column grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <Field label="Property Title *" error={errors.title}>
            <input style={inputStyle} value={form.title} onChange={e => set("title", e.target.value)}
              onFocus={onFocus} onBlur={onBlur} placeholder="e.g. Modern 2BR in Kilimani" />
          </Field>
        </div>

        <Field label="Monthly Rent (KSh) *" error={errors.price}>
          <input style={inputStyle} type="number" value={form.price} onChange={e => set("price", e.target.value)}
            onFocus={onFocus} onBlur={onBlur} placeholder="25000" />
        </Field>

        <Field label="Deposit (KSh)">
          <input style={inputStyle} type="number" value={form.deposit} onChange={e => set("deposit", e.target.value)}
            onFocus={onFocus} onBlur={onBlur} placeholder="50000" />
        </Field>

        <Field label="County *" error={errors.county}>
          <select style={sel} value={form.county} onChange={e => set("county", e.target.value)} onFocus={onFocus} onBlur={onBlur}>
            <option value="">Select county</option>
            {COUNTIES.map(c => <option key={c} value={c} style={{ background: "#1a1a2e" }}>{c}</option>)}
          </select>
        </Field>

        <Field label="Town / Area *" error={errors.town}>
          <input style={inputStyle} value={form.town} onChange={e => set("town", e.target.value)}
            onFocus={onFocus} onBlur={onBlur} placeholder="e.g. Westlands" />
        </Field>

        <Field label="House Type *" error={errors.house_type}>
          <select style={sel} value={form.house_type} onChange={e => set("house_type", e.target.value)} onFocus={onFocus} onBlur={onBlur}>
            <option value="">Select type</option>
            {HOUSE_TYPES.map(h => <option key={h} value={h} style={{ background: "#1a1a2e" }}>{h}</option>)}
          </select>
        </Field>

        <Field label="Status">
          <select style={sel} value={form.status} onChange={e => set("status", e.target.value)} onFocus={onFocus} onBlur={onBlur}>
            <option value="available" style={{ background: "#1a1a2e" }}>Available</option>
            <option value="taken"     style={{ background: "#1a1a2e" }}>Taken</option>
          </select>
        </Field>

        <Field label="Bedrooms">
          <input style={inputStyle} type="number" min="0" max="20" value={form.bedrooms}
            onChange={e => set("bedrooms", e.target.value)} onFocus={onFocus} onBlur={onBlur} />
        </Field>

        <Field label="Bathrooms">
          <input style={inputStyle} type="number" min="0" max="20" value={form.bathrooms}
            onChange={e => set("bathrooms", e.target.value)} onFocus={onFocus} onBlur={onBlur} />
        </Field>

        <div style={{ gridColumn: "1 / -1" }}>
          <Field label="Description *" error={errors.description}>
            <textarea style={{ ...inputStyle, resize: "none" }} rows={4} value={form.description}
              onChange={e => set("description", e.target.value)} onFocus={onFocus} onBlur={onBlur}
              placeholder="Describe the property in detail..." />
          </Field>
        </div>

        <Field label="Phone Number *" error={errors.phoneNumber}>
          <input style={inputStyle} value={form.phoneNumber} onChange={e => set("phoneNumber", e.target.value)}
            onFocus={onFocus} onBlur={onBlur} placeholder="+254712345678" />
        </Field>

        <Field label="Rent Period">
          <select style={sel} value={form.rentPeriod} onChange={e => set("rentPeriod", e.target.value)} onFocus={onFocus} onBlur={onBlur}>
            <option value="month"    style={{ background: "#1a1a2e" }}>Per Month</option>
            <option value="semester" style={{ background: "#1a1a2e" }}>Per Semester</option>
          </select>
        </Field>
      </div>

      {/* Amenities */}
      <div>
        <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.45)", marginBottom: 8 }}>Amenities</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {AMENITIES_LIST.map(a => (
            <button type="button" key={a} onClick={() => toggleAmenity(a)}
              style={{ padding: "5px 12px", borderRadius: 8, fontSize: 11, fontWeight: 500, cursor: "pointer", transition: "all 0.15s",
                background:   form.amenities.includes(a) ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.03)",
                border:       `1px solid ${form.amenities.includes(a) ? "rgba(124,58,237,0.4)" : "rgba(255,255,255,0.08)"}`,
                color:        form.amenities.includes(a) ? "#c4b5fd" : "rgba(255,255,255,0.4)",
              }}>
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 4 }}>
        {onCancel && (
          <button type="button" onClick={onCancel}
            style={{ padding: "10px 20px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "none", color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Cancel
          </button>
        )}
        <button type="submit" disabled={loading}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 24px", borderRadius: 12, border: "none", background: "#7c3aed", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: loading ? 0.5 : 1 }}>
          {loading && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
          {loading ? "Saving…" : "Save Property"}
        </button>
      </div>
    </form>
  );
}

// ─── Overview page ────────────────────────────────────────────────────────────
function Overview({ addToast, onNavigate, user }) {
  const [stats,   setStats]   = useState(null);
  const [props,   setProps]   = useState([]);
  const [inqs,    setInqs]    = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get("/landlord/dashboard")
      .then(({ data }) => {
        setStats(data.stats);
        setProps((data.properties || []).map(normalizeProperty));
        setInqs(data.inquiries   || []);
      })
      .catch(() => addToast("Could not load dashboard", "error"))
      .finally(() => setLoading(false));
  }, []);

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div style={{ maxWidth: 960 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 22 }}>
        <div>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>{greeting} 👋</p>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "white", margin: 0 }}>{user?.name || "Landlord"}</h1>
        </div>
        <button onClick={() => onNavigate("add")}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 12, background: "#7c3aed", border: "none", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          <PlusSquare size={15} /> Add Property
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12, marginBottom: 20 }}>
        <StatCard label="Total Properties" value={stats?.total}     icon="🏠" color="violet"  loading={loading} />
        <StatCard label="Active Listings"  value={stats?.active}    icon="✅" color="emerald" loading={loading} />
        <StatCard label="Pending Review"   value={stats?.pending}   icon="⏳" color="amber"   loading={loading} />
        <StatCard label="Total Inquiries"  value={stats?.inquiries} icon="💬" color="sky"     loading={loading} />
      </div>

      {/* Two columns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Recent properties */}
        <div style={{ background: "#0f0f23", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "white", margin: 0 }}>Recent Properties</h2>
            <button onClick={() => onNavigate("properties")} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#8b5cf6", background: "none", border: "none", cursor: "pointer" }}>
              View all <ArrowRight size={12} />
            </button>
          </div>
          {loading ? [1,2,3].map(i => <div key={i} style={{ height: 54, background: "rgba(255,255,255,0.04)", borderRadius: 10, marginBottom: 8 }} />)
          : props.length === 0 ? <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "24px 0" }}>No properties yet</p>
          : props.map(p => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.04)", marginBottom: 8 }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, overflow: "hidden", flexShrink: 0, background: "rgba(255,255,255,0.05)" }}>
                <img src={propertyImage(p, "42x42")} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "white", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", margin: 0 }}>{p.town}, {p.county}</p>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#a78bfa", margin: 0 }}>KSh {Number(p.price).toLocaleString()}</p>
                <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 20, ...(STATUS_STYLE[p.status] || STATUS_STYLE.pending) }}>{p.status}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Recent inquiries */}
        <div style={{ background: "#0f0f23", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "white", margin: 0 }}>Recent Inquiries</h2>
            <button onClick={() => onNavigate("inquiries")} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#8b5cf6", background: "none", border: "none", cursor: "pointer" }}>
              All <ArrowRight size={12} />
            </button>
          </div>
          {loading ? [1,2,3].map(i => <div key={i} style={{ height: 48, background: "rgba(255,255,255,0.04)", borderRadius: 10, marginBottom: 8 }} />)
          : inqs.length === 0 ? <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "24px 0" }}>No inquiries yet</p>
          : inqs.map(q => (
            <div key={q.id} style={{ padding: "10px 12px", borderRadius: 12, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.04)", marginBottom: 8 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "white", margin: "0 0 2px" }}>{q.user_name}</p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", margin: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{q.message}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── My Properties page ───────────────────────────────────────────────────────
function MyProperties({ addToast, onNavigate }) {
  const [properties, setProperties] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteModal,  setDeleteModal]  = useState({ open: false, id: null });
  const [deleting,     setDeleting]     = useState(false);
  const [editTarget,   setEditTarget]   = useState(null);
  const [saving,       setSaving]       = useState(false);

  const loadProperties = useCallback(() => {
    setLoading(true);
    API.get("/landlord/my-properties")
      .then(({ data }) => setProperties((data || []).map(normalizeProperty)))
      .catch(() => addToast("Could not load your properties", "error"))
      .finally(() => setLoading(false));
  }, [addToast]);

  useEffect(() => { loadProperties(); }, [loadProperties]);

  const filtered = properties.filter(p => {
    const ms = statusFilter === "all" || p.status === statusFilter;
    const mq = !search.trim() || p.title.toLowerCase().includes(search.toLowerCase()) || p.town.toLowerCase().includes(search.toLowerCase());
    return ms && mq;
  });

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await API.delete(`/landlord/properties/${deleteModal.id}`);
      setProperties(prev => prev.filter(x => x.id !== deleteModal.id));
      addToast("Property deleted", "success");
    } catch {
      addToast("Could not delete property", "error");
    } finally {
      setDeleting(false);
      setDeleteModal({ open: false, id: null });
    }
  };

  const handleEditSubmit = async (fd, formValues) => {
    setSaving(true);
    try {
      await API.put(`/landlord/properties/${editTarget.id}`, fd);
      setProperties(prev => prev.map(x =>
        x.id === editTarget.id
          ? normalizeProperty({ ...x, ...formValues, phone_number: formValues.phoneNumber, payment_cycle: formValues.rentPeriod })
          : x
      ));
      addToast("Property updated!", "success");
      setEditTarget(null);
    } catch {
      addToast("Could not update property", "error");
    } finally {
      setSaving(false);
    }
  };

  // Edit view
  if (editTarget) return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
        <button onClick={() => setEditTarget(null)}
          style={{ width: 36, height: 36, borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "rgba(255,255,255,0.5)" }}>
          <ChevronRight size={16} style={{ transform: "rotate(180deg)" }} />
        </button>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "white", margin: 0 }}>Edit Property</h1>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>Update your listing details</p>
        </div>
      </div>
      <div style={{ background: "#0f0f23", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: 24 }}>
        <PropertyForm initial={editTarget} onSubmit={handleEditSubmit} loading={saving} onCancel={() => setEditTarget(null)} />
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 960 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "white", margin: 0 }}>My Properties</h1>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>{properties.length} total listings</p>
        </div>
        <button onClick={() => onNavigate("add")}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 12, background: "#7c3aed", border: "none", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          <PlusSquare size={15} /> Add Property
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.3)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search properties…"
            style={{ ...inputStyle, paddingLeft: 34 }} onFocus={onFocus} onBlur={onBlur} />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["all","active","pending","inactive","rejected"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              style={{ padding: "8px 12px", borderRadius: 10, fontSize: 11, fontWeight: 600, cursor: "pointer", textTransform: "capitalize",
                border:      `1px solid ${statusFilter === s ? "rgba(124,58,237,0.4)" : "rgba(255,255,255,0.07)"}`,
                background:  statusFilter === s ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.03)",
                color:       statusFilter === s ? "#a78bfa" : "rgba(255,255,255,0.4)",
              }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
          {[1,2,3,4,5,6].map(i => <div key={i} style={{ height: 260, background: "rgba(255,255,255,0.03)", borderRadius: 20, border: "1px solid rgba(255,255,255,0.06)" }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <Home size={44} color="rgba(255,255,255,0.1)" style={{ margin: "0 auto 12px" }} />
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 14 }}>No properties found</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
          {filtered.map(p => (
            <PropertyCard key={p.id} property={p} onEdit={setEditTarget} onDelete={id => setDeleteModal({ open: true, id })} />
          ))}
        </div>
      )}

      <ConfirmModal open={deleteModal.open} title="Delete Property" message="This will permanently remove the listing. This cannot be undone."
        onConfirm={handleDelete} onCancel={() => setDeleteModal({ open: false, id: null })} loading={deleting} />
    </div>
  );
}

// ─── Add Property page ────────────────────────────────────────────────────────
function AddProperty({ addToast, onNavigate }) {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (fd) => {
    setLoading(true);
    try {
      await API.post("/landlord/properties", fd);
      addToast("Property listed successfully!", "success");
      onNavigate("properties");
    } catch (err) {
      addToast(err.response?.data?.message || "Could not save property", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
        <button onClick={() => onNavigate("properties")}
          style={{ width: 36, height: 36, borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "rgba(255,255,255,0.5)" }}>
          <ChevronRight size={16} style={{ transform: "rotate(180deg)" }} />
        </button>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "white", margin: 0 }}>Add New Property</h1>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>Fill in the details to list your property</p>
        </div>
      </div>
      <div style={{ background: "#0f0f23", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: 24 }}>
        <PropertyForm onSubmit={handleSubmit} loading={loading} />
      </div>
    </div>
  );
}

// ─── Inquiries page ───────────────────────────────────────────────────────────
function Inquiries() {
  // 1. Initialize as state so the list can update
  const [inquiries, setInquiries] = useState([
    { id: 1, user_name: "Amina Hassan",  user_email: "amina@email.com", user_phone: "+254712345678", property_title: "Modern 2BR in Kilimani", message: "Hi, I'm very interested. Is it still available? I'm looking to move in next month.", created_at: new Date().toISOString() },
    { id: 2, user_name: "Peter Kamau",   user_email: "peter@email.com", user_phone: "+254723456789", property_title: "Studio Apt, Westlands",  message: "Can I schedule a viewing this weekend? Also, is parking included in the rent?", created_at: new Date(Date.now() - 86400000).toISOString() },
    { id: 3, user_name: "Grace Wanjiku", user_email: "grace@email.com", user_phone: null,             property_title: "3BR Maisonette, Karen",  message: "Is the deposit negotiable? I can offer two months upfront if that helps.", created_at: new Date(Date.now() - 2*86400000).toISOString() },
  ]);

  const [search, setSearch] = useState("");
  
  // 2. Delete handler
  const handleDelete = (id) => {
    if (window.confirm("Are you sure you want to delete this inquiry?")) {
      setInquiries(inquiries.filter(q => q.id !== id));
    }
  };

  const filtered = inquiries.filter(q => !search || q.message.toLowerCase().includes(search.toLowerCase()) || q.user_name.toLowerCase().includes(search.toLowerCase()));
  const avatarBg = ["#7c3aed","#0ea5e9","#10b981","#f59e0b"];

  return (
    <div style={{ maxWidth: 720 }}>
      {/* ... Header and Search code remains the same ... */}
      
      {filtered.map((q, i) => (
        <div key={q.id} style={{ background: "#0f0f23", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, padding: 18, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: avatarBg[i % avatarBg.length], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "white", flexShrink: 0 }}>
              {q.user_name.charAt(0)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              
              {/* Header row: Name/Date on left, Delete button on right */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "white", margin: 0 }}>{q.user_name}</p>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", margin: 0 }}>{new Date(q.created_at).toLocaleDateString("en-KE", { dateStyle: "medium" })}</p>
                </div>
                
                {/* DELETE BUTTON */}
                <button onClick={() => handleDelete(q.id)} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#ef4444", fontSize: 10, padding: "2px 8px", borderRadius: 6, cursor: "pointer" }}>
                  Delete
                </button>
              </div>

              {q.property_title && (
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
                  <Home size={11} color="rgba(255,255,255,0.3)" />
                  <p style={{ fontSize: 11, color: "#8b5cf6", margin: 0 }}>{q.property_title}</p>
                </div>
              )}
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.5, margin: 0 }}>{q.message}</p>
              
              {/* ... (Keep Reply buttons as they were) ... */}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Profile page ─────────────────────────────────────────────────────────────
function Profile({ addToast }) {
  const [profileForm, setProfileForm] = useState(() => {
    try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; }
  });
  const [pwForm, setPwForm] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [profileLoading, setProfileLoading] = useState(false);
  const [pwLoading,      setPwLoading]      = useState(false);

  const saveProfile = (e) => {
    e.preventDefault();
    setProfileLoading(true);
    // Replace with real API call: API.put("/users/profile", profileForm)
    setTimeout(() => {
      localStorage.setItem("user", JSON.stringify(profileForm));
      addToast("Profile updated!", "success");
      setProfileLoading(false);
    }, 600);
  };

  const changePassword = (e) => {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm_password) return addToast("Passwords do not match", "error");
    if (pwForm.new_password.length < 6) return addToast("Password must be at least 6 characters", "error");
    setPwLoading(true);
    setTimeout(() => { addToast("Password changed!", "success"); setPwLoading(false); setPwForm({ current_password: "", new_password: "", confirm_password: "" }); }, 700);
  };

  const setP  = (k, v) => setProfileForm(p => ({ ...p, [k]: v }));
  const setPW = (k, v) => setPwForm(p => ({ ...p, [k]: v }));

  const initial = profileForm?.name?.charAt(0)?.toUpperCase() || "?";

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "white", margin: 0 }}>Profile Settings</h1>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>Manage your account information</p>
      </div>

      {/* Avatar card */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: 18, background: "#0f0f23", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, marginBottom: 16 }}>
        <div style={{ width: 60, height: 60, borderRadius: 18, background: "linear-gradient(135deg,#7c3aed,#ec4899)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700, color: "white", flexShrink: 0 }}>{initial}</div>
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: "white", margin: 0 }}>{profileForm?.name || "Landlord"}</p>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: "2px 0 6px" }}>{profileForm?.email}</p>
          <span style={{ fontSize: 10, padding: "2px 10px", borderRadius: 20, background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.3)", color: "#a78bfa", fontWeight: 700 }}>LANDLORD</span>
        </div>
      </div>

      {/* Personal info */}
      <div style={{ background: "#0f0f23", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <User size={15} color="#8b5cf6" /><h2 style={{ fontSize: 13, fontWeight: 700, color: "white", margin: 0 }}>Personal Information</h2>
        </div>
        <form onSubmit={saveProfile} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[["Full Name","name","text","Your name"],["Email Address","email","email","email@example.com"],["Phone Number","phone","tel","+254 700 000 000"]].map(([label, key, type, placeholder]) => (
            <div key={key}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.45)", marginBottom: 6 }}>{label}</label>
              <input style={inputStyle} type={type} value={profileForm[key] || ""} onChange={e => setP(key, e.target.value)} onFocus={onFocus} onBlur={onBlur} placeholder={placeholder} />
            </div>
          ))}
          <button type="submit" disabled={profileLoading}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: 12, border: "none", background: "#7c3aed", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: profileLoading ? 0.5 : 1, width: "fit-content", marginTop: 4 }}>
            {profileLoading && <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />} Save Changes
          </button>
        </form>
      </div>

      {/* Change password */}
      <div style={{ background: "#0f0f23", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Lock size={15} color="#8b5cf6" /><h2 style={{ fontSize: 13, fontWeight: 700, color: "white", margin: 0 }}>Change Password</h2>
        </div>
        <form onSubmit={changePassword} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[["Current Password","current_password"],["New Password","new_password"],["Confirm New Password","confirm_password"]].map(([label, key]) => (
            <div key={key}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.45)", marginBottom: 6 }}>{label}</label>
              <input style={inputStyle} type="password" value={pwForm[key]} onChange={e => setPW(key, e.target.value)} onFocus={onFocus} onBlur={onBlur} placeholder="••••••••" />
            </div>
          ))}
          <button type="submit" disabled={pwLoading}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: 12, border: "none", background: "#7c3aed", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: pwLoading ? 0.5 : 1, width: "fit-content", marginTop: 4 }}>
            {pwLoading && <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />} Update Password
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Sidebar nav config ───────────────────────────────────────────────────────
const NAV = [
  { id: "overview",   Icon: LayoutDashboard, label: "Overview"      },
  { id: "properties", Icon: Home,            label: "My Properties" },
  { id: "add",        Icon: PlusSquare,      label: "Add Property"  },
  { id: "inquiries",  Icon: MessageSquare,   label: "Inquiries"     },
  { id: "profile",    Icon: User,            label: "Profile"       },
];

// ─── Root component ───────────────────────────────────────────────────────────
export default function LandlordDashboard() {
  const [page,        setPage]        = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { toasts, add: addToast, remove: removeToast } = useToast();

  // Read user once — stable ref, won't cause re-renders
  const user = useState(() => { try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; } })[0];

  const displayName    = user?.name  || "Landlord";
  const displayEmail   = user?.email || "";
  const displayInitial = displayName.charAt(0).toUpperCase();

  const navigate = useCallback((p) => { setPage(p); setSidebarOpen(false); }, []);

  // ── FIX: render current page via a switch/function, NOT an object literal ──
  // This prevents React from remounting the page component on every render,
  // which was causing input focus to reset after every keystroke.
  const renderPage = () => {
    switch (page) {
      case "overview":   return <Overview    addToast={addToast} onNavigate={navigate} user={user} />;
      case "properties": return <MyProperties addToast={addToast} onNavigate={navigate} />;
      case "add":        return <AddProperty  addToast={addToast} onNavigate={navigate} />;
      case "inquiries":  return <Inquiries />;
      case "profile":    return <Profile addToast={addToast} />;
      default:           return null;
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0d0d1a", color: "white", display: "flex" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');
        *{box-sizing:border-box;-webkit-font-smoothing:antialiased;}
        body,input,button,select,textarea,table{font-family:'DM Sans',sans-serif;}
        h1,h2,h3{font-family:'Syne',sans-serif;}
        input,select,textarea{color-scheme:dark;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:rgba(124,58,237,0.35);border-radius:4px;}
        @keyframes spin{to{transform:rotate(360deg);}}
        #ld-sidebar{transform:translateX(-100%);transition:transform 0.3s;}
        #ld-sidebar.open{transform:translateX(0);}
        @media(min-width:1024px){
          #ld-sidebar{position:static!important;transform:none!important;}
          #ld-overlay{display:none!important;}
          #ld-menu-btn{display:none!important;}
        }
      `}</style>

      {/* Toasts */}
      <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8, maxWidth: 320 }}>
        {toasts.map(t => <ToastItem key={t.id} toast={t} onRemove={removeToast} />)}
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div id="ld-overlay" onClick={() => setSidebarOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 40, backdropFilter: "blur(4px)" }} />
      )}

      {/* ── Sidebar ── */}
      <aside id="ld-sidebar" className={sidebarOpen ? "open" : ""}
        style={{ position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 50, width: 240, background: "#090917", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column" }}>

        {/* Logo */}
        <div style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: "linear-gradient(135deg,#7c3aed,#4f46e5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Building2 size={16} color="white" />
            </div>
            <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 14, color: "white" }}>Kejahunt</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", display: "flex" }}>
            <X size={16} />
          </button>
        </div>

        {/* User badge */}
        <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "8px 10px" }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#7c3aed,#ec4899)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "white", flexShrink: 0 }}>
              {displayInitial}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "white", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</p>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayEmail}</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 10px", overflowY: "auto" }}>
          <p style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.2)", textTransform: "uppercase", letterSpacing: "0.12em", padding: "0 8px", margin: "0 0 10px" }}>Dashboard</p>
          {NAV.map(({ id, Icon, label }) => {
            const active = page === id;
            return (
              <button key={id} onClick={() => navigate(id)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, marginBottom: 2, cursor: "pointer",
                  border: `1px solid ${active ? "rgba(124,58,237,0.22)" : "transparent"}`,
                  background: active ? "rgba(124,58,237,0.15)" : "none",
                  color: active ? "#a78bfa" : "rgba(255,255,255,0.45)",
                  fontSize: 13, fontWeight: 500, textAlign: "left", transition: "all 0.15s",
                }}>
                <Icon size={16} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{label}</span>
                <ChevronRight size={11} style={{ opacity: 0.3 }} />
              </button>
            );
          })}
        </nav>

        <div style={{ padding: "10px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={() => { localStorage.removeItem("token"); localStorage.removeItem("user"); window.location.href = "/login"; }}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, cursor: "pointer", border: "none", background: "none", color: "rgba(239,68,68,0.6)", fontSize: 13, fontWeight: 500 }}>
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Topbar */}
        <header style={{ height: 64, background: "rgba(9,9,23,0.9)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", position: "sticky", top: 0, zIndex: 30 }}>
          <button id="ld-menu-btn" onClick={() => setSidebarOpen(true)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.5)", display: "flex" }}>
            <Menu size={20} />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>Welcome,</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "white" }}>{displayName}</span>
            <button style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative" }}>
              <Bell size={15} color="rgba(255,255,255,0.5)" />
              <span style={{ position: "absolute", top: 7, right: 7, width: 6, height: 6, borderRadius: "50%", background: "#7c3aed" }} />
            </button>
          </div>
        </header>

        <main style={{ flex: 1, overflow: "auto", padding: "22px 24px" }}>
          {renderPage()}
        </main>
      </div>
    </div>
  );
}