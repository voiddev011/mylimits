import { registerHooks } from 'node:module';

// Node 24 runs the pure TypeScript tests without a transpiler or network install.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && !/\.[a-z0-9]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context);
    return nextResolve(specifier, context);
  },
});
