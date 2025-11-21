# Testing Guide

This project uses **Jest** and **Supertest** for integration testing.

## Test Structure

- **Integration Tests** (`tests/integration/`): Test API endpoints end-to-end with database
- **Unit Tests** (`tests/unit/`): Test utility functions and pure logic without database

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up test database (optional):
   Create a `.env.test` file with:
   ```
   MONGO_URI_TEST=mongodb://localhost:27017/herhaven_test
   ```
   
   Or the tests will use your main MONGO_URI with a test database suffix.

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (reruns on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## Test Examples

### Integration Test Example

Tests API endpoints with real database operations:

### Unit Test Example

Tests utility functions without database:


## Notes

- Tests use a separate test database (automatically created/cleaned)
- Database is cleared between tests
- Test database is dropped after all tests complete
- Tests timeout after 30 seconds

