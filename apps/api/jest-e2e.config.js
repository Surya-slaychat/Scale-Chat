/**
 * NestJS e2e config — covers `apps/api/test/*.e2e-spec.ts`.
 *
 * Architecture:
 *   - One isolated Postgres schema (`test_e2e`) shared by all tests; we
 *     truncate tables in `beforeEach` so cases don't leak state.
 *   - The same docker `scalechat-pg` + `scalechat-redis` containers the dev
 *     stack uses (host ports 5433 / 6380) — see `scripts/setup-dev-db.mjs`.
 *   - `globalSetup` applies migrations to the test schema; `globalTeardown`
 *     drops it so re-runs from a fresh dev tree stay deterministic.
 *   - Tests use Fastify's `app.inject()` (via `light-my-request`, bundled
 *     with `@nestjs/platform-fastify`) — no supertest dep needed.
 *
 * Per `my-app/AGENTS.md`, Expo modules aren't in scope here. This is the
 * server-side test runner.
 */
module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  testRegex: 'test/.+\\.e2e-spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    // Resolve to the BUILT shared package — `src/index.ts` has ESM `.js`
    // extensions on the re-exports which trip Jest's CommonJS resolver. The
    // dist is freshly emitted by `npm run shared:build` and the API runtime
    // imports it the same way, so we mirror that.
    '^@scalechat/shared$': '<rootDir>/../../packages/shared/dist/index.js',
    '^@scalechat/shared/(.*)$': '<rootDir>/../../packages/shared/dist/$1',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: { module: 'CommonJS', esModuleInterop: true, target: 'ES2022' },
        diagnostics: { ignoreCodes: [2459, 6133, 6196] },
      },
    ],
  },
  globalSetup: '<rootDir>/test/global-setup.ts',
  globalTeardown: '<rootDir>/test/global-teardown.ts',
  testTimeout: 30_000,
};
