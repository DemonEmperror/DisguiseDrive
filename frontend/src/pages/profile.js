import { useState, useEffect } from 'react';
import { useSupabaseAuth } from '../lib/supabaseAuth';
import Layout from '../components/Layout';
import { UserCircleIcon, CameraIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function Profile() {
  const { user, supabase } = useSupabaseAuth();
  const [loading, setLoading] = useState(false);
  const [profileImage, setProfileImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [storageUsage, setStorageUsage] = useState({ used: 0, total: 1073741824 }); // 1GB in bytes
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      
      // Get user profile data
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading profile:', error);
      } else if (profile?.avatar_url) {
        setProfileImage(profile.avatar_url);
      }

      // Get storage usage
      await loadStorageUsage();
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStorageUsage = async () => {
    try {
      // Get all buckets and calculate usage
      const { data: buckets } = await supabase.storage.listBuckets();
      let totalUsed = 0;

      for (const bucket of buckets || []) {
        const { data: files } = await supabase.storage
          .from(bucket.name)
          .list('', { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
        
        if (files) {
          totalUsed += files.reduce((sum, file) => sum + (file.metadata?.size || 0), 0);
        }
      }

      setStorageUsage(prev => ({ ...prev, used: totalUsed }));
    } catch (error) {
      console.error('Error loading storage usage:', error);
    }
  };

  const handleImageUpload = async (event) => {
    try {
      setUploading(true);
      
      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('You must select an image to upload.');
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Create avatars bucket if it doesn't exist
      const { data: buckets } = await supabase.storage.listBuckets();
      const avatarsBucket = buckets?.find(bucket => bucket.name === 'avatars');
      
      if (!avatarsBucket) {
        const { error: bucketError } = await supabase.storage.createBucket('avatars', {
          public: true,
          allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
        });
        if (bucketError) {
          console.error('Error creating avatars bucket:', bucketError);
        }
      }

      // Upload image to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          avatar_url: data.publicUrl,
          updated_at: new Date().toISOString(),
        });

      if (updateError) {
        throw updateError;
      }

      setProfileImage(data.publicUrl);
      toast.success('Profile image updated successfully!');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Error uploading image: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (passwords.new !== passwords.confirm) {
      toast.error('New passwords do not match');
      return;
    }

    if (passwords.new.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    try {
      setLoading(true);
      
      const { error } = await supabase.auth.updateUser({
        password: passwords.new
      });

      if (error) {
        throw error;
      }

      toast.success('Password updated successfully!');
      setShowChangePassword(false);
      setPasswords({ current: '', new: '', confirm: '' });
    } catch (error) {
      console.error('Error updating password:', error);
      toast.error('Error updating password: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = (field) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  if (!user) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
            <p className="text-gray-600">Please log in to view your profile.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
            <p className="text-sm text-gray-600 mt-1">Manage your account information and security settings</p>
          </div>

          {/* Profile Image Section */}
          <div className="px-6 py-6 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Profile Picture</h2>
            <div className="flex items-center space-x-6">
              <div className="relative">
                {profileImage ? (
                  <img
                    src={profileImage}
                    alt="Profile"
                    className="w-24 h-24 rounded-full object-cover border-4 border-gray-200"
                  />
                ) : (
                  <UserCircleIcon className="w-24 h-24 text-gray-300" />
                )}
                <label className="absolute bottom-0 right-0 bg-blue-600 rounded-full p-2 cursor-pointer hover:bg-blue-700 transition-colors">
                  <CameraIcon className="w-4 h-4 text-white" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-900">Change Profile Picture</h3>
                <p className="text-sm text-gray-500">Upload a new profile picture. JPG, PNG or GIF (max 5MB)</p>
                {uploading && (
                  <p className="text-sm text-blue-600 mt-1">Uploading...</p>
                )}
              </div>
            </div>
          </div>

          {/* Account Information */}
          <div className="px-6 py-6 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Account Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                <input
                  type="email"
                  value={user.email || ''}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">User ID</label>
                <input
                  type="text"
                  value={user.id || ''}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Account Created</label>
                <input
                  type="text"
                  value={user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Last Sign In</label>
                <input
                  type="text"
                  value={user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : 'N/A'}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                />
              </div>
            </div>
          </div>

          {/* Storage Usage Section */}
          <div className="px-6 py-6 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Storage Usage</h2>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Used Storage</span>
                  <span>{(storageUsage.used / 1024 / 1024).toFixed(2)} MB / {(storageUsage.total / 1024 / 1024 / 1024).toFixed(1)} GB</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${Math.min((storageUsage.used / storageUsage.total) * 100, 100)}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {((1 - storageUsage.used / storageUsage.total) * 100).toFixed(1)}% available
                </p>
              </div>
              <button
                onClick={loadStorageUsage}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Refresh Usage
              </button>
            </div>
          </div>

          {/* Security Section */}
          <div className="px-6 py-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Security</h2>
            
            {!showChangePassword ? (
              <button
                onClick={() => setShowChangePassword(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                Change Password
              </button>
            ) : (
              <div className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
                  <div className="relative">
                    <input
                      type={showPasswords.current ? "text" : "password"}
                      value={passwords.current}
                      onChange={(e) => setPasswords(prev => ({ ...prev, current: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md pr-10"
                      placeholder="Enter current password"
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility('current')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      {showPasswords.current ? (
                        <EyeSlashIcon className="h-5 w-5" />
                      ) : (
                        <EyeIcon className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                  <div className="relative">
                    <input
                      type={showPasswords.new ? "text" : "password"}
                      value={passwords.new}
                      onChange={(e) => setPasswords(prev => ({ ...prev, new: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md pr-10"
                      placeholder="Enter new password"
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility('new')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      {showPasswords.new ? (
                        <EyeSlashIcon className="h-5 w-5" />
                      ) : (
                        <EyeIcon className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
                  <div className="relative">
                    <input
                      type={showPasswords.confirm ? "text" : "password"}
                      value={passwords.confirm}
                      onChange={(e) => setPasswords(prev => ({ ...prev, confirm: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md pr-10"
                      placeholder="Confirm new password"
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility('confirm')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      {showPasswords.confirm ? (
                        <EyeSlashIcon className="h-5 w-5" />
                      ) : (
                        <EyeIcon className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={handlePasswordChange}
                    disabled={loading || !passwords.current || !passwords.new || !passwords.confirm}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? 'Updating...' : 'Update Password'}
                  </button>
                  <button
                    onClick={() => {
                      setShowChangePassword(false);
                      setPasswords({ current: '', new: '', confirm: '' });
                    }}
                    className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
