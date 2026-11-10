type AppBindings = import('../../server/env').Env;

declare namespace Cloudflare {
  // Bindings seen by `cloudflare:test` `env` match the app's Env.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- declaration merging needs an empty extends
  interface Env extends AppBindings {}
}
