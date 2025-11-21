module.exports = {
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/config/**',
    '!src/utils/logger.js',
    '!**/node_modules/**'
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  // Use different setup files based on test location
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'node',
      testMatch: ['**/tests/unit/**/*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup.unit.js']
    },
    {
      displayName: 'integration',
      testEnvironment: 'node',
      testMatch: ['**/tests/integration/**/*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup.integration.js']
    }
  ]
};

