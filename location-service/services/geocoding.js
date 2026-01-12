const axios = require('axios');
const NodeCache = require('node-cache');
const winston = require('winston');

// === Constants ===
const CACHE_TTL = 300; // 5 minutes
const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'AirQualityPredictionApp/1.0'; // Important pour OSM

// === Cache Setup ===
const cache = new NodeCache({ stdTTL: CACHE_TTL });

// === Logger Setup ===
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

class OpenStreetMapService {
  constructor() {
    this.axiosInstance = axios.create({
      baseURL: NOMINATIM_BASE_URL,
      headers: {
        'User-Agent': USER_AGENT
      }
    });
  }

  async _wait() {
    // Respect Nominatim's usage policy (1 request per second)
    return new Promise(resolve => setTimeout(resolve, 1000));
  }

  async geocode(address) {
    const cacheKey = `geocode:${address}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    await this._wait();

    try {
      const response = await this.axiosInstance.get('/search', {
        params: {
          q: address,
          format: 'json',
          limit: 1,
          addressdetails: 1
        },
        timeout: 5000 // 5 second timeout
      });

      if (!response.data || response.data.length === 0) {
        // Fallback: return default coordinates for the city name
        logger.warn(`Address not found for: ${address}, using default coordinates`);
        return this._getDefaultCoordinates(address);
      }

      const result = response.data[0];
      const location = {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        address: result.display_name,
        city: result.address.city || result.address.town || result.address.village || address,
        country: result.address.country || 'Unknown',
        place_id: result.place_id
      };

      cache.set(cacheKey, location);
      return location;
    } catch (error) {
      logger.error('Geocoding error:', error.message);
      // Fallback: return default coordinates
      return this._getDefaultCoordinates(address);
    }
  }

  _getDefaultCoordinates(cityName) {
    // Default coordinates for common cities
    const defaults = {
      'paris': { latitude: 48.8566, longitude: 2.3522, city: 'Paris', country: 'France' },
      'london': { latitude: 51.5074, longitude: -0.1278, city: 'London', country: 'United Kingdom' },
      'new york': { latitude: 40.7128, longitude: -74.0060, city: 'New York', country: 'United States' },
      'tokyo': { latitude: 35.6762, longitude: 139.6503, city: 'Tokyo', country: 'Japan' },
      'berlin': { latitude: 52.5200, longitude: 13.4050, city: 'Berlin', country: 'Germany' },
      'madrid': { latitude: 40.4168, longitude: -3.7038, city: 'Madrid', country: 'Spain' },
      'rome': { latitude: 41.9028, longitude: 12.4964, city: 'Rome', country: 'Italy' },
      'moscow': { latitude: 55.7558, longitude: 37.6173, city: 'Moscow', country: 'Russia' },
    };

    const key = cityName.toLowerCase().trim();
    if (defaults[key]) {
      return {
        ...defaults[key],
        address: cityName,
        place_id: null
      };
    }

    // Ultimate fallback: use Paris coordinates
    logger.warn(`No default coordinates for ${cityName}, using Paris as fallback`);
    return {
      latitude: 48.8566,
      longitude: 2.3522,
      address: cityName,
      city: cityName,
      country: 'Unknown',
      place_id: null
    };
  }

  async reverseGeocode({ latitude, longitude }) {
    const cacheKey = `reverse:${latitude},${longitude}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    await this._wait();

    try {
      const response = await this.axiosInstance.get('/reverse', {
        params: {
          lat: latitude,
          lon: longitude,
          format: 'json',
          addressdetails: 1
        }
      });

      if (!response.data) {
        throw new Error('Location not found');
      }

      const result = response.data;
      const location = {
        address: result.display_name,
        city: result.address.city || result.address.town || result.address.village,
        country: result.address.country,
        place_id: result.place_id
      };

      cache.set(cacheKey, location);
      return location;
    } catch (error) {
      logger.error('Reverse geocoding error:', error);
      throw new Error('Failed to reverse geocode coordinates');
    }
  }
}

module.exports = new OpenStreetMapService(); 