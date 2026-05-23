import type { Config } from "jest";
import nextJest from "next/jest.js";

// next/jest wires the Next.js SWC transform, path aliases (@/*), and .env loading.
const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  coverageProvider: "v8",
  // Pure scoring/data tests run in node; component tests opt into jsdom with a
  // `@jest-environment jsdom` docblock at the top of the file.
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testMatch: ["**/__tests__/**/*.test.{ts,tsx}", "**/tests/**/*.test.{ts,tsx}"],
};

export default createJestConfig(config);
