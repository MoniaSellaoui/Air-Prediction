// Increase timeout for all tests
jest.setTimeout(10000);

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.LOCATION_SERVICE_PORT = '5002';
process.env.LOG_LEVEL = 'error'; 