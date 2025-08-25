const { createClient } = require('@supabase/supabase-js');

class SupabaseStorageService {
  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL;
    this.supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
    this.bucketName = process.env.SUPABASE_BUCKET_NAME || 'disguisedrive-files';
    
    if (!this.supabaseUrl || !this.supabaseKey) {
      throw new Error('Supabase URL and SERVICE_KEY are required');
    }
    
    this.supabase = createClient(this.supabaseUrl, this.supabaseKey, {
      auth: {
        persistSession: false
      }
    });
  }

  /**
   * Initialize storage service
   */
  async initialize() {
    try {
      // Check if bucket exists, create if it doesn't
      const { data: buckets, error: listError } = await this.supabase.storage.listBuckets();
      
      if (listError) {
        console.warn('Could not list buckets:', listError.message);
        console.log('📝 Please create the bucket manually in Supabase dashboard:');
        console.log(`   1. Go to Storage in your Supabase dashboard`);
        console.log(`   2. Create a new bucket named: ${this.bucketName}`);
        console.log(`   3. Set it as private (not public)`);
        return;
      }

      const bucketExists = buckets.some(bucket => bucket.name === this.bucketName);
      
      if (!bucketExists) {
        // Try to create bucket with a different approach
        console.log(`⚠️  Bucket '${this.bucketName}' not found. Attempting to create...`);
        
        const { error: createError } = await this.supabase.storage.createBucket(this.bucketName, {
          public: false,
          allowedMimeTypes: ['application/octet-stream', 'image/*'],
          fileSizeLimit: 50 * 1024 * 1024 // 50MB
        });
        
        if (createError) {
          console.log('❌ Auto-creation failed. Please create bucket manually:');
          console.log(`   1. Go to Storage in your Supabase dashboard`);
          console.log(`   2. Create a new bucket named: ${this.bucketName}`);
          console.log(`   3. Set it as private (not public)`);
          console.log(`   Error: ${createError.message}`);
        } else {
          console.log(`✅ Successfully created bucket: ${this.bucketName}`);
        }
      } else {
        console.log(`✅ Supabase bucket '${this.bucketName}' exists and ready`);
      }
    } catch (error) {
      console.warn('Supabase storage initialization warning:', error.message);
    }
  }

  /**
   * Upload encrypted file to Supabase storage
   * @param {Buffer} fileBuffer - The encrypted file buffer
   * @param {string} fileName - The file name
   * @param {string} contentType - The content type
   * @returns {Promise<string>} The file path in storage
   */
  async uploadEncryptedFile(fileBuffer, fileName, contentType = 'application/octet-stream') {
    try {
      const filePath = `encrypted/${Date.now()}-${fileName}`;
      
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .upload(filePath, fileBuffer, {
          contentType,
          duplex: 'half'
        });

      if (error) {
        throw new Error(`Supabase upload failed: ${error.message}`);
      }

      return data.path;
    } catch (error) {
      console.error('Supabase upload error:', error);
      throw error;
    }
  }

  /**
   * Upload normal file to Supabase storage (unencrypted)
   * @param {Buffer} fileBuffer - The file buffer
   * @param {string} fileName - The file name
   * @param {string} contentType - The content type
   * @returns {Promise<string>} The file path in storage
   */
  async uploadFile(fileBuffer, fileName, contentType = 'application/octet-stream') {
    try {
      const filePath = `normal/${Date.now()}-${fileName}`;
      
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .upload(filePath, fileBuffer, {
          contentType,
          duplex: 'half'
        });

      if (error) {
        throw new Error(`Supabase upload failed: ${error.message}`);
      }

      return data.path;
    } catch (error) {
      console.error('Supabase upload error:', error);
      throw error;
    }
  }

  /**
   * Download encrypted file from Supabase storage
   * @param {string} filePath - The file path in storage
   * @returns {Promise<Buffer>} The file buffer
   */
  async downloadEncryptedFile(filePath) {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .download(filePath);

      if (error) {
        throw new Error(`Supabase download failed: ${error.message}`);
      }

      return Buffer.from(await data.arrayBuffer());
    } catch (error) {
      console.error('Supabase download error:', error);
      throw error;
    }
  }

  /**
   * Delete file from Supabase storage
   * @param {string} filePath - The file path in storage
   * @returns {Promise<boolean>} Success status
   */
  async deleteFile(filePath) {
    try {
      const { error } = await this.supabase.storage
        .from(this.bucketName)
        .remove([filePath]);

      if (error) {
        throw new Error(`Supabase delete failed: ${error.message}`);
      }

      return true;
    } catch (error) {
      console.error('Supabase delete error:', error);
      return false;
    }
  }

  /**
   * Get file URL (for debugging, files are encrypted so not directly viewable)
   * @param {string} filePath - The file path in storage
   * @returns {Promise<string>} The signed URL
   */
  async getFileUrl(filePath) {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .createSignedUrl(filePath, 3600); // 1 hour expiry

      if (error) {
        throw new Error(`Supabase URL generation failed: ${error.message}`);
      }

      return data.signedUrl;
    } catch (error) {
      console.error('Supabase URL generation error:', error);
      throw error;
    }
  }
}

module.exports = SupabaseStorageService;
