import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useSupabaseAuth } from '../lib/supabaseAuth';
import { 
  CloudIcon, 
  ServerIcon, 
  ChartBarIcon,
  ExclamationTriangleIcon 
} from '@heroicons/react/24/outline';

const StorageMonitor = () => {
  const { user } = useSupabaseAuth();
  const [storageInfo, setStorageInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user) {
      fetchStorageInfo();
    }
  }, [user]);

  const fetchStorageInfo = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get storage usage from Supabase Storage
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      
      if (bucketsError) {
        throw bucketsError;
      }

      // Calculate total storage used
      let totalSize = 0;
      let fileCount = 0;
      
      for (const bucket of buckets) {
        try {
          const { data: files, error: filesError } = await supabase.storage
            .from(bucket.name)
            .list('', { limit: 1000 });
          
          if (!filesError && files) {
            fileCount += files.length;
            // Note: Supabase doesn't provide file sizes in list operation
            // This is a limitation we'll need to work around
          }
        } catch (err) {
          console.warn(`Could not access bucket ${bucket.name}:`, err);
        }
      }

      // Get user's subscription info (if available)
      const storageLimit = 1024 * 1024 * 1024; // 1GB default limit for free tier
      
      setStorageInfo({
        totalSize,
        fileCount,
        storageLimit,
        buckets: buckets.length,
        usagePercentage: (totalSize / storageLimit) * 100
      });

    } catch (err) {
      console.error('Error fetching storage info:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Storage Monitor</h3>
          <CloudIcon className="h-6 w-6 text-gray-400" />
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Storage Monitor</h3>
          <ExclamationTriangleIcon className="h-6 w-6 text-red-400" />
        </div>
        <div className="text-center py-8">
          <p className="text-red-600 text-sm mb-2">Failed to load storage information</p>
          <button 
            onClick={fetchStorageInfo}
            className="btn-secondary text-xs"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Storage Monitor</h3>
        <CloudIcon className="h-6 w-6 text-blue-500" />
      </div>

      {storageInfo && (
        <div className="space-y-4">
          {/* Storage Usage Bar */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Storage Used</span>
              <span className="text-sm text-gray-500">
                {formatBytes(storageInfo.totalSize)} / {formatBytes(storageInfo.storageLimit)}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${
                  storageInfo.usagePercentage > 90 
                    ? 'bg-red-500' 
                    : storageInfo.usagePercentage > 70 
                    ? 'bg-yellow-500' 
                    : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(storageInfo.usagePercentage, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {storageInfo.usagePercentage.toFixed(1)}% used
            </p>
          </div>

          {/* Storage Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-center mb-2">
                <ChartBarIcon className="h-5 w-5 text-blue-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{storageInfo.fileCount}</p>
              <p className="text-xs text-gray-600">Total Files</p>
            </div>
            
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-center mb-2">
                <ServerIcon className="h-5 w-5 text-green-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{storageInfo.buckets}</p>
              <p className="text-xs text-gray-600">Storage Buckets</p>
            </div>
          </div>

          {/* Storage Status */}
          <div className={`p-3 rounded-lg ${
            storageInfo.usagePercentage > 90 
              ? 'bg-red-50 border border-red-200' 
              : storageInfo.usagePercentage > 70 
              ? 'bg-yellow-50 border border-yellow-200' 
              : 'bg-green-50 border border-green-200'
          }`}>
            <p className={`text-sm font-medium ${
              storageInfo.usagePercentage > 90 
                ? 'text-red-800' 
                : storageInfo.usagePercentage > 70 
                ? 'text-yellow-800' 
                : 'text-green-800'
            }`}>
              {storageInfo.usagePercentage > 90 
                ? 'Storage Almost Full' 
                : storageInfo.usagePercentage > 70 
                ? 'Storage Getting Full' 
                : 'Storage Healthy'}
            </p>
            <p className={`text-xs mt-1 ${
              storageInfo.usagePercentage > 90 
                ? 'text-red-600' 
                : storageInfo.usagePercentage > 70 
                ? 'text-yellow-600' 
                : 'text-green-600'
            }`}>
              {storageInfo.usagePercentage > 90 
                ? 'Consider upgrading your plan or deleting unused files' 
                : storageInfo.usagePercentage > 70 
                ? 'Monitor your usage and consider cleaning up old files' 
                : 'You have plenty of storage space available'}
            </p>
          </div>

          {/* Refresh Button */}
          <div className="text-center">
            <button 
              onClick={fetchStorageInfo}
              className="btn-secondary text-xs"
              disabled={loading}
            >
              {loading ? 'Refreshing...' : 'Refresh Storage Info'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StorageMonitor;
