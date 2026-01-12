const request = require('supertest');
const { app, calculateAQIBucket } = require('../index');

describe('AQI Service Unit Tests', () => {
    test('calculateAQIBucket should return correct buckets', () => {
        expect(calculateAQIBucket(40)).toBe('Good');
        expect(calculateAQIBucket(70)).toBe('Moderate');
        expect(calculateAQIBucket(120)).toBe('Unhealthy for Sensitive Groups');
        expect(calculateAQIBucket(170)).toBe('Unhealthy');
        expect(calculateAQIBucket(250)).toBe('Very Unhealthy');
        expect(calculateAQIBucket(350)).toBe('Hazardous');
    });
});

describe('AQI Service Integration Tests', () => {
    test('GET /health should return 200 and status healthy', async () => {
        const response = await request(app).get('/health');
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('healthy');
    });

    test('GET /api/aqi/:location with invalid location should return 400', async () => {
        const response = await request(app).get('/api/aqi/a');
        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Invalid location format');
    });
});
