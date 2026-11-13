// Автоматический реестр локальных аудиосэмплов из src/assets/audio/ (Story 5.1).

/** Поддерживаемые идентификаторы аудиосэмплов (музыка и SFX). */
export const AUDIO_SAMPLE_KEYS = [
  'bgm',
  'button',
  'card_hover',
  'card_select',
  'card_deselect',
  'card_deal',
  'chip_hit',
  'mult_hit',
  'relic_trigger',
  'gold',
  'booster_open',
  'consumable',
  'shatter',
  'debuff',
  'flame_surge',
  'win',
  'lose',
] as const;

/** Тип ключа аудиосэмпла. */
export type AudioSampleKey = (typeof AUDIO_SAMPLE_KEYS)[number];

const SAMPLE_KEY_SET = new Set<string>(AUDIO_SAMPLE_KEYS);

const FORMAT_PRIORITY: Record<string, number> = {
  ogg: 3,
  mp3: 2,
  wav: 1,
};

const RAW_AUDIO_MODULES = import.meta.glob<string>(
  '/src/assets/audio/*.{ogg,mp3,wav}',
  {
    eager: true,
    query: '?url',
    import: 'default',
  },
);

/**
 * Разбирает карту найденных Vite-ассетов и выбирает лучший формат для каждого ключа
 * по приоритету .ogg > .mp3 > .wav. Неизвестные файлы безопасно игнорируются.
 */
export function resolveAudioSampleRegistry(
  rawEntries: Readonly<Record<string, string>>,
): Partial<Record<AudioSampleKey, string>> {
  const bestPriority = new Map<AudioSampleKey, number>();
  const resolved: Partial<Record<AudioSampleKey, string>> = {};

  for (const [filePath, url] of Object.entries(rawEntries)) {
    if (typeof url !== 'string' || url.length === 0) continue;

    const fileName = filePath.split(/[\\/]/).pop();
    if (!fileName) continue;

    const dotIndex = fileName.lastIndexOf('.');
    if (dotIndex <= 0) continue;

    const key = fileName.slice(0, dotIndex).toLowerCase();
    const ext = fileName.slice(dotIndex + 1).toLowerCase();
    const priority = FORMAT_PRIORITY[ext] ?? 0;

    if (!SAMPLE_KEY_SET.has(key) || priority === 0) continue;

    const typedKey = key as AudioSampleKey;
    const prevPriority = bestPriority.get(typedKey) ?? -1;
    if (priority > prevPriority) {
      bestPriority.set(typedKey, priority);
      resolved[typedKey] = url;
    }
  }

  return resolved;
}

/**
 * Готовый реестр доступных в сборке аудиосэмплов.
 * Если папка src/assets/audio/ пуста, реестр пуст и не инициирует лишних сетевых запросов.
 */
export const AUDIO_SAMPLE_REGISTRY: Readonly<Partial<Record<AudioSampleKey, string>>> =
  resolveAudioSampleRegistry(RAW_AUDIO_MODULES);
