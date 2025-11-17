// jest.config.js
module.exports = {
  preset: 'ts-jest', 
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.ts', '**/?(*.)+(spec|test).ts'],
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
    '^root/(.*)$': '<rootDir>/$1'
  },
  setupFilesAfterEnv: [
    "jest-extended/all"
  ]
};