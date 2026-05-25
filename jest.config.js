/**
 * Jest configuration for Personalization Performance Doctor.
 *
 * Two projects:
 *   "node"  — pure Node tests for M1 (Bloomreach clients), M2 (PRS scoring),
 *             and C5 (synthetic data integrity). CJS, no transformer.
 *   "react" — jsdom tests for M4 (dashboard) and M5 (PLP) React components,
 *             ts-jest with inline tsconfig so the Vite tsconfig.json does
 *             not collide with Jest's needs.
 */
module.exports = {
  projects: [
    {
      displayName: 'node',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/tests/c5-data/**/*.test.js',
        '<rootDir>/tests/m1-bloomreach/**/*.test.js',
        '<rootDir>/tests/m2-scoring/**/*.test.js',
        '<rootDir>/src/m1-bloomreach/__tests__/**/*.test.js',
        '<rootDir>/src/m2-scoring/__tests__/**/*.test.js',
      ],
    },
    {
      displayName: 'react',
      testEnvironment: 'jsdom',
      testMatch: [
        '<rootDir>/tests/m3-nl/**/*.test.{ts,tsx}',
        '<rootDir>/tests/m4-dashboard/**/*.test.{ts,tsx}',
        '<rootDir>/tests/m5-plp/**/*.test.{ts,tsx}',
        '<rootDir>/src/m3-nl/__tests__/**/*.test.{ts,tsx}',
        '<rootDir>/src/m4-dashboard/__tests__/**/*.test.{ts,tsx}',
        '<rootDir>/src/m5-plp/__tests__/**/*.test.{ts,tsx}',
      ],
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
      transform: {
        '^.+\\.(ts|tsx)$': [
          'ts-jest',
          {
            isolatedModules: true,
            tsconfig: {
              jsx: 'react-jsx',
              esModuleInterop: true,
              module: 'commonjs',
              target: 'es2020',
              moduleResolution: 'node',
              allowJs: true,
              resolveJsonModule: true,
              types: ['jest', '@testing-library/jest-dom', 'node'],
            },
          },
        ],
      },
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      moduleNameMapper: {
        '\\.(css|less|scss|sass)$': '<rootDir>/jest.styleMock.js',
      },
    },
  ],
  verbose: true,
};
