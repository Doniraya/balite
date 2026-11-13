import { defineConfig } from 'vite';

// Конфигурация сборщика Vite с относительными путями для размещения в подкаталогах площадок
export default defineConfig(async () => {
  const fsModule = 'node:fs';
  const { readFileSync } = (await import(/* @vite-ignore */ fsModule)) as {
    readFileSync: (path: URL, encoding: 'utf8') => string;
  };
  const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
    version: string;
  };

  return {
    base: './',
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
  };
});
