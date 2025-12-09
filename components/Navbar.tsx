'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export const Navbar: React.FC = () => {
  const { user, signOut } = useAuth();
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  if (!user) return null;

  return (
    <nav className="bg-white shadow-md border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-1">
            <Link
              href="/dashboard"
              className={`inline-flex items-center px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                isActive('/dashboard')
                  ? 'text-blue-700 bg-blue-50'
                  : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Dashboard
            </Link>
            <Link
              href="/projects"
              className={`inline-flex items-center px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                isActive('/projects') || pathname?.startsWith('/projects/')
                  ? 'text-blue-700 bg-blue-50'
                  : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Projects
            </Link>
            {user.role === 'admin' && (
              <Link
                href="/settings"
                className={`inline-flex items-center px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                  isActive('/settings')
                    ? 'text-blue-700 bg-blue-50'
                    : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Settings
              </Link>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">{user.email}</span>
            {user.role === 'admin' && (
              <span className="px-2.5 py-1 text-xs font-semibold bg-purple-100 text-purple-700 rounded-md border border-purple-200">
                Admin
              </span>
            )}
            <button
              onClick={signOut}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

