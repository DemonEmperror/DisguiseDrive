import { useState, useEffect } from 'react';
import { useSupabaseAuth } from '../lib/supabaseAuth';
import Layout from '../components/Layout';
import ImageViewer from '../components/ImageViewer';
import UploadModal from '../components/UploadModal';
import { foldersAPI, filesAPI } from '../lib/api';
import { 
  FolderIcon, 
  FolderOpenIcon,
  LockClosedIcon,
  PlusIcon,
  PhotoIcon,
  TrashIcon,
  CloudArrowUpIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function Folders() {
  const { user, isAuthenticated, loading } = useSupabaseAuth();
  
  // Show loading screen while authentication is being determined
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [folderFiles, setFolderFiles] = useState([]);
  const [folderToken, setFolderToken] = useState(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [folderPassword, setFolderPassword] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderPassword, setNewFolderPassword] = useState('');
  const [isProtectedFolder, setIsProtectedFolder] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showFolderPassword, setShowFolderPassword] = useState(false);
  const [showNewFolderPassword, setShowNewFolderPassword] = useState(false);

  useEffect(() => {
    console.log('Folders page auth state:', { loading, isAuthenticated, user: !!user });
    // Wait longer before redirecting and be more specific about conditions
    if (!loading) {
      if (!isAuthenticated || !user) {
        console.log('User not authenticated, redirecting in 2 seconds...');
        const timer = setTimeout(() => {
          console.log('Executing redirect to home');
          window.location.href = '/';
        }, 2000); // Longer delay
        
        return () => clearTimeout(timer);
      } else {
        console.log('User is authenticated, staying on folders page');
      }
    }
  }, [isAuthenticated, loading, user]);

  useEffect(() => {
    if (isAuthenticated && user) {
      console.log('Loading folders for authenticated user');
      loadFolders();
    }
  }, [isAuthenticated, user]);

  const loadFolders = async () => {
    try {
      const response = await foldersAPI.list();
      setFolders(response.data.folders);
    } catch (error) {
      console.error('Failed to load folders:', error);
      toast.error('Failed to load folders');
    } finally {
      setIsLoading(false);
    }
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error('Please enter a folder name');
      return;
    }

    if (isProtectedFolder && !newFolderPassword.trim()) {
      toast.error('Please enter a password for the protected folder');
      return;
    }

    try {
      const folderData = {
        name: newFolderName.trim(),
        isProtected: isProtectedFolder,
        password: isProtectedFolder ? newFolderPassword : undefined
      };
      
      await foldersAPI.create(folderData);
      toast.success('Folder created successfully');
      setNewFolderName('');
      setNewFolderPassword('');
      setIsProtectedFolder(false);
      setShowCreateFolder(false);
      loadFolders();
    } catch (error) {
      console.error('Failed to create folder:', error);
      toast.error(error.response?.data?.error || 'Failed to create folder');
    }
  };

  const openFolder = async (folder) => {
    if (folder.isProtected && !folderToken) {
      setSelectedFolder(folder);
      setShowPasswordPrompt(true);
      return;
    }

    try {
      const response = await foldersAPI.get(folder.id, folderToken);
      setSelectedFolder(folder);
      setFolderFiles(response.data.folder.files);
      
      // Use cover path from backend response
      const filesWithCovers = response.data.folder.files.map(file => ({
        ...file,
        coverUrl: file.coverPath // Use the Unsplash URL from backend
      }));
      setFolderFiles(filesWithCovers);
      
    } catch (error) {
      console.error('Failed to open folder:', error);
      if (error.response?.data?.requiresFolderPassword) {
        setSelectedFolder(folder);
        setShowPasswordPrompt(true);
      } else {
        toast.error('Failed to open folder');
      }
    }
  };

  const unlockFolder = async () => {
    if (!folderPassword.trim()) {
      toast.error('Please enter the folder password');
      return;
    }

    try {
      const response = await foldersAPI.unlock(selectedFolder.id, folderPassword);
      setFolderToken(response.data.accessToken);
      setFolderPassword('');
      setShowPasswordPrompt(false);
      
      // Now open the folder
      openFolder(selectedFolder);
      toast.success('Folder unlocked successfully');
      
    } catch (error) {
      console.error('Failed to unlock folder:', error);
      toast.error('Invalid folder password');
    }
  };

  const deleteFolder = async (folderId) => {
    if (!confirm('Are you sure you want to delete this folder and all its files?')) {
      return;
    }

    try {
      await foldersAPI.delete(folderId);
      toast.success('Folder deleted successfully');
      loadFolders();
      
      // Close folder if it was open
      if (selectedFolder?.id === folderId) {
        setSelectedFolder(null);
        setFolderFiles([]);
        setFolderToken(null);
      }
    } catch (error) {
      console.error('Failed to delete folder:', error);
      toast.error('Failed to delete folder');
    }
  };

  const openImageViewer = (file) => {
    setSelectedFile(file);
    setShowImageViewer(true);
  };

  const handleImageDelete = (fileId) => {
    // Remove deleted file from the current folder view
    setFolderFiles(prev => prev.filter(file => file.id !== fileId));
  };

  const handleUploadComplete = () => {
    if (selectedFolder) {
      openFolder(selectedFolder);
    }
  };

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
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {selectedFolder ? selectedFolder.name : 'Folders'}
              </h1>
              <p className="text-gray-600 mt-2">
                {selectedFolder 
                  ? `${folderFiles.length} images in this folder`
                  : 'Organize your secure images in folders'
                }
              </p>
            </div>
            
            <div className="flex space-x-3">
              {selectedFolder ? (
                <>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="btn-primary"
                  >
                    <CloudArrowUpIcon className="h-5 w-5 mr-2" />
                    Upload Images
                  </button>
                  <button
                    onClick={() => {
                      setSelectedFolder(null);
                      setFolderFiles([]);
                      setFolderToken(null);
                    }}
                    className="btn-secondary"
                  >
                    Back to Folders
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowCreateFolder(true)}
                  className="btn-primary"
                >
                  <PlusIcon className="h-5 w-5 mr-2" />
                  Create Folder
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="loading-spinner" />
            </div>
          ) : selectedFolder ? (
            /* Folder Contents */
            <div>
              {folderFiles.length === 0 ? (
                <div className="text-center py-12">
                  <PhotoIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No images yet</h3>
                  <p className="text-gray-600 mb-4">Upload your first image to get started</p>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="btn-primary"
                  >
                    <CloudArrowUpIcon className="h-5 w-5 mr-2" />
                    Upload Images
                  </button>
                </div>
              ) : (
                <div className="grid-gallery">
                  {folderFiles.map((file) => (
                    <div 
                      key={file.id} 
                      className="relative group cursor-pointer"
                      onClick={() => openImageViewer(file)}
                    >
                      <img
                        src={file.coverPath}
                        alt={file.originalName}
                        className="w-full h-48 object-cover rounded-lg shadow-md"
                        onError={(e) => {
                          e.target.src = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop';
                        }}
                      />
                      <div className="absolute inset-0 rounded-lg flex items-end">
                        <div className="w-full h-16 cursor-pointer">
                        </div>
                      </div>
                      <div className="absolute bottom-2 left-2 right-2">
                        <p className="text-xs text-white bg-black bg-opacity-70 rounded px-2 py-1 truncate">
                          {file.originalName}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Folders List */
            <div>
              {folders.length === 0 ? (
                <div className="text-center py-12">
                  <FolderIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No folders yet</h3>
                  <p className="text-gray-600 mb-4">Create your first folder to organize your images</p>
                  <button
                    onClick={() => setShowCreateFolder(true)}
                    className="btn-primary"
                  >
                    <PlusIcon className="h-5 w-5 mr-2" />
                    Create Folder
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {folders.map((folder) => (
                    <div key={folder.id} className="folder-card group">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          {folder.isProtected ? (
                            <LockClosedIcon className="h-6 w-6 text-amber-500 mr-2" />
                          ) : (
                            <FolderOpenIcon className="h-6 w-6 text-primary-500 mr-2" />
                          )}
                          <h3 className="font-medium text-gray-900 truncate">{folder.name}</h3>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteFolder(folder.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 transition-all duration-200"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-3">
                        {folder.fileCount} image{folder.fileCount !== 1 ? 's' : ''}
                      </p>
                      
                      <button
                        onClick={() => openFolder(folder)}
                        className="w-full btn-secondary text-sm"
                      >
                        Open Folder
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create Folder Modal */}
      {showCreateFolder && (
        <div className="modal-overlay">
          <div className="modal-content max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Folder</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Folder Name
                  </label>
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Enter folder name"
                    className="input-field"
                    autoFocus
                    onKeyPress={(e) => e.key === 'Enter' && !isProtectedFolder && createFolder()}
                  />
                </div>

                <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={isProtectedFolder}
                      onChange={(e) => setIsProtectedFolder(e.target.checked)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Password protect this folder
                    </span>
                  </label>
                </div>

                {isProtectedFolder && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Folder Password
                    </label>
                    <div className="relative">
                      <input
                        type={showNewFolderPassword ? "text" : "password"}
                        value={newFolderPassword}
                        onChange={(e) => setNewFolderPassword(e.target.value)}
                        placeholder="Enter folder password"
                        className="input-field pr-10"
                        onKeyPress={(e) => e.key === 'Enter' && createFolder()}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewFolderPassword(!showNewFolderPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                      >
                        {showNewFolderPassword ? (
                          <EyeSlashIcon className="h-5 w-5" />
                        ) : (
                          <EyeIcon className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>
                )}
                
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      setShowCreateFolder(false);
                      setNewFolderName('');
                      setNewFolderPassword('');
                      setIsProtectedFolder(false);
                    }}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createFolder}
                    className="btn-primary flex-1"
                    disabled={!newFolderName.trim()}
                  >
                    Create
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Folder Password Prompt */}
      {showPasswordPrompt && (
        <div className="modal-overlay">
          <div className="modal-content max-w-md">
            <div className="p-6">
              <div className="text-center mb-4">
                <LockClosedIcon className="h-12 w-12 text-amber-500 mx-auto mb-2" />
                <div className="text-center py-12">
                  <p className="text-gray-500 mb-4">
                    Tap any image to unlock and view the original
                  </p>
                  <p className="text-sm text-gray-400">
                    Images are encrypted and secure
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <input
                    type={showFolderPassword ? "text" : "password"}
                    value={folderPassword}
                    onChange={(e) => setFolderPassword(e.target.value)}
                    placeholder="Enter folder password"
                    className="input-field pr-10"
                    autoFocus
                    onKeyPress={(e) => e.key === 'Enter' && unlockFolder()}
                  />
                  <button
                    type="button"
                    onClick={() => setShowFolderPassword(!showFolderPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    {showFolderPassword ? (
                      <EyeSlashIcon className="h-5 w-5" />
                    ) : (
                      <EyeIcon className="h-5 w-5" />
                    )}
                  </button>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      setShowPasswordPrompt(false);
                      setFolderPassword('');
                      setSelectedFolder(null);
                    }}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={unlockFolder}
                    className="btn-primary flex-1"
                    disabled={!folderPassword.trim()}
                  >
                    Unlock
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        folderId={selectedFolder?.id}
        folderToken={folderToken}
        onUploadComplete={handleUploadComplete}
      />

      {/* Image Viewer */}
      <ImageViewer
        file={selectedFile}
        isOpen={showImageViewer}
        onClose={() => setShowImageViewer(false)}
        folderToken={folderToken}
        user={user}
        onDelete={handleImageDelete}
      />
    </Layout>
  );
}
