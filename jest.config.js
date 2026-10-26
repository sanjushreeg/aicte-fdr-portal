/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        diagnostics: false,
        tsconfig: {
          rootDir: ".",
          target: "es2022",
          module: "commonjs",
          moduleResolution: "node",
          esModuleInterop: true,
          skipLibCheck: true,
        },
      },
    ],
  },
};
