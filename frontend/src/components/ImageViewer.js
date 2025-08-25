import { useState, useRef, useEffect } from 'react';
import { XMarkIcon, LockClosedIcon, TrashIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useBottomTap } from '../hooks/useTripleTap';
import { filesAPI } from '../lib/api';
import cryptoService from '../lib/crypto';
import toast from 'react-hot-toast';

const ImageViewer = ({ file, isOpen, onClose, folderToken, user, onDelete }) => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [decryptedImage, setDecryptedImage] = useState(null);
  const [showPlainText, setShowPlainText] = useState(false);
  const [decryptedData, setDecryptedData] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [normalImageUrl, setNormalImageUrl] = useState(null);
  
  const canvasRef = useRef(null);
  const modalRef = useRef(null);

  // Bottom tap detection for unlock (only for secure files)
  const bottomTapHandlers = useBottomTap(() => {
    if (file?.uploadMode === 'secure' && !isUnlocked) {
      setShowPasswordPrompt(true);
    }
  });

  // Reset state when file changes or modal closes
  useEffect(() => {
    if (!isOpen || !file) {
      resetState();
    } else if (file?.uploadMode === 'normal') {
      // For normal files, load the image directly
      loadNormalImage();
    }
  }, [isOpen, file]);

  const loadNormalImage = async () => {
    if (!file || file.uploadMode !== 'normal') return;
    
    try {
      setLoading(true);
      const response = await filesAPI.getFileUrl(file.id, folderToken);
      setNormalImageUrl(response.data.url);
      setIsUnlocked(true); // Mark as "unlocked" for normal files
    } catch (error) {
      console.error('Error loading normal image:', error);
      toast.error('Failed to load image');
    } finally {
      setLoading(false);
    }
  };

  const resetState = () => {
    setIsUnlocked(false);
    setShowPasswordPrompt(false);
    setPassword('');
    setDecryptedImage(null);
    setShowPlainText(false);
    setDecryptedData(null);
    setShowPassword(false);
    setNormalImageUrl(null);
    if (canvasRef.current) {
      cryptoService.clearCanvas(canvasRef.current);
    }
  };

  const handleUnlock = async () => {
    if (!password.trim()) {
      toast.error('Please enter the image password');
      return;
    }

    setLoading(true);
    
    try {
      // Step 1: Decrypt file key with password
      const keyResponse = await filesAPI.decryptKey(file.id, password, folderToken);
      const fileKeyBase64 = keyResponse.data.fileKey;
      const fileKey = cryptoService.base64ToUint8Array(fileKeyBase64);

      // Step 2: Get encrypted file blob
      const encryptedBlob = await filesAPI.getEncrypted(file.id, folderToken);
      const encryptedData = new Uint8Array(encryptedBlob);

      // Step 3: Decrypt file data
      const decryptedDataBuffer = await cryptoService.decryptFileData(encryptedData, fileKey);
      setDecryptedData(decryptedDataBuffer);
      
      console.log('Decrypted data:', {
        size: decryptedDataBuffer.length,
        mimeType: file.mimeType,
        firstBytes: Array.from(decryptedDataBuffer.slice(0, 10))
      });

      // Step 4: Set unlocked state first, then render to canvas
      setIsUnlocked(true);
      setShowPasswordPrompt(false);
      setPassword('');
      
      // Wait for next tick to ensure canvas is rendered
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (canvasRef.current) {
        const watermarkText = `${user?.username} • ${new Date().toLocaleString()}`;
        await cryptoService.renderToCanvas(
          decryptedDataBuffer,
          file.mimeType,
          canvasRef.current,
          watermarkText
        );
      } else {
        console.error('Canvas ref is null after unlock');
      }

      toast.success('Image unlocked successfully');
      
    } catch (error) {
      console.error('Unlock failed:', error);
      toast.error('Invalid password or decryption failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this image? This action cannot be undone.')) {
      return;
    }

    setLoading(true);
    try {
      await filesAPI.delete(file.id);
      toast.success('Image deleted successfully');
      resetState();
      onClose();
      if (onDelete) {
        onDelete(file.id);
      }
    } catch (error) {
      console.error('Failed to delete image:', error);
      toast.error('Failed to delete image');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleBackdropClick = (e) => {
    if (e.target === modalRef.current) {
      handleClose();
    }
  };

  if (!isOpen || !file) return null;

  return (
    <div 
      ref={modalRef}
      className="modal-overlay"
      onClick={handleBackdropClick}
    >
      <div className="modal-content max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{file.originalName}</h3>
            <p className="text-sm text-gray-500">
              {(file.size / 1024 / 1024).toFixed(2)} MB • {new Date(file.createdAt).toLocaleDateString()}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-md text-gray-400 hover:text-gray-500"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {!isUnlocked ? (
            /* Cover Image Display */
            <div className="text-center">
              <div className="relative inline-block">
                <img
                  src={file.coverPath}
                  alt="Cover"
                  className="max-w-full max-h-96 rounded-lg shadow-lg prevent-context-menu no-select"
                />
                {/* Invisible bottom unlock area */}
                <div className="absolute inset-0 rounded-lg flex flex-col">
                  <div className="flex-1"></div>
                  <div 
                    className="h-16 cursor-pointer"
                    {...bottomTapHandlers}
                  >
                  </div>
                </div>
              </div>
              
              <div className="mt-4 space-y-2">
                <p className="text-sm text-gray-600">
                  Nature photography collection.
                </p>
              </div>
            </div>
          ) : (
            /* Image Display - Normal or Decrypted */
            <div className="text-center">
              {file?.uploadMode === 'normal' && normalImageUrl ? (
                /* Normal Image Display */
                <img
                  src={normalImageUrl}
                  alt={file.originalName}
                  className="max-w-full max-h-[70vh] object-contain rounded-lg"
                />
              ) : (
                /* Decrypted Secure Image Display */
                <canvas
                  ref={canvasRef}
                  className="secure-canvas prevent-context-menu no-select"
                  style={{ maxWidth: '100%', maxHeight: '70vh' }}
                />
              )}
              
              <div className="mt-4">
                <p className="text-sm text-gray-600 mb-2">
                  {file?.uploadMode === 'normal' 
                    ? '📷 High-quality image from your collection' 
                    : '🔓 Original image unlocked and displayed securely'
                  }
                </p>
                <div className="flex justify-center space-x-2">
                  {file?.uploadMode === 'secure' && (
                    <button
                      onClick={() => {
                        setIsUnlocked(false);
                        setShowPlainText(false);
                        setDecryptedData(null);
                        cryptoService.clearCanvas(canvasRef.current);
                      }}
                      className="btn-secondary"
                    >
                      Lock Again
                    </button>
                  )}
                  <button
                    onClick={handleDelete}
                    className="btn-danger"
                  >
                    <TrashIcon className="h-4 w-4 mr-2" />
                    Delete
                  </button>
                  <button
                    onClick={handleClose}
                    className="btn-primary"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Password Prompt Modal */}
      {showPasswordPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-60">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="text-center mb-4">
              <LockClosedIcon className="h-12 w-12 text-primary-600 mx-auto mb-2" />
              <h3 className="text-lg font-semibold text-gray-900">Enter Image Password</h3>
              <p className="text-sm text-gray-600 mt-1">
                This image is protected with a per-image password
              </p>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter image password"
                  className="input-field pr-10"
                  autoFocus
                  onKeyPress={(e) => e.key === 'Enter' && handleUnlock()}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
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
                    setPassword('');
                  }}
                  className="btn-secondary flex-1"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleUnlock}
                  className="btn-primary flex-1"
                  disabled={loading || !password.trim()}
                >
                  {loading ? (
                    <div className="loading-spinner mx-auto" />
                  ) : (
                    'Unlock'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageViewer;
