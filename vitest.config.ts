import { defineConfig } from 'vitest/config';

// Конфигурация unit-тестов Vitest в браузероподобном окружении jsdom
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true
  }
});
