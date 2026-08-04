import { useContext, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Home, LogOut, Menu, PlusSquare, Shield, X } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => setMobileOpen(false), [location.pathname, location.search]);

  const signOut = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 px-4 py-4 sm:px-6" aria-label="Primary navigation">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <Link to="/" className="flex items-center gap-2 text-brand font-bold text-2xl tracking-tight">
          <Home className="h-7 w-7 text-brand" aria-hidden="true" />
          <span>KejaHunt</span>
        </Link>

        <button
          type="button"
          className="sm:hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100"
          aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={mobileOpen}
          aria-controls="primary-navigation-links"
          onClick={() => setMobileOpen(open => !open)}
        >
          {mobileOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>

        <div id="primary-navigation-links" className={`${mobileOpen ? 'flex' : 'hidden'} sm:flex absolute sm:static top-full left-0 right-0 bg-white border-b sm:border-0 border-slate-200 p-4 sm:p-0 flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-6`}>
          <Link to="/" className="text-slate-600 hover:text-slate-900 font-medium py-2 sm:py-0">Browse</Link>
          {user ? (
            <>
              {(user.role === 'landlord' || user.role === 'admin') && (
                <Link to="/landlord?page=add" className="flex items-center gap-1 text-slate-600 hover:text-slate-900 font-medium py-2 sm:py-0">
                  <PlusSquare className="h-4 w-4" aria-hidden="true" /> List Property
                </Link>
              )}
              {user.role === 'admin' && (
                <Link to="/admin" className="flex items-center gap-1 text-slate-600 hover:text-slate-900 font-medium py-2 sm:py-0">
                  <Shield className="h-4 w-4" aria-hidden="true" /> Admin
                </Link>
              )}
              <Link to="/favorites" className="text-slate-600 hover:text-slate-900 font-medium py-2 sm:py-0">Favorites</Link>
              <button type="button" onClick={signOut} className="flex items-center gap-1 text-red-500 hover:text-red-600 font-medium py-2 sm:py-0 text-left">
                <LogOut className="h-4 w-4" aria-hidden="true" /> Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-slate-600 hover:text-slate-900 font-medium py-2 sm:py-0">Login</Link>
              <Link to="/register" className="bg-brand text-white px-4 py-2 rounded-xl font-medium hover:bg-brand-dark transition text-center">Sign Up</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
