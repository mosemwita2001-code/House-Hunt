import { useState, useEffect, useCallback, useMemo } from "react";
import {
  LayoutDashboard, Users, Home, Trash2,
  UserX, UserCheck, Menu, X, AlertTriangle, Loader2, LogOut, Clock,
  Building2, TrendingUp, Search, Filter, CheckCircle, XCircle, BarChart3
} from "lucide-react";
import {
  getDashboardStats,
  getAllUsers,
  updateUserStatus,
  deleteUser,
  getAllListings,
  updateListingStatus,
  deleteListing,
} from "../services/api";

const normalizeListing = (listing) => ({
  ...listing,
  status: listing.verification_status === "approved" ? "active" : listing.verification_status || listing.status || "pending",
  landlord: listing.landlord || listing.landlord_name || "Landlord",
  images: listing.images || (listing.image_path ? [{ image_url: `http://localhost:5000/uploads/${listing.image_path}` }] : []),
});

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Real State Data Containers
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [listings, setListings] = useState([]);
  
  // App States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Get active admin info from local storage session
  const adminUser = JSON.parse(localStorage.getItem("user") || "null") || { name: "Administrator", email: "admin@system.com" };
  const displayInitial = adminUser.name ? adminUser.name.charAt(0).toUpperCase() : "A";

  // LOAD DATA DIRECTLY FROM MYSQL ENDPOINTS
  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, usersRes, listingsRes] = await Promise.all([
        getDashboardStats(),
        getAllUsers(),
        getAllListings()
      ]);

      setStats(statsRes.data);
      setUsers(usersRes.data);
      setListings(listingsRes.data.map(normalizeListing));
    } catch (err) {
      console.error("Database connection failure:", err);
      setError(err.response?.data?.message || "Failed to establish a secure link with MySQL.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // USER INTERACTION HANDLERS
  const handleToggleUserStatus = async (id, currentStatus) => {
    const nextStatus = currentStatus === "active" ? "suspended" : "active";
    try {
      await updateUserStatus(id, nextStatus);
      setUsers(users.map(u => u.id === id ? { ...u, status: nextStatus, account_status: nextStatus } : u));
    } catch (err) {
      alert(err.response?.data?.message || "Status change rejected by server.");
    }
  };

  const handleDeleteUserClick = async (id) => {
    if (!window.confirm("Are you certain you want to remove this profile permanently from MySQL?")) return;
    try {
      await deleteUser(id);
      setUsers(users.filter(u => u.id !== id));
    } catch (err) {
      alert(err.response?.data?.message || "Deletion request denied.");
    }
  };

  const handleUpdateListingStatus = async (id, targetStatus) => {
    try {
      await updateListingStatus(id, targetStatus);
      setListings(listings.map(l => l.id === id ? { ...l, status: targetStatus, verification_status: targetStatus } : l));
    } catch (err) {
      alert(err.response?.data?.message || "Listing alteration failed.");
    }
  };

  const handleDeleteListingClick = async (id) => {
    if (!window.confirm("Delete this housing listing item?")) return;
    try {
      await deleteListing(id);
      setListings(listings.filter(l => l.id !== id));
    } catch (err) {
      alert(err.response?.data?.message || "Listing removal failed.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    window.location.href = "/login";
  };

  // FILTER AND SEARCH RENDERING LOGIC (Optimized via useMemo)
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const nameStr = u.name || "";
      const emailStr = u.email || "";
      const currentStatus = u.account_status || u.status || "active";
      
      const matchesSearch = nameStr.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            emailStr.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || currentStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [users, searchQuery, statusFilter]);

  const filteredListings = useMemo(() => {
    return listings.filter(l => {
      const titleStr = l.title || "";
      const landlordStr = l.landlord || "";
      const matchesSearch = titleStr.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            landlordStr.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || l.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [listings, searchQuery, statusFilter]);

  if (loading) {
    return (
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0b0f19", color: "white", gap: 12 }}>
        <Loader2 size={32} className="animate-spin" color="#7c3aed" />
        <p style={{ opacity: 0.7, fontSize: 14 }}>Connecting to MySQL Cluster...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0b0f19", color: "white", gap: 16, padding: 20 }}>
        <AlertTriangle size={48} color="#ef4444" />
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>Access Authorization Interrupted</h2>
        <p style={{ opacity: 0.7, fontSize: 14, maxWidth: 400, textAlign: "center" }}>{error}</p>
        <button onClick={loadDashboardData} style={{ background: "#7c3aed", color: "white", border: "none", padding: "10px 20px", borderRadius: 8, cursor: "pointer", fontWeight: 500 }}>Retry Connection</button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0b0f19", color: "#f3f4f6", fontFamily: "system-ui, sans-serif", overflow: "hidden" }}>
      {/* SIDEBAR */}
      <div style={{ width: sidebarOpen ? 260 : 0, background: "#111827", borderRight: "1px solid rgba(255,255,255,0.05)", display: "flex", flexDirection: "column", transition: "width 0.3s ease", overflow: "hidden", position: "relative" }}>
        <div style={{ padding: "24px 20px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ background: "linear-gradient(135deg, #7c3aed, #ec4899)", padding: 8, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Building2 size={20} color="white" />
          </div>
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.025em" }}>Kejahunt <span style={{ color: "#7c3aed", fontSize: 12, fontWeight: 500 }}>HQ</span></span>
        </div>

        <div style={{ padding: "20px 12px", display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
          {[
            { id: "dashboard", label: "Dashboard overview", icon: LayoutDashboard },
            { id: "users", label: "User Management", icon: Users },
            { id: "listings", label: "Listing Approvals", icon: Home },
            { id: "statistics", label: "Statistics", icon: BarChart3 },
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id); setStatusFilter("all"); setSearchQuery(""); }} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "12px 16px", border: "none", borderRadius: 10, background: active ? "rgba(124,58,237,0.15)" : "transparent", color: active ? "#a78bfa" : "rgba(255,255,255,0.6)", fontSize: 14, fontWeight: active ? 600 : 500, textAlign: "left", cursor: "pointer", transition: "all 0.2s" }}>
                <Icon size={18} color={active ? "#a78bfa" : "rgba(255,255,255,0.4)"} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div style={{ padding: 16, borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 8px" }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#7c3aed,#ec4899)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "white" }}>{displayInitial}</div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "white", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", margin: 0 }}>{adminUser.name}</p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", margin: 0 }}>Root Controller</p>
            </div>
          </div>
          <button onClick={handleLogout} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "10px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, color: "#f87171", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <LogOut size={14} /> Exit Workspace
          </button>
        </div>
      </div>

      {/* MAIN CONTAINER */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* HEADER */}
        <div style={{ height: 70, background: "#111827", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", display: "flex", alignItems: "center" }}>
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <h1 style={{ fontSize: 18, fontWeight: 700, textTransform: "capitalize", margin: 0 }}>{activeTab === "dashboard" ? "Control Panel" : activeTab === "statistics" ? "Analytical Metrics" : `${activeTab} interface`}</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button style={{ padding: "6px 12px", borderRadius: 10, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", color: "#fbbf24", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
              <Clock size={12} /> {stats?.pendingListings ?? listings.filter(l => l.status === "pending").length} pending entries
            </button>
          </div>
        </div>

        {/* WORKSPACE CONTENT SCROLLER */}
        <div style={{ flex: 1, overflowY: "auto", padding: "32px 24px" }}>
          
          {/* TAB 1: OVERVIEW DASHBOARD */}
          {activeTab === "dashboard" && (
            <div>
              {/* COUNTERS METRIC GRID */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20, marginBottom: 32 }}>
                {[
                  { label: "Total Platform Users", count: stats?.totalUsers ?? users.length, icon: Users, color: "#7c3aed" },
                  { label: "Approved Houses", count: stats?.activeListings ?? listings.filter(l => l.status === "approved" || l.status === "active").length, icon: Home, color: "#10b981" },
                  { label: "Verification Queue", count: stats?.pendingListings ?? listings.filter(l => l.status === "pending").length, icon: Clock, color: "#f59e0b" },
                  { label: "Active Landlords", count: stats?.totalLandlords ?? users.filter(u => u.role === "landlord").length, icon: Users, color: "#3b82f6" },
                ].map((card, i) => {
                  const CardIcon = card.icon;
                  return (
                    <div key={i} style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.04)", padding: 24, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", fontWeight: 500, margin: "0 0 6px 0" }}>{card.label}</p>
                        <h3 style={{ fontSize: 28, fontWeight: 700, margin: 0, color: "white" }}>{card.count}</h3>
                      </div>
                      <div style={{ background: `rgba(${card.color === "#7c3aed" ? "124,58,237" : card.color === "#10b981" ? "16,185,129" : card.color === "#f59e0b" ? "245,158,11" : "59,130,246"}, 0.1)`, padding: 12, borderRadius: 12 }}>
                        <CardIcon size={22} color={card.color} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ background: "#111827", borderRadius: 16, padding: 32, textAlign: "center", border: "1px solid rgba(255,255,255,0.04)" }}>
                <h2 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 8px 0" }}>Welcome back, {adminUser.name}</h2>
                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, margin: 0 }}>Select an option from the sidebar to begin managing the KejaHunt nodes.</p>
              </div>
            </div>
          )}

          {/* TAB 2: USER CONTROLLER ENGINE */}
          {activeTab === "users" && (
            <div style={{ background: "#111827", borderRadius: 16, border: "1px solid rgba(255,255,255,0.04)", overflow: "hidden" }}>
              <div style={{ padding: 24, borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", gap: 16, justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
                  <Search size={16} color="rgba(255,255,255,0.3)" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
                  <input type="text" placeholder="Search rows by profile name or email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: "100%", background: "#0b0f19", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 14px 10px 40px", color: "white", fontSize: 14, outline: "none" }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Filter size={14} color="rgba(255,255,255,0.4)" />
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ background: "#0b0f19", border: "1px solid rgba(255,255,255,0.08)", color: "white", padding: "10px 14px", borderRadius: 10, fontSize: 14, outline: "none", cursor: "pointer" }}>
                    <option value="all">All Profiles</option>
                    <option value="active">Active Only</option>
                    <option value="suspended">Suspended Only</option>
                  </select>
                </div>
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.01)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <th style={{ padding: "16px 24px", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.4)" }}>Identity</th>
                    <th style={{ padding: "16px 24px", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.4)" }}>Role Classification</th>
                    <th style={{ padding: "16px 24px", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.4)" }}>Integrity Status</th>
                    <th style={{ padding: "16px 24px", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.4)" }}>House Listings</th>
                    <th style={{ padding: "16px 24px", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.4)" }}>Registered Date</th>
                    <th style={{ padding: "16px 24px", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.4)", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(user => {
                    const userStatus = user.account_status || user.status || "active";
                    return (
                      <tr key={user.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                        <td style={{ padding: "18px 24px" }}>
                          <div style={{ fontWeight: 600, color: "white", fontSize: 14 }}>{user.name || "No Name"}</div>
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{user.email}</div>
                        </td>
                        <td style={{ padding: "18px 24px" }}>
                          <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: user.role === "admin" ? "#c084fc" : user.role === "landlord" ? "#60a5fa" : "#9ca3af" }}>{user.role}</span>
                        </td>
                        <td style={{ padding: "18px 24px" }}>
                          <span style={{ padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: userStatus === "active" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", color: userStatus === "active" ? "#34d399" : "#f87171" }}>{userStatus}</span>
                        </td>
                        <td style={{ padding: "18px 24px", fontSize: 14, fontWeight: 500 }}>{user.properties || 0} units</td>
                        <td style={{ padding: "18px 24px", fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{user.created_at || user.registration_date || "N/A"}</td>
                        <td style={{ padding: "18px 24px", textAlign: "right" }}>
                          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                            {user.role !== "admin" && (
                              <button onClick={() => handleToggleUserStatus(user.id, userStatus)} title={userStatus === "active" ? "Suspend Account" : "Activate Account"} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", padding: 6, borderRadius: 8, color: "rgba(255,255,255,0.6)", cursor: "pointer" }}>
                                {userStatus === "active" ? <UserX size={15} color="#ef4444" /> : <UserCheck size={15} color="#10b981" />}
                              </button>
                            )}
                            <button onClick={() => handleDeleteUserClick(user.id)} title="Delete Row Profile" style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)", padding: 6, borderRadius: 8, color: "#f87171", cursor: "pointer" }}>
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: LISTINGS MODERATION MATRIX */}
          {activeTab === "listings" && (
            <div style={{ background: "#111827", borderRadius: 16, border: "1px solid rgba(255,255,255,0.04)", overflow: "hidden" }}>
              <div style={{ padding: 24, borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", gap: 16, justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
                  <Search size={16} color="rgba(255,255,255,0.3)" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
                  <input type="text" placeholder="Search by housing title or listing landlord..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: "100%", background: "#0b0f19", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 14px 10px 40px", color: "white", fontSize: 14, outline: "none" }} />
                </div>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ background: "#0b0f19", border: "1px solid rgba(255,255,255,0.08)", color: "white", padding: "10px 14px", borderRadius: 10, fontSize: 14, outline: "none", cursor: "pointer" }}>
                  <option value="all">All Application Statuses</option>
                  <option value="approved">Approved / Active</option>
                  <option value="pending">Awaiting Verification</option>
                  <option value="rejected">Rejected Entries</option>
                </select>
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.01)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <th style={{ padding: "16px 24px", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.4)" }}>Property Listing Details</th>
                    <th style={{ padding: "16px 24px", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.4)" }}>Assigned Landlord</th>
                    <th style={{ padding: "16px 24px", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.4)" }}>Rent Valuation</th>
                    <th style={{ padding: "16px 24px", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.4)" }}>Verification State</th>
                    <th style={{ padding: "16px 24px", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.4)" }}>Creation Date</th>
                    <th style={{ padding: "16px 24px", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.4)" }}>System Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredListings.map(listing => (
                    <tr key={listing.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <td style={{ padding: "18px 24px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          {listing.images?.length > 0 ? (
                            <img src={listing.images[0].image_url} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", background: "#0b0f19" }} />
                          ) : (
                            <div style={{ width: 44, height: 44, borderRadius: 8, background: "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center" }}><Home size={16} color="rgba(255,255,255,0.3)" /></div>
                          )}
                          <div>
                            <div style={{ fontWeight: 600, color: "white", fontSize: 14 }}>{listing.title}</div>
                            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{listing.town || ""}, {listing.county || ""}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "18px 24px", fontSize: 14 }}>{listing.landlord}</td>
                      <td style={{ padding: "18px 24px", fontSize: 14, fontWeight: 600, color: "white" }}>KES {listing.price?.toLocaleString()}</td>
                      <td style={{ padding: "18px 24px" }}>
                        <span style={{ padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: listing.status === "approved" || listing.status === "active" ? "rgba(16,185,129,0.1)" : listing.status === "pending" ? "rgba(245,158,11,0.1)" : "rgba(239,68,68,0.1)", color: listing.status === "approved" || listing.status === "active" ? "#34d399" : listing.status === "pending" ? "#fbbf24" : "#f87171" }}>{listing.status}</span>
                      </td>
                      <td style={{ padding: "18px 24px", fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{listing.created_at || "N/A"}</td>
                      <td style={{ padding: "18px 24px" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          {(listing.status === "pending" || listing.status === "rejected") && (
                            <button onClick={() => handleUpdateListingStatus(listing.id, "approved")} title="Approve Listing" style={{ background: "rgba(16,185,129,0.1)", border: "none", padding: 6, borderRadius: 8, color: "#34d399", cursor: "pointer" }}><CheckCircle size={15} /></button>
                          )}
                          {listing.status === "approved" && (
                            <button onClick={() => handleUpdateListingStatus(listing.id, "rejected")} title="Reject / Deactivate Listing" style={{ background: "rgba(245,158,11,0.1)", border: "none", padding: 6, borderRadius: 8, color: "#fbbf24", cursor: "pointer" }}><XCircle size={15} /></button>
                          )}
                          <button onClick={() => handleDeleteListingClick(listing.id)} title="Delete Listing Row" style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)", padding: 6, borderRadius: 8, color: "#f87171", cursor: "pointer" }}><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 4: ADVANCED STATISTICS PANEL (TOTAL ZERO-CRASH ARCHITECTURE) */}
          {activeTab === "statistics" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "28px", width: "100%" }}>
              
              {/* HIGHLIGHT PERFORMANCE ROW */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
                {(() => {
                  const safeListings = Array.isArray(listings) ? listings : [];
                  const safeUsers = Array.isArray(users) ? users : [];

                  const platformValuation = safeListings.reduce((acc, curr) => acc + (Number(curr?.price) || 0), 0);
                  const averageRent = safeListings.length > 0 ? Math.round(platformValuation / safeListings.length) : 0;
                  const systemPayloadKB = ((safeUsers.length + safeListings.length) * 0.45).toFixed(2);

                  return (
                    <>
                      <div style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.04)", borderRadius: "16px", padding: "24px", position: "relative", overflow: "hidden" }}>
                        <div style={{ width: "4px", height: "100%", background: "#a78bfa", position: "absolute", left: 0, top: 0 }} />
                        <p style={{ margin: "0 0 8px 0", fontSize: "13px", color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>Total Platform Portfolio Value</p>
                        <h3 style={{ margin: "0 0 6px 0", fontSize: "24px", fontWeight: 700, color: "white", letterSpacing: "-0.02em" }}>
                          KES {platformValuation.toLocaleString()}
                        </h3>
                        <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>
                          <span style={{ color: "#a78bfa" }}>●</span> Based on {safeListings.length} live properties
                        </p>
                      </div>

                      <div style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.04)", borderRadius: "16px", padding: "24px", position: "relative", overflow: "hidden" }}>
                        <div style={{ width: "4px", height: "100%", background: "#34d399", position: "absolute", left: 0, top: 0 }} />
                        <p style={{ margin: "0 0 8px 0", fontSize: "13px", color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>Average Platform Market Rent</p>
                        <h3 style={{ margin: "0 0 6px 0", fontSize: "24px", fontWeight: 700, color: "white", letterSpacing: "-0.02em" }}>
                          KES {averageRent.toLocaleString()}
                        </h3>
                        <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>
                          <span style={{ color: "#34d399" }}>●</span> Dynamic real-time database mean
                        </p>
                      </div>

                      <div style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.04)", borderRadius: "16px", padding: "24px", position: "relative", overflow: "hidden" }}>
                        <div style={{ width: "4px", height: "100%", background: "#fbbf24", position: "absolute", left: 0, top: 0 }} />
                        <p style={{ margin: "0 0 8px 0", fontSize: "13px", color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>Total Active State Node Count</p>
                        <h3 style={{ margin: "0 0 6px 0", fontSize: "24px", fontWeight: 700, color: "white", letterSpacing: "-0.02em" }}>
                          {safeUsers.length + safeListings.length} Active Records
                        </h3>
                        <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>
                          <span style={{ color: "#fbbf24" }}>●</span> State footprint: ~{systemPayloadKB} KB
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* SPLIT SCREEN VISUAL ANALYTICS CONTEXT */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px", alignItems: "start" }}>
                
                {/* GENUINE DATA INTEGRATED SVG LINE CHART */}
                <div style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.04)", borderRadius: "16px", padding: "24px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "white" }}>Property Value Curve</h4>
                      <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>Live vector plot based directly on prices saved in your MySQL tables</p>
                    </div>
                    <span style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", color: "#34d399", background: "rgba(16,185,129,0.1)", padding: "4px 8px", borderRadius: "6px" }}>Live SQL Reactive</span>
                  </div>

                  {/* MATH ENGINE GENERATION BLOCK FOR NATIVE SVG VECTOR PATHS */}
                  {(() => {
                    const safeListings = Array.isArray(listings) ? listings : [];
                    const pricePoints = safeListings.map(l => Number(l?.price) || 0).sort((a, b) => a - b);
                    
                    const workingPoints = pricePoints.length > 1 
                      ? pricePoints 
                      : pricePoints.length === 1 
                        ? [pricePoints[0], pricePoints[0]] 
                        : [0, 10000, 25000, 50000, 90000];
                        
                    const maxPrice = Math.max(...workingPoints, 1);
                    const totalSteps = workingPoints.length;
                    const graphWidth = 500;
                    const graphHeight = 100;

                    let pathString = "";
                    let fillString = "";

                    workingPoints.forEach((price, idx) => {
                      const x = (idx / (totalSteps - 1 || 1)) * graphWidth;
                      const y = graphHeight - ((price / maxPrice) * (graphHeight - 20) + 10);
                      
                      if (idx === 0) {
                        pathString += `M ${x} ${y}`;
                        fillString += `M 0 ${graphHeight} L ${x} ${y}`;
                      } else {
                        pathString += ` L ${x} ${y}`;
                        fillString += ` L ${x} ${y}`;
                      }

                      if (idx === totalSteps - 1) {
                        fillString += ` L ${x} ${graphHeight} Z`;
                      }
                    });

                    return (
                      <div style={{ width: "100%", height: "180px", background: "#0b0f19", borderRadius: "12px", overflow: "hidden", position: "relative" }}>
                        <svg viewBox={`0 0 ${graphWidth} ${graphHeight}`} preserveAspectRatio="none" style={{ width: "100%", height: "100%", position: "absolute", left: 0, top: 0 }}>
                          <defs>
                            <linearGradient id="liveChartGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#34d399" stopOpacity="0.2" />
                              <stop offset="100%" stopColor="#34d399" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>
                          <path d={fillString} fill="url(#liveChartGradient)" />
                          <path d={pathString} fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        
                        <div style={{ position: "absolute", top: "25%", width: "100%", borderTop: "1px dashed rgba(255,255,255,0.03)" }} />
                        <div style={{ position: "absolute", top: "50%", width: "100%", borderTop: "1px dashed rgba(255,255,255,0.03)" }} />
                        <div style={{ position: "absolute", top: "75%", width: "100%", borderTop: "1px dashed rgba(255,255,255,0.03)" }} />
                        
                        <div style={{ position: "absolute", left: "14px", top: "10px", fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>
                          Max Value: KES {maxPrice.toLocaleString()}
                        </div>
                        <div style={{ position: "absolute", right: "14px", bottom: "10px", fontSize: "10px", color: "rgba(255,255,255,0.25)" }}>
                          Real-Time Property Distribution Scale
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* RATIO METER DISPLAY */}
                <div style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.04)", borderRadius: "16px", padding: "24px" }}>
                  <h4 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: 600, color: "white" }}>Listing Proportions</h4>
                  <p style={{ margin: "0 0 20px 0", fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>Live ratio tracking verification status splits</p>
                  
                  {(() => {
                    const safeListings = Array.isArray(listings) ? listings : [];
                    const approvedCount = safeListings.filter(l => l?.status === "approved" || l?.status === "active").length;
                    const pendingCount = safeListings.filter(l => l?.status === "pending").length;
                    const totalCount = approvedCount + pendingCount || 1;
                    const approvedPct = Math.round((approvedCount / totalCount) * 100);
                    const pendingPct = 100 - approvedPct;

                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        <div style={{ height: "10px", width: "100%", background: "#0b0f19", borderRadius: "99px", display: "flex", overflow: "hidden" }}>
                          <div style={{ width: `${approvedPct}%`, background: "#10b981", transition: "width 0.4s ease" }} />
                          <div style={{ width: `${pendingPct}%`, background: "#f59e0b", transition: "width 0.4s ease" }} />
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "4px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
                              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981" }} />
                              <span style={{ color: "rgba(255,255,255,0.6)" }}>Approved Properties ({approvedCount})</span>
                            </div>
                            <span style={{ fontSize: "13px", fontWeight: 600, color: "white" }}>{approvedPct}%</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
                              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#f59e0b" }} />
                              <span style={{ color: "rgba(255,255,255,0.6)" }}>Pending Queue ({pendingCount})</span>
                            </div>
                            <span style={{ fontSize: "13px", fontWeight: 600, color: "white" }}>{pendingPct}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

              </div>

              {/* ACCOUNT ROLES MATRIX SYSTEM BOX */}
              <div style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.04)", borderRadius: "16px", padding: "24px" }}>
                <h4 style={{ margin: "0 0 16px 0", fontSize: "15px", fontWeight: 600, color: "white" }}>User Base Segmentation Parameters</h4>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
                  {(() => {
                    const safeUsers = Array.isArray(users) ? users : [];
                    const totalUsersCount = safeUsers.length || 1;
                    const landlordsCount = safeUsers.filter(u => u?.role === "landlord").length;
                    const clientsCount = safeUsers.filter(u => u?.role === "tenant" || u?.role === "client" || !u?.role).length;
                    const suspendedCount = safeUsers.filter(u => u?.status === "suspended" || u?.account_status === "suspended").length;

                    return (
                      <>
                        <div style={{ background: "#0b0f19", border: "1px solid rgba(255,255,255,0.02)", padding: "16px", borderRadius: "12px" }}>
                          <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", fontWeight: 500, display: "block", marginBottom: "6px" }}>Registered Landlords</span>
                          <div style={{ fontSize: "18px", fontWeight: 700, color: "white" }}>{landlordsCount} Accounts</div>
                          <div style={{ fontSize: "11px", marginTop: "4px", color: "#a78bfa" }}>
                            {((landlordsCount / totalUsersCount) * 100).toFixed(0)}% of platform share
                          </div>
                        </div>

                        <div style={{ background: "#0b0f19", border: "1px solid rgba(255,255,255,0.02)", padding: "16px", borderRadius: "12px" }}>
                          <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", fontWeight: 500, display: "block", marginBottom: "6px" }}>Registered Tenants/Clients</span>
                          <div style={{ fontSize: "18px", fontWeight: 700, color: "white" }}>{clientsCount} Accounts</div>
                          <div style={{ fontSize: "11px", marginTop: "4px", color: "#60a5fa" }}>
                            {((clientsCount / totalUsersCount) * 100).toFixed(0)}% ecosystem density
                          </div>
                        </div>

                        <div style={{ background: "#0b0f19", border: "1px solid rgba(255,255,255,0.02)", padding: "16px", borderRadius: "12px" }}>
                          <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", fontWeight: 500, display: "block", marginBottom: "6px" }}>Security Restrictions</span>
                          <div style={{ fontSize: "18px", fontWeight: 700, color: suspendedCount > 0 ? "#f87171" : "white" }}>{suspendedCount} Suspensions</div>
                          <div style={{ fontSize: "11px", marginTop: "4px", color: suspendedCount > 0 ? "#f87171" : "#34d399" }}>
                            {suspendedCount > 0 ? "Active threat locks in effect" : "System fully clear"}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
}