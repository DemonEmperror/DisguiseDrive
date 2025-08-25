/**
 * Client-side crypto utilities using WebCrypto API
 */
export class CryptoService {
  constructor() {
    this.textEncoder = new TextEncoder();
    this.textDecoder = new TextDecoder();
  }

  /**
   * Derive key from password using PBKDF2
   */
  async deriveKey(password, salt) {
    try {
      // Convert password and salt to ArrayBuffer
      const passwordBuffer = this.textEncoder.encode(password);
      const saltBuffer = typeof salt === 'string' ? 
        this.textEncoder.encode(salt) : 
        new Uint8Array(salt);

      // Import password as key material
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        passwordBuffer,
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );

      // Derive key using PBKDF2
      const derivedKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: saltBuffer,
          iterations: 100000, // 100k iterations for security
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      // Export key as raw bytes
      const keyBuffer = await crypto.subtle.exportKey('raw', derivedKey);
      return new Uint8Array(keyBuffer);
    } catch (error) {
      console.error('Key derivation failed:', error);
      throw new Error('Failed to derive encryption key');
    }
  }

  /**
   * Decrypt file key with password-derived key
   * @param {string} encryptedKeyBlob - Base64 encoded encrypted key blob
   * @param {string} password - User's per-image password
   * @param {string} saltBase64 - Base64 encoded salt
   * @returns {Promise<Uint8Array>} Decrypted file key
   */
  async decryptFileKey(encryptedKeyBlob, password, saltBase64) {
    try {
      const keyBlob = this.base64ToUint8Array(encryptedKeyBlob);
      const salt = this.base64ToUint8Array(saltBase64);
      
      // Extract components from blob
      const iv = keyBlob.slice(0, 12);
      const authTag = keyBlob.slice(12, 28);
      const encryptedData = keyBlob.slice(28);
      
      // Derive key from password
      const passwordKey = await this.deriveKey(password, salt);
      
      // Import password key for decryption
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        passwordKey,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );
      
      // Decrypt file key
      const decryptedKey = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv,
          additionalData: new TextEncoder().encode('DisguiseDrive-v1'),
          tagLength: 128,
        },
        cryptoKey,
        new Uint8Array([...encryptedData, ...authTag])
      );
      
      return new Uint8Array(decryptedKey);
    } catch (error) {
      throw new Error(`File key decryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt file data using AES-256-GCM
   * @param {Uint8Array} encryptedBlob - Encrypted file blob from server
   * @param {Uint8Array} fileKey - Decrypted file key
   * @returns {Promise<Uint8Array>} Decrypted file data
   */
  async decryptFileData(encryptedBlob, fileKey) {
    try {
      // Parse storage blob format: [IV (12 bytes)] [AuthTag (16 bytes)] [Encrypted Data]
      const iv = encryptedBlob.slice(0, 12);
      const authTag = encryptedBlob.slice(12, 28);
      const encryptedData = encryptedBlob.slice(28);
      
      // Import file key for decryption
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        fileKey,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );
      
      // Decrypt file data
      const decryptedData = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv,
          additionalData: new TextEncoder().encode('DisguiseDrive-v1'),
          tagLength: 128,
        },
        cryptoKey,
        new Uint8Array([...encryptedData, ...authTag])
      );
      
      return new Uint8Array(decryptedData);
    } catch (error) {
      throw new Error(`File decryption failed: ${error.message}`);
    }
  }

  /**
   * Convert base64 string to Uint8Array
   * @param {string} base64 - Base64 encoded string
   * @returns {Uint8Array} Decoded bytes
   */
  base64ToUint8Array(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Convert Uint8Array to base64 string
   * @param {Uint8Array} bytes - Bytes to encode
   * @returns {string} Base64 encoded string
   */
  uint8ArrayToBase64(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Create a blob URL from decrypted image data (temporary, for canvas)
   * @param {Uint8Array} imageData - Decrypted image data
   * @param {string} mimeType - Image MIME type
   * @returns {string} Blob URL
   */
  createImageBlob(imageData, mimeType) {
    const blob = new Blob([imageData], { type: mimeType });
    return URL.createObjectURL(blob);
  }

  /**
   * Render decrypted image to canvas (secure display)
   * @param {Uint8Array} imageData - Decrypted image data
   * @param {string} mimeType - Image MIME type
   * @param {HTMLCanvasElement} canvas - Canvas element to render to
   * @param {string} watermarkText - Optional watermark text
   * @returns {Promise<void>}
   */
  async renderToCanvas(imageData, mimeType, canvas, watermarkText = '') {
    return new Promise((resolve, reject) => {
      try {
        console.log('Starting renderToCanvas with:', {
          dataSize: imageData.length,
          mimeType,
          canvasExists: !!canvas
        });
        
        const blob = new Blob([imageData], { type: mimeType });
        console.log('Created blob:', blob.size, 'bytes, type:', blob.type);
        
        const url = URL.createObjectURL(blob);
        console.log('Created blob URL:', url);
        
        const img = new Image();
        
        img.onload = () => {
          try {
            console.log('Image loaded successfully:', img.width, 'x', img.height);
            
            if (!canvas) {
              reject(new Error('Canvas element is null'));
              return;
            }
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('Could not get canvas context'));
              return;
            }
            
            // Calculate canvas size maintaining aspect ratio
            const maxWidth = Math.min(800, window.innerWidth - 40);
            const maxHeight = Math.min(600, window.innerHeight * 0.8);
            
            let { width, height } = img;
            
            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }
            
            if (height > maxHeight) {
              width = (width * maxHeight) / height;
              height = maxHeight;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            console.log('Canvas dimensions set to:', width, 'x', height);
            
            // Clear canvas and draw image
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            
            console.log('Image drawn to canvas successfully');
            
            // Add watermark if provided
            if (watermarkText) {
              ctx.save();
              ctx.globalAlpha = 0.3;
              ctx.fillStyle = 'white';
              ctx.strokeStyle = 'black';
              ctx.lineWidth = 1;
              ctx.font = '14px Inter, sans-serif';
              ctx.textAlign = 'right';
              ctx.textBaseline = 'bottom';
              
              const x = width - 10;
              const y = height - 10;
              
              ctx.strokeText(watermarkText, x, y);
              ctx.fillText(watermarkText, x, y);
              ctx.restore();
            }
            
            // Clean up blob URL
            URL.revokeObjectURL(url);
            resolve();
          } catch (error) {
            URL.revokeObjectURL(url);
            reject(error);
          }
        };
        
        img.onerror = (error) => {
          console.error('Image load error:', error);
          URL.revokeObjectURL(url);
          reject(new Error('Failed to load image'));
        };
        
        img.src = url;
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Securely clear canvas
   * @param {HTMLCanvasElement} canvas - Canvas to clear
   */
  clearCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Overwrite with random data for security
    const imageData = ctx.createImageData(canvas.width, canvas.height);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.random() * 255;     // Red
      data[i + 1] = Math.random() * 255; // Green
      data[i + 2] = Math.random() * 255; // Blue
      data[i + 3] = 255;                 // Alpha
    }
    
    ctx.putImageData(imageData, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

export default new CryptoService();
