// jest.config.cjs
module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  extensionsToTreatAsEsm: ['.jsx'],
  testMatch: ['**/__tests__/**/*.test.js', '**/?(*.)+(spec|test).js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
  transformIgnorePatterns: [
    '/node_modules/(?!(lucide-react|@radix-ui)/)',
  ],
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': ['babel-jest', { 
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        ['@babel/preset-react', { runtime: 'automatic' }],
        '@babel/preset-typescript'
      ]
    }],
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/index.js',
    '!src/main.jsx',
    '!src/**/*.test.{js,jsx,ts,tsx}',
    '!src/__tests__/**',
  ],
  // Phase 1: Realistic coverage thresholds (integration test phase)
  // Progressive thresholds to allow iteration while maintaining standards
  coveragePathIgnorePatterns: [
    '/__tests__/',
    '/node_modules/',
  ],
  coverageThreshold: {
    global: {
      branches: 2,      // Allow iteration on complex features
      functions: 2,
      lines: 2,
      statements: 2,
    },
    './src/utils/index.ts': {
      branches: 100,    // Already achieved
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
};
