import { useState, FormEvent } from 'react';
import { typography } from '../../utils/typography';

export interface AdminLoginProps {
  onLogin: (email: string, password: string) => void;
  isLoading: boolean;
  error: string | null;
}

function AdminLogin({ onLogin, isLoading, error }: AdminLoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onLogin(email, password);
  };

  return (
    <div className="min-h-screen bg-altivum-dark flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-white mb-2" style={typography.sectionHeader}>
            Admin
          </h1>
          <p className="text-altivum-silver" style={typography.bodyText}>
            Knowledge Base Management
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div>
            <label
              htmlFor="admin-email"
              className="block text-xs font-medium text-altivum-gold mb-3 uppercase tracking-widest"
            >
              Email
            </label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-0 py-4 bg-transparent border-b-2 border-white/10 text-white placeholder-white/70 focus:outline-none focus:border-altivum-gold transition-all duration-300 rounded-none"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label
              htmlFor="admin-password"
              className="block text-xs font-medium text-altivum-gold mb-3 uppercase tracking-widest"
            >
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-0 py-4 bg-transparent border-b-2 border-white/10 text-white placeholder-white/70 focus:outline-none focus:border-altivum-gold transition-all duration-300 rounded-none"
              placeholder="Enter password"
            />
          </div>

          {error && (
            <div
              className="p-4 bg-red-900/30 border-l-4 border-red-500 text-red-300 text-sm"
              role="alert"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-4 font-medium uppercase tracking-wider text-sm transition-all duration-300 ${
              isLoading
                ? 'bg-altivum-slate/50 text-altivum-silver cursor-not-allowed'
                : 'bg-altivum-gold text-altivum-dark hover:bg-white'
            }`}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AdminLogin;
