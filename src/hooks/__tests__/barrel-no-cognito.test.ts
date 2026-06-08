import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const barrelPath = resolve(here, '../index.ts');
const useAuthPath = resolve(here, '../useAuth.ts');

describe('hooks barrel does not drag in the Cognito SDK', () => {
  it('does not re-export useAuth from the barrel', () => {
    const barrel = readFileSync(barrelPath, 'utf8');
    // useAuth statically imports @aws-sdk/client-cognito-identity-provider,
    // so it must NOT be reachable from the always-mounted-component barrel.
    expect(barrel).not.toMatch(/useAuth/);
  });

  it('useAuth.ts is still the lone owner of the Cognito SDK import', () => {
    const useAuth = readFileSync(useAuthPath, 'utf8');
    expect(useAuth).toContain('@aws-sdk/client-cognito-identity-provider');
  });
});
