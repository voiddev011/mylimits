import { registerHooks } from 'node:module';

// Node 24 runs the pure TypeScript tests without a transpiler or network install.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && !/\.[a-z0-9]+$/i.test(specifier) && !context.parentURL?.includes('/node_modules/')) {
      try { return nextResolve(specifier, context); }
      catch (error) {
        if (!['ERR_MODULE_NOT_FOUND', 'MODULE_NOT_FOUND'].includes(error.code)) throw error;
        return nextResolve(`${specifier}.ts`, context);
      }
    }
    return nextResolve(specifier, context);
  },
});
