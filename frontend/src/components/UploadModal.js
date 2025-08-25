import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { XMarkIcon, PhotoIcon, LockClosedIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { filesAPI } from '../lib/api';
import toast from 'react-hot-toast';

const UploadModal = ({ isOpen, onClose, folderId, folderToken, onUploadComplete }) => {
  const [files, setFiles] = useState([]);
  const [passwords, setPasswords] = useState({});
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [showPasswords, setShowPasswords] = useState({});
  const [uploadMode, setUploadMode] = useState('secure'); // 'secure' or 'normal'

  const onDrop = useCallback((acceptedFiles) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      preview: URL.createObjectURL(file)
    }));
    
    setFiles(prev => [...prev, ...newFiles]);
    
    // Initialize passwords for new files
    const newPasswords = {};
    newFiles.forEach(({ id }) => {
      newPasswords[id] = '';
    });
    setPasswords(prev => ({ ...prev, ...newPasswords }));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.gif', '.bmp', '.tiff']
    },
    maxSize: 50 * 1024 * 1024, // 50MB
    multiple: true
  });

  const removeFile = (fileId) => {
    setFiles(prev => {
      const fileToRemove = prev.find(f => f.id === fileId);
      if (fileToRemove) {
        URL.revokeObjectURL(fileToRemove.preview);
      }
      return prev.filter(f => f.id !== fileId);
    });
    
    setPasswords(prev => {
      const newPasswords = { ...prev };
      delete newPasswords[fileId];
      return newPasswords;
    });
  };

  const updatePassword = (fileId, password) => {
    setPasswords(prev => ({
      ...prev,
      [fileId]: password
    }));
  };

  const validatePasswords = () => {
    if (uploadMode === 'normal') return true;
    
    for (const fileData of files) {
      const password = passwords[fileData.id];
      if (!password || password.length < 4) {
        toast.error(`Password for ${fileData.file.name} must be at least 4 characters`);
        return false;
      }
    }
    return true;
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error('Please select at least one file');
      return;
    }

    if (!validatePasswords()) {
      return;
    }

    setUploading(true);
    
    try {
      // Prepare form data
      const formData = new FormData();
      
      // Add files
      files.forEach(({ file }) => {
        formData.append('files', file);
      });
      
      // Add passwords array (only for secure mode)
      if (uploadMode === 'secure') {
        const passwordArray = files.map(({ id }) => passwords[id]);
        formData.append('passwords', JSON.stringify(passwordArray));
      }
      
      // Add upload mode
      formData.append('uploadMode', uploadMode);

      // Upload files
      const response = await filesAPI.upload(folderId, formData, folderToken);
      
      toast.success(`${response.data.files.length} files uploaded successfully`);
      
      // Show any errors
      if (response.data.errors && response.data.errors.length > 0) {
        response.data.errors.forEach(error => {
          toast.error(`${error.filename}: ${error.error}`);
        });
      }
      
      // Clean up and close
      files.forEach(({ preview }) => URL.revokeObjectURL(preview));
      setFiles([]);
      setPasswords({});
      onUploadComplete();
      onClose();
      
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error(error.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (uploading) return;
    
    // Clean up object URLs
    files.forEach(({ preview }) => URL.revokeObjectURL(preview));
    setFiles([]);
    setPasswords({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Upload Images</h3>
          <button
            onClick={handleClose}
            disabled={uploading}
            className="p-2 rounded-md text-gray-400 hover:text-gray-500 disabled:opacity-50"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Upload Mode Selector */}
        <div className="px-6 pt-4">
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setUploadMode('normal')}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                uploadMode === 'normal'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Normal Upload
            </button>
            <button
              onClick={() => setUploadMode('secure')}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                uploadMode === 'secure'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Secure Upload
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive 
                ? 'border-primary-400 bg-primary-50' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input {...getInputProps()} />
            <PhotoIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            {isDragActive ? (
              <p className="text-primary-600 font-medium">Drop the images here...</p>
            ) : (
              <div>
                <p className="text-gray-600 font-medium mb-2">
                  Drag & drop images here, or click to select
                </p>
                <p className="text-sm text-gray-500">
                  Supports JPEG, PNG, WebP, GIF (max 50MB each)
                </p>
              </div>
            )}
          </div>

          {/* Selected Files */}
          {files.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Selected Files ({files.length})</h4>
              
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {files.map((fileData) => (
                  <div key={fileData.id} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
                    {/* Preview */}
                    <img
                      src={fileData.preview}
                      alt={fileData.file.name}
                      className="w-16 h-16 object-cover rounded-md"
                    />
                    
                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {fileData.file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(fileData.file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      
                      {/* Password Input (only for secure mode) */}
                      {uploadMode === 'secure' && (
                        <div className="relative mt-2">
                          <input
                            type={showPasswords[fileData.id] ? "text" : "password"}
                            placeholder="Image password"
                            value={passwords[fileData.id] || ''}
                            onChange={(e) => updatePassword(fileData.id, e.target.value)}
                            className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPasswords(prev => ({
                              ...prev,
                              [fileData.id]: !prev[fileData.id]
                            }))}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                          >
                            {showPasswords[fileData.id] ? (
                              <EyeSlashIcon className="h-4 w-4" />
                            ) : (
                              <EyeIcon className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {/* Remove Button */}
                    <button
                      onClick={() => removeFile(fileData.id)}
                      disabled={uploading}
                      className="p-1 text-red-400 hover:text-red-600 disabled:opacity-50"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              
              {/* Upload Mode Notice */}
              {uploadMode === 'secure' ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex">
                    <LockClosedIcon className="h-5 w-5 text-blue-400 mt-0.5 mr-3" />
                    <div>
                      <h5 className="text-sm font-medium text-blue-800">Secure Upload</h5>
                      <p className="text-sm text-blue-700 mt-1">
                        Each image requires a unique password (minimum 4 characters). 
                        These passwords are used for client-side encryption and cannot be recovered if lost.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex">
                    <PhotoIcon className="h-5 w-5 text-green-400 mt-0.5 mr-3" />
                    <div>
                      <h5 className="text-sm font-medium text-green-800">Normal Upload</h5>
                      <p className="text-sm text-green-700 mt-1">
                        Images will be uploaded without encryption. They can be viewed directly without passwords.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-xl">
          <p className="text-sm text-gray-600">
            {files.length} file{files.length !== 1 ? 's' : ''} selected
          </p>
          
          <div className="flex space-x-3">
            <button
              onClick={handleClose}
              disabled={uploading}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading || files.length === 0}
              className="btn-primary"
            >
              {uploading ? (
                <div className="flex items-center">
                  <div className="loading-spinner mr-2" />
                  Uploading...
                </div>
              ) : (
                `Upload ${files.length} File${files.length !== 1 ? 's' : ''}`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadModal;
