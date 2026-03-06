module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: {
          emitDecoratorMetadata: true,
          experimentalDecorators: true,
          target: 'ES2021',
          module: 'commonjs',
          strict: false,
          strictNullChecks: false,
        },
        isolatedModules: true,
      },
    ],
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  testTimeout: 30000,
  maxWorkers: 1,
  bail: true,
  forceExit: true,
};
