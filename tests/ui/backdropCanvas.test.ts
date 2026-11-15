import { describe, expect, it } from 'vitest';
import { MOOD_PALETTES, createBackdropCanvas } from '../../src/ui/backdropCanvas';
import type { BackdropMood } from '../../src/ui/backdropCanvas';

describe('backdropCanvas (Таверна гильдии и очаг)', () => {
  const ALL_MOODS: readonly BackdropMood[] = ['menu', 'battle', 'boss', 'shop', 'victory', 'defeat'];

  it('содержит корректные палитры для всех 6 настроений без NaN и в диапазоне 0..255', () => {
    for (const mood of ALL_MOODS) {
      const palette = MOOD_PALETTES[mood];
      expect(palette).toBeDefined();

      // Проверяем компоненты RGB
      for (const [r, g, b] of [palette.inner, palette.outer, palette.swirlA, palette.swirlB]) {
        expect(Number.isFinite(r)).toBe(true);
        expect(Number.isFinite(g)).toBe(true);
        expect(Number.isFinite(b)).toBe(true);
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(255);
        expect(g).toBeGreaterThanOrEqual(0);
        expect(g).toBeLessThanOrEqual(255);
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThanOrEqual(255);
      }

      // Акцентный цвет должен быть валидным hex-кодом
      expect(palette.accent).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('палитры menu, battle и shop имеют тёплый дубово-каминный колорит (Red > Green), а не кислотно-зелёный Balatro', () => {
    // В старой теме Balatro:
    // menu inner: [26, 78, 66] (Green > Red)
    // battle inner: [24, 92, 74] (Green > Red)
    // В теме таверны Red должен преобладать над Green (тёплый дуб, янтарь, огонь)
    const menuPalette = MOOD_PALETTES.menu;
    expect(menuPalette.inner[0]).toBeGreaterThan(menuPalette.inner[1]);
    expect(menuPalette.outer[0]).toBeGreaterThan(menuPalette.outer[1]);

    const battlePalette = MOOD_PALETTES.battle;
    expect(battlePalette.inner[0]).toBeGreaterThan(battlePalette.inner[1]);
    expect(battlePalette.outer[0]).toBeGreaterThan(battlePalette.outer[1]);

    const shopPalette = MOOD_PALETTES.shop;
    expect(shopPalette.inner[0]).toBeGreaterThan(shopPalette.inner[1]);
  });

  it('createBackdropCanvas безопасно инициализируется и поддерживает смену настроения', () => {
    const canvas = document.createElement('canvas');
    const controller = createBackdropCanvas(canvas);

    expect(typeof controller.setMood).toBe('function');
    expect(typeof controller.triggerPulse).toBe('function');
    expect(typeof controller.spawnParticles).toBe('function');
    expect(typeof controller.resize).toBe('function');
    expect(typeof controller.destroy).toBe('function');

    // Безопасный вызов всех методов даже без 2D контекста в jsdom
    expect(() => {
      controller.setMood('boss');
      controller.triggerPulse('#ff0000');
      controller.spawnParticles(0.5, 0.5, '#f5b942', 10);
      controller.resize();
      controller.destroy();
    }).not.toThrow();
  });
});
