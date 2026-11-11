import {
  createCompactFallbackSave,
  createInitialMetaSave,
  createPlayerSaveData,
  mergePlayerSaveData,
  sanitizePlayerSaveData,
} from '../engine/save';
import type { EngineLang, PlayerSaveData } from '../engine/types';
import { createPlatformBridge } from './bridge';
import type { PlatformBridge, PlatformBridgeConfig } from './types';

/**
 * Стандартный интервал группировки облачных сохранений (1.5 с) для соблюдения лимита SDK.
 */
export const BALITE_CLOUD_DEBOUNCE_MS = 1500;

/**
 * Жёсткий порог размера облачного сохранения в байтах UTF-8 (лимит VK/OK).
 */
export const BALITE_MAX_STORAGE_BYTES = 4000;

/**
 * Параметры немедленной или отложенной записи сохранения игры.
 */
export interface PersistBaliteSaveOptions {
  /** При true немедленно отправляет облачное сохранение через flushCloudSave(). */
  readonly flush?: boolean;
}

/**
 * Опции загрузки и инициализации сохранения игрока.
 */
export interface LoadBaliteSaveOptions {
  /** Метка времени для стартового профиля при первом запуске. */
  readonly nowMs?: number;
  /** Язык по умолчанию при первом запуске, если не передан платформой. */
  readonly defaultLang?: EngineLang;
}

/**
 * Создаёт преднастроенный экземпляр PlatformBridge для сохранений Balite:
 * дебаунс облака 1500 мс, compactFallback для лимита 4000 байт,
 * санитизация схемы и монотонное слияние по revision/updatedAt.
 */
export function createBalitePlatformBridge(
  overrides: Partial<PlatformBridgeConfig<PlayerSaveData>> = {},
): PlatformBridge<PlayerSaveData> {
  return createPlatformBridge<PlayerSaveData>({
    storageKey: 'balite_save_v1',
    localBackupKey: 'balite_platform_save_v1',
    maxStorageBytes: BALITE_MAX_STORAGE_BYTES,
    cloudDebounceMs: BALITE_CLOUD_DEBOUNCE_MS,
    compactFallback: createCompactFallbackSave,
    mergeSave: mergePlayerSaveData,
    sanitizeSave: sanitizePlayerSaveData,
    ...overrides,
  });
}

/**
 * Записывает полное сохранение Balite: синхронно в localStorage и с дебаунсом (или немедленным сбросом) в облако.
 */
export async function persistBaliteSave(
  bridge: PlatformBridge<PlayerSaveData>,
  saveData: PlayerSaveData,
  options: PersistBaliteSaveOptions = {},
): Promise<boolean> {
  const savePromise = bridge.savePlayerData(saveData);
  if (options.flush) {
    const flushed = await bridge.flushCloudSave();
    const saved = await savePromise;
    return flushed && saved;
  }
  return savePromise;
}

/**
 * Загружает, объединяет и санитизирует сохранение Balite из локального резерва и облака площадки,
 * гарантируя возврат полного валидного PlayerSaveData даже при первом запуске или битых данных.
 */
export async function loadBaliteSave(
  bridge: PlatformBridge<PlayerSaveData>,
  options: LoadBaliteSaveOptions = {},
): Promise<PlayerSaveData> {
  const nowMs =
    typeof options.nowMs === 'number' && Number.isFinite(options.nowMs) && options.nowMs >= 0
      ? Math.floor(options.nowMs)
      : Date.now();

  const rawLoaded = await bridge.loadPlayerData();
  const sanitized = sanitizePlayerSaveData(rawLoaded);

  const meta =
    sanitized.meta ??
    createInitialMetaSave(nowMs, {
      lang: options.defaultLang ?? bridge.getLanguage(),
      revision: sanitized.revision ?? 0,
    });

  const revision = sanitized.revision ?? meta.revision;
  const updatedAt = sanitized.updatedAt ?? meta.updatedAt;
  const activeRun = sanitized.activeRun ?? null;

  return createPlayerSaveData(meta, activeRun, revision, updatedAt);
}
