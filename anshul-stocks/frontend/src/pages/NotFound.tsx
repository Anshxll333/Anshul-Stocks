
import { Link } from 'react-router-dom';
import { ShieldAlert, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex-1 flex flex-col justify-center items-center py-20 px-4 text-center">
      <ShieldAlert size={64} className="text-red-500 mb-6" />
      <h1 className="text-4xl font-extrabold mb-4">404 - Page Not Found</h1>
      <p className="text-gray-300 max-w-md mb-8">
        The research page you are trying to access doesn't exist. Please check the address or return to the dashboard.
      </p>
      <Link to="/" className="btn-primary flex items-center gap-2">
        <Home size={18} />
        Back to Home
      </Link>
    </div>
  );
}
