import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white px-4 py-8 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <p>© 2026 Keja Hunt</p>
        <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Legal navigation">
          <Link to="/terms" className="hover:text-brand transition">Terms and Conditions</Link>
          <Link to="/privacy-policy" className="hover:text-brand transition">Privacy Policy</Link>
        </nav>
      </div>
    </footer>
  );
}
