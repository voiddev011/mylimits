import test from 'node:test';
import assert from 'node:assert/strict';
import { configFromEnv } from '../src/config';

test('an empty optional OIDC client secret is treated as absent', () => {
  const values = {
    DATABASE_URL: process.env.DATABASE_URL,
    APP_ORIGIN: process.env.APP_ORIGIN,
    OIDC_ISSUER: process.env.OIDC_ISSUER,
    OIDC_AUDIENCE: process.env.OIDC_AUDIENCE,
    OIDC_JWKS_URI: process.env.OIDC_JWKS_URI,
    OIDC_AUTHORIZATION_ENDPOINT: process.env.OIDC_AUTHORIZATION_ENDPOINT,
    OIDC_TOKEN_ENDPOINT: process.env.OIDC_TOKEN_ENDPOINT,
    OIDC_CLIENT_ID: process.env.OIDC_CLIENT_ID,
    OIDC_CLIENT_SECRET: process.env.OIDC_CLIENT_SECRET,
  };

  try {
    process.env.DATABASE_URL = 'postgres://fixture.invalid/mylimits';
    process.env.APP_ORIGIN = 'https://app.example.test';
    process.env.OIDC_ISSUER = 'https://issuer.example.test';
    process.env.OIDC_AUDIENCE = 'mylimits';
    process.env.OIDC_JWKS_URI = 'https://issuer.example.test/keys';
    process.env.OIDC_AUTHORIZATION_ENDPOINT = 'https://issuer.example.test/authorize';
    process.env.OIDC_TOKEN_ENDPOINT = 'https://issuer.example.test/token';
    process.env.OIDC_CLIENT_ID = 'mylimits';
    process.env.OIDC_CLIENT_SECRET = '';

    assert.equal(configFromEnv().oidc?.clientSecret, undefined);
  } finally {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
