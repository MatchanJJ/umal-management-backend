type AppBindings = import('../../server/env').Env;

declare namespace Cloudflare {
  // Bindings seen by `cloudflare:test` `env`: the app's Env plus test-only bindings.
  interface Env extends AppBindings {
    TEST_MIGRATIONS: import('cloudflare:test').D1Migration[];
  }
}
