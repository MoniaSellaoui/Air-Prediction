const request = require('supertest');
const { app, server, db } = require('../index');
const geocodingService = require('../services/geocoding');

jest.mock('../services/geocoding');

describe('Location Service', () => {
  beforeAll(async () => {
    await db.run(`CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      address TEXT,
      city TEXT,
      country TEXT,
      place_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  });

  afterAll(async () => {
    await db.run('DROP TABLE locations');
    await new Promise(resolve => server.close(resolve));
  });

  beforeEach(async () => {
    await db.run('DELETE FROM locations');
    jest.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
    });
  });

  describe('POST /api/locations', () => {
    const mockLocation = {
      latitude: 48.8566,
      longitude: 2.3522,
      address: 'Paris, Île-de-France, France',
      city: 'Paris',
      country: 'France',
      place_id: 'osm_123456'
    };

    beforeEach(() => {
      geocodingService.reverseGeocode.mockResolvedValue(mockLocation);
      geocodingService.geocode.mockResolvedValue(mockLocation);
    });

    it('should create a new location with coordinates', async () => {
      const response = await request(app)
        .post('/api/locations')
        .send({
          userId: 'test_user',
          name: 'My Location',
          latitude: 48.8566,
          longitude: 2.3522
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        user_id: 'test_user',
        name: 'My Location',
        latitude: 48.8566,
        longitude: 2.3522,
        city: 'Paris',
        country: 'France'
      });
      expect(geocodingService.reverseGeocode).toHaveBeenCalledWith({
        latitude: 48.8566,
        longitude: 2.3522
      });
    });

    it('should create a new location with address', async () => {
      const response = await request(app)
        .post('/api/locations')
        .send({
          userId: 'test_user',
          name: 'My Location',
          address: 'Paris, France'
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        user_id: 'test_user',
        name: 'My Location',
        city: 'Paris',
        country: 'France'
      });
      expect(geocodingService.geocode).toHaveBeenCalledWith('Paris, France');
    });

    it('should enforce location limit per user', async () => {
      // Create max number of locations
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post('/api/locations')
          .send({
            userId: 'test_user',
            name: `Location ${i}`,
            latitude: 48.8566,
            longitude: 2.3522
          });
      }

      // Try to create one more
      const response = await request(app)
        .post('/api/locations')
        .send({
          userId: 'test_user',
          name: 'One Too Many',
          latitude: 48.8566,
          longitude: 2.3522
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Maximum');
    });

    it('should validate coordinates', async () => {
      const response = await request(app)
        .post('/api/locations')
        .send({
          userId: 'test_user',
          name: 'Invalid Location',
          latitude: 200,
          longitude: 2.3522
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid coordinates');
    });
  });

  describe('GET /api/locations/:userId', () => {
    beforeEach(async () => {
      // Add test locations
      await db.run(
        `INSERT INTO locations (user_id, name, latitude, longitude, city, country)
        VALUES (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?)`,
        [
          'test_user', 'Location 1', 48.8566, 2.3522, 'Paris', 'France',
          'test_user', 'Location 2', 51.5074, -0.1278, 'London', 'UK'
        ]
      );
    });

    it('should return all locations for a user', async () => {
      const response = await request(app).get('/api/locations/test_user');
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].city).toBe('Paris');
      expect(response.body[1].city).toBe('London');
    });

    it('should return empty array for non-existent user', async () => {
      const response = await request(app).get('/api/locations/non_existent');
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(0);
    });
  });

  describe('PUT /api/locations/:id', () => {
    let locationId;

    beforeEach(async () => {
      const result = await db.run(
        `INSERT INTO locations (user_id, name, latitude, longitude, city, country)
        VALUES (?, ?, ?, ?, ?, ?)`,
        ['test_user', 'Original Location', 48.8566, 2.3522, 'Paris', 'France']
      );
      locationId = result.lastID;

      geocodingService.geocode.mockResolvedValue({
        latitude: 51.5074,
        longitude: -0.1278,
        address: 'London, UK',
        city: 'London',
        country: 'UK',
        place_id: 'mock_place_id'
      });
    });

    it('should update location name', async () => {
      const response = await request(app)
        .put(`/api/locations/${locationId}`)
        .send({
          name: 'Updated Location'
        });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Location');
      expect(response.body.city).toBe('Paris');
    });

    it('should update location with new address', async () => {
      const response = await request(app)
        .put(`/api/locations/${locationId}`)
        .send({
          name: 'London Office',
          address: 'London, UK'
        });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('London Office');
      expect(response.body.city).toBe('London');
    });

    it('should return 404 for non-existent location', async () => {
      const response = await request(app)
        .put('/api/locations/999999')
        .send({
          name: 'Updated Location'
        });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/locations/:id', () => {
    let locationId;

    beforeEach(async () => {
      const result = await db.run(
        `INSERT INTO locations (user_id, name, latitude, longitude, city, country)
        VALUES (?, ?, ?, ?, ?, ?)`,
        ['test_user', 'Test Location', 48.8566, 2.3522, 'Paris', 'France']
      );
      locationId = result.lastID;
    });

    it('should delete location', async () => {
      const response = await request(app).delete(`/api/locations/${locationId}`);
      expect(response.status).toBe(204);

      const location = await db.get('SELECT * FROM locations WHERE id = ?', [locationId]);
      expect(location).toBeUndefined();
    });

    it('should return 404 for non-existent location', async () => {
      const response = await request(app).delete('/api/locations/999999');
      expect(response.status).toBe(404);
    });
  });
}); 