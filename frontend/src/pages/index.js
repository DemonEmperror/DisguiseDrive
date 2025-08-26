import { useEffect } from 'react';
import { useSupabaseAuth } from '../lib/supabaseAuth';
import Layout from '../components/Layout';
import StorageMonitor from '../components/StorageMonitor';

export default function Home() {
  const { isAuthenticated, loading } = useSupabaseAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = '/login';
    }
  }, [isAuthenticated, loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Layout>
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Photo Gallery</h1>
            <p className="text-gray-600 mt-2">Your personal nature photography collection</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Albums Section */}
            <div className="card">
              <div className="flex items-center">
                <div className="p-3 bg-primary-100 rounded-lg">
                  <svg className="h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m8 5 4-4 4 4" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-900">Albums</h3>
                  <p className="text-gray-600">Browse your collections</p>
                </div>
              </div>
              <div className="mt-4">
                <a href="/folders" className="btn-primary w-full text-center">
                  View Albums
                </a>
              </div>
            </div>

            {/* Photography Stats */}
            <div className="card">
              <div className="flex items-center">
                <div className="p-3 bg-green-100 rounded-lg">
                  <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-900">Photography</h3>
                  <p className="text-gray-600">Nature & landscapes</p>
                </div>
              </div>
              <div className="mt-4 text-sm text-gray-600">
                <ul className="space-y-1">
                  <li>• High-quality images</li>
                  <li>• Organized collections</li>
                  <li>• Easy browsing</li>
                </ul>
              </div>
            </div>

            {/* Storage Monitor */}
            <StorageMonitor />
          </div>

          {/* Getting Started */}
          <div className="mt-8">
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Start</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">1. Create Albums</h3>
                  <p className="text-gray-600 text-sm mb-3">
                    Organize your nature photography into themed albums for easy browsing.
                  </p>
                  <a href="/folders" className="btn-primary inline-block">
                    Create Album
                  </a>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">2. Upload Photos</h3>
                  <p className="text-gray-600 text-sm mb-3">
                    Add your beautiful nature photographs to share and preserve your memories.
                  </p>
                  <p className="text-xs text-gray-500">
                    Supports high-resolution images
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
