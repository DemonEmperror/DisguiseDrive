const axios = require('axios');

class UnsplashService {
  constructor() {
    this.accessKey = process.env.UNSPLASH_ACCESS_KEY;
    this.baseURL = 'https://api.unsplash.com';
    this.cache = new Map(); // Simple in-memory cache
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Get a random nature image from Unsplash
   * @returns {Promise<string>} Image URL
   */
  async getRandomNatureImage() {
    try {
      // Check cache first
      const cacheKey = 'nature_images';
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
        const randomIndex = Math.floor(Math.random() * cached.images.length);
        return cached.images[randomIndex];
      }

      // Fetch new images from Unsplash
      const response = await axios.get(`${this.baseURL}/photos/random`, {
        params: {
          query: 'nature,landscape,forest,mountains,ocean,trees',
          count: 30, // Get 30 images to cache
          orientation: 'landscape',
          w: 400,
          h: 300
        },
        headers: {
          'Authorization': `Client-ID ${this.accessKey}`
        },
        timeout: 10000
      });

      const images = response.data.map(img => img.urls.small);
      
      // Cache the images
      this.cache.set(cacheKey, {
        images: images,
        timestamp: Date.now()
      });

      // Return random image from the fetched set
      const randomIndex = Math.floor(Math.random() * images.length);
      return images[randomIndex];

    } catch (error) {
      console.error('Failed to fetch Unsplash image:', error.message);
      
      // Fallback to a default nature image URL
      const fallbackImages = [
        'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=400&h=300&fit=crop'
      ];
      
      const randomIndex = Math.floor(Math.random() * fallbackImages.length);
      return fallbackImages[randomIndex];
    }
  }

  /**
   * Get random image by aesthetic type
   * @param {string} type - Aesthetic type (grunge, cybercore, etc.)
   * @returns {Promise<string>} Image URL
   */
  async getRandomImageByType(type = 'nature') {
    const aestheticQueries = {
      'grunge': 'grunge,vintage,distressed,worn,texture,industrial',
      'cybercore': 'cyberpunk,neon,futuristic,digital,technology,cyber',
      'dark academia': 'dark academia,library,books,vintage,gothic,scholarly',
      'cottage core': 'cottagecore,rural,countryside,flowers,vintage,cozy',
      'desert steampunk': 'steampunk,desert,mechanical,brass,vintage,industrial',
      'goth': 'gothic,dark,black,mysterious,architecture,dramatic',
      'victorian': 'victorian,vintage,ornate,elegant,classical,antique',
      'medieval': 'medieval,castle,ancient,stone,historical,fortress',
      'nature': 'nature,landscape,forest,mountains,ocean,trees'
    };

    const query = aestheticQueries[type.toLowerCase()] || aestheticQueries['nature'];

    try {
      const cacheKey = `${type}_images`;
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
        const randomIndex = Math.floor(Math.random() * cached.images.length);
        return cached.images[randomIndex];
      }

      const response = await axios.get(`${this.baseURL}/photos/random`, {
        params: {
          query: query,
          count: 20,
          orientation: 'landscape',
          w: 400,
          h: 300
        },
        headers: {
          'Authorization': `Client-ID ${this.accessKey}`
        },
        timeout: 10000
      });

      const images = response.data.map(img => img.urls.small);
      
      this.cache.set(cacheKey, {
        images: images,
        timestamp: Date.now()
      });

      const randomIndex = Math.floor(Math.random() * images.length);
      return images[randomIndex];

    } catch (error) {
      console.error(`Failed to fetch ${type} image:`, error.message);
      return this.getRandomNatureImage(); // Fallback to nature
    }
  }

  /**
   * Get multiple random nature images
   * @param {number} count - Number of images to fetch
   * @returns {Promise<string[]>} Array of image URLs
   */
  async getRandomNatureImages(count = 10) {
    try {
      const images = [];
      for (let i = 0; i < count; i++) {
        const imageUrl = await this.getRandomNatureImage();
        images.push(imageUrl);
      }
      return images;
    } catch (error) {
      console.error('Failed to fetch multiple Unsplash images:', error.message);
      return [];
    }
  }

  /**
   * Clear the image cache
   */
  clearCache() {
    this.cache.clear();
  }
}

module.exports = new UnsplashService();
