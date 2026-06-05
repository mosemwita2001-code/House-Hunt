import { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Home, User, LogOut, PlusSquare, Shield } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 px-6 py-4">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <Link to="/" className="flex items-center gap-2 text-brand font-bold text-2xl tracking-tight">
          <Home className="h-7 w-7 text-brand" />
          <span>KejaHunt</span>
        </Link>

        <div className="flex items-center gap-6">
          <Link to="/" className="text-slate-600 hover:text-slate-900 font-medium">Browse</Link>
          
          {user ? (
            <>
              {user.role === 'landlord' && (
                <Link to="/landlord" className="flex items-center gap-1 text-slate-600 hover:text-slate-900 font-medium">
                  <PlusSquare className="h-4 w-4" /> Dashboard
                </Link>
              )}
              {user.role === 'admin' && (
                <Link to="/admin" className="flex items-center gap-1 text-slate-600 hover:text-slate-900 font-medium">
                  <Shield className="h-4 w-4" /> Admin
                </Link>
              )}
              <Link to="/favorites" className="text-slate-600 hover:text-slate-900 font-medium">Favorites</Link>
              <button onClick={() => { logout(); navigate('/'); }} className="flex items-center gap-1 text-red-500 hover:text-red-600 font-medium">
                <LogOut className="h-4 w-4" /> Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-slate-600 hover:text-slate-900 font-medium">Login</Link>
              <Link to="/register" className="bg-brand text-white px-4 py-2 rounded-xl font-medium hover:bg-brand-dark transition">Sign Up</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}