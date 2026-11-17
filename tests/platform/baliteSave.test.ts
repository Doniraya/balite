import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStandardDeck } from '../../src/engine/cards';
import { unlockAllCollection } from '../../src/engine/collection';
import { createInitialHandLevels } from '../../src/engine/handEval';
import { createRngState } from '../../src/engine/prng';
import {
  countMetaDiscoveries,
  createCompactFallbackSave,
  createInitialMetaSave,
  createPlayerSaveData,
  sanitizePlayerSaveData,
  SAVE_SCHEMA_VERSION,
  serializeRunStateToSnapshot,
} from '../../src/engine/save';
import { HAND_TYPES, type PlayerSaveData, type RunState } from '../../src/engine/types';
import {
  BALITE_CLOUD_DEBOUNCE_MS,
  BALITE_MAX_STORAGE_BYTES,
  createBalitePlatformBridge,
  loadBaliteSave,
  persistBaliteSave,
} from '../../src/platform/baliteSave';
import { trySerializeWithinLimit, utf8ByteLength } from '../../src/platform/storage';

const { vkBridgeMock } = vi.hoisted(() => ({
  vkBridgeMock: {
    isEmbedded: vi.fn(() => true),
    send: vi.fn<(_method: string, _params?: Record<string, unknown>) => Promise<Record<string, unknown>>>(
      async () => ({}),
    ),
    supportsAsync: vi.fn(async () => true),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  },
}));

vi.mock('@vkontakte/vk-bridge', () => ({
  default: vkBridgeMock,
}));

/**
 * Создаёт крупный RunState, сериализация которого гарантированно превышает 4000 байт.
 */
function createOversizedRunState(): RunState {
  const deck = createStandardDeck(1);
  return {
    version: SAVE_SCHEMA_VERSION,
    seed: 'VK-LIMIT-SEED',
    rngState: createRngState('VK-LIMIT-SEED'),
    deckId: 'b_red',
    phase: 'shop',
    previousPhase: 'cashout',
    ante: 3,
    round: 7,
    currentBlindIndex: 0,
    anteBlinds: [
      { kind: 'small', bossId: null, targetScore: 2000, reward: 3, status: 'defeated', skipTagId: 'tag_skip' },
      { kind: 'big', bossId: null, targetScore: 3000, reward: 4, status: 'upcoming', skipTagId: 'tag_coupon' },
      { kind: 'boss', bossId: 'bl_hook', targetScore: 4000, reward: 5, status: 'upcoming', skipTagId: null },
    ],
    bossUseCounts: { bl_hook: 1 },
    bossRerollsThisAnte: 0,
    activeBossDisabled: false,
    savedBossDiscards: null,
    endlessMode: false,
    probabilitiesNormal: 1,
    anteScaling: 1,
    score: 2150,
    targetScore: 2000,
    dollars: 18,
    handsLeft: 3,
    maxHands: 4,
    discardsLeft: 2,
    maxDiscards: 4,
    handSize: 8,
    tempHandSizeBonus: 0,
    maxRelics: 5,
    maxConsumables: 2,
    baseRerollCost: 5,
    interestCap: 25,
    shopSlots: 2,
    discountPercent: 0,
    editionRate: 1,
    deck,
    drawPileIds: deck.slice(8, 35).map((c) => c.id),
    handIds: deck.slice(0, 8).map((c) => c.id),
    discardPileIds: deck.slice(35).map((c) => c.id),
    relics: [
      {
        uid: 'relic_1',
        id: 'j_constellation',
        edition: 'holo',
        baseCost: 6,
        sellValue: 3,
        extraValue: 0,
        debuffed: false,
        state: { chips: 0, mult: 0, xMult: 1.4 },
      },
      {
        uid: 'relic_2',
        id: 'j_hologram',
        edition: 'base',
        baseCost: 7,
        sellValue: 3,
        extraValue: 0,
        debuffed: false,
        state: { chips: 0, mult: 0, xMult: 1.5 },
      },
    ],
    consumables: [
      {
        uid: 'cons_1',
        id: 'c_jupiter',
        kind: 'celestial',
        edition: 'base',
        baseCost: 3,
        sellValue: 1,
      },
    ],
    charters: ['v_overstock_norm', 'v_grabber'],
    pendingTags: ['tag_investment'],
    skipsCount: 1,
    handsPlayedThisRound: { Flush: 1 },
    handLevels: createInitialHandLevels(),
    lastUsedConsumableId: 'c_jupiter',
    lastPlayedHandType: 'Flush',
    shop: {
      offers: [
        {
          uid: 'offer_1',
          kind: 'relic',
          relic: {
            uid: 'relic_offer_1',
            id: 'j_blueprint',
            edition: 'base',
            baseCost: 10,
            sellValue: 5,
            extraValue: 0,
            debuffed: false,
            state: { chips: 0, mult: 0, xMult: 1 },
          },
          cost: 10,
          baseCost: 10,
          sold: false,
        },
        {
          uid: 'offer_2',
          kind: 'card',
          card: deck[0]!,
          cost: 2,
          baseCost: 2,
          sold: false,
        },
      ],
      voucher: {
        uid: 'voucher_1',
        charterId: 'v_hone',
        cost: 10,
        baseCost: 10,
        sold: false,
      },
      packs: [
        {
          uid: 'pack_1',
          packId: 'p_buffoon_normal_1',
          type: 'buffoon',
          size: 'normal',
          cost: 4,
          baseCost: 4,
          totalCards: 2,
          chooseCount: 1,
          purchased: false,
        },
      ],
      rerollCost: 5,
      tempRerollCost: null,
      rerollsUsedThisShop: 0,
    },
    shopVisits: 3,
    booster: null,
    cashout: null,
    nextCardUid: 53,
    stats: {
      bestHandScore: 2150,
      bestHandType: 'Flush',
      handsPlayed: 11,
      cardsPlayed: 42,
      discardsUsed: 5,
      cardsDiscarded: 15,
      cardsPurchased: 6,
      rerollsCount: 2,
      cardsDestroyed: 0,
      dollarsSpent: 20,
    },
  };
}

describe('baliteSave и createBalitePlatformBridge', () => {
  beforeEach(() => {
    localStorage.clear();
    delete (globalThis as Record<string, unknown>).YaGames;
    window.history.replaceState({}, '', '/');
    vkBridgeMock.isEmbedded.mockReturnValue(true);
    vkBridgeMock.send.mockReset().mockResolvedValue({});
    vkBridgeMock.supportsAsync.mockReset().mockResolvedValue(true);
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).YaGames;
    delete (globalThis as Record<string, unknown>).FAPI;
    delete (globalThis as Record<string, unknown>).API_callback;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('дебаунсит облачную запись на 1500 мс, но пишет localStorage сразу и поддерживает flushCloudSave()', async () => {
    vi.useFakeTimers();
    window.history.replaceState({}, '', '/?platform=yandex');
    const setData = vi.fn().mockResolvedValue(undefined);
    const getData = vi.fn().mockResolvedValue({});

    (globalThis as Record<string, unknown>).YaGames = {
      init: vi.fn().mockResolvedValue({
        environment: { i18n: { lang: 'ru' } },
        features: { LoadingAPI: { ready: vi.fn() }, GameplayAPI: { start: vi.fn(), stop: vi.fn() } },
        getPlayer: vi.fn().mockResolvedValue({ getData, setData }),
        on: vi.fn(() => () => {}),
      }),
    };

    expect(BALITE_CLOUD_DEBOUNCE_MS).toBe(1500);
    expect(BALITE_MAX_STORAGE_BYTES).toBe(2200);

    const bridge = createBalitePlatformBridge({
      localBackupKey: 'balite_save_debounce_test',
    });
    await bridge.init();

    const meta1 = createInitialMetaSave(1000, { lang: 'ru' });
    const save1 = createPlayerSaveData(meta1, null, 1, 1000);
    const meta2 = {
      ...meta1,
      discoveredRelics: ['j_joker'] as const,
    };
    const save2 = createPlayerSaveData(meta2, null, 2, 1500);

    const p1 = persistBaliteSave(bridge, save1);
    const p2 = persistBaliteSave(bridge, save2);

    // В localStorage уже лежит последняя ревизия, а облако ждёт 1500 мс
    expect(JSON.parse(localStorage.getItem('balite_save_debounce_test') || '{}').revision).toBe(2);
    expect(setData).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1499);
    expect(setData).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await expect(Promise.all([p1, p2])).resolves.toEqual([true, true]);
    expect(setData).toHaveBeenCalledTimes(1);
    expect(setData).toHaveBeenLastCalledWith(save2, true);

    // Третья запись с принудительным flushCloudSave уходит сразу
    const save3 = createPlayerSaveData(
      { ...meta2, stats: { ...meta2.stats, runsStarted: 1 } },
      null,
      3,
      2000,
    );
    const p3 = persistBaliteSave(bridge, save3);
    expect(setData).toHaveBeenCalledTimes(1);
    await expect(bridge.flushCloudSave()).resolves.toBe(true);
    await expect(p3).resolves.toBe(true);
    expect(setData).toHaveBeenCalledTimes(2);
    expect(setData).toHaveBeenLastCalledWith(save3, true);

    bridge.audio.dispose();
  });

  it('на площадке VK с лимитом 2200 байт на ключ укладывает каждый ключ в <= 2200 байт и синхронизирует и MetaSave, и activeRun между устройствами', async () => {
    window.history.replaceState({}, '', '/?platform=vk');

    const vkStorage = new Map<string, string>();
    vkBridgeMock.send.mockImplementation(async (method: string, params?: Record<string, unknown>) => {
      if (method === 'VKWebAppStorageSet') {
        const key = String(params?.key ?? '');
        const value = String(params?.value ?? '');
        vkStorage.set(key, value);
        return { result: true };
      }
      if (method === 'VKWebAppStorageGet') {
        const reqKeys = Array.isArray(params?.keys) ? (params.keys as string[]) : [];
        return {
          keys: reqKeys
            .filter((k) => vkStorage.has(k))
            .map((k) => ({ key: k, value: vkStorage.get(k)! })),
        };
      }
      return {};
    });

    const bridge = createBalitePlatformBridge({
      localBackupKey: 'balite_vk_local_test',
      cloudDebounceMs: 0,
    });
    await bridge.init();

    const initialMeta = createInitialMetaSave(5000, { unlockedDecks: ['b_red', 'b_blue'] });
    const meta = {
      ...initialMeta,
      discoveredRelics: ['j_constellation', 'j_hologram'] as const,
      stats: {
        ...initialMeta.stats,
        runsStarted: 3,
        runsWon: 1,
        highestAnte: 8,
        bestHandScore: 15000,
        totalHandsPlayed: 70,
      },
    };
    const runState = createOversizedRunState();
    const snapshot = serializeRunStateToSnapshot(runState, 11, 5000);
    const fullSave: PlayerSaveData = createPlayerSaveData(meta, snapshot, 11, 5000);

    // Полный JSON > 2200 байт, а trySerializeWithinLimit с createCompactFallbackSave укладывается в <= 2200 байт
    expect(utf8ByteLength(JSON.stringify(fullSave))).toBeGreaterThan(2200);
    const compactJson = trySerializeWithinLimit(fullSave, 2200, createCompactFallbackSave);
    expect(compactJson).not.toBeNull();
    expect(utf8ByteLength(compactJson!)).toBeLessThanOrEqual(2200);
    expect(compactJson!.length).toBeLessThanOrEqual(2200);

    await expect(persistBaliteSave(bridge, fullSave)).resolves.toBe(true);
    expect(vkStorage.has('balite_save_v1')).toBe(true);
    for (const [, storedVal] of vkStorage) {
      expect(storedVal.length).toBeLessThanOrEqual(2200);
      expect(utf8ByteLength(storedVal)).toBeLessThanOrEqual(2200);
    }

    const parsedPrimary = JSON.parse(vkStorage.get('balite_save_v1')!) as PlayerSaveData;
    expect(parsedPrimary.activeRun).toBeNull();
    expect(parsedPrimary.revision).toBe(11);
    expect(parsedPrimary.meta.unlockedDecks).toEqual(['b_red', 'b_blue']);
    expect(parsedPrimary.meta.discoveredRelics).toEqual(['j_constellation', 'j_hologram']);

    // На том же устройстве loadBaliteSave восстанавливает полный activeRun
    const reloadedSameDevice = await loadBaliteSave(bridge);
    expect(reloadedSameDevice.revision).toBe(11);
    expect(reloadedSameDevice.activeRun).toEqual(snapshot);

    // На новом устройстве (пустой localStorage) loadBaliteSave восстанавливает и MetaSave, и чанкованный activeRun из облака VK!
    localStorage.clear();
    const freshDeviceBridge = createBalitePlatformBridge({
      localBackupKey: 'balite_vk_local_fresh_device',
    });
    await freshDeviceBridge.init();
    const loadedNewDevice = await loadBaliteSave(freshDeviceBridge);
    expect(loadedNewDevice.revision).toBe(11);
    expect(loadedNewDevice.meta.unlockedDecks).toEqual(['b_red', 'b_blue']);
    expect(loadedNewDevice.meta.stats.bestHandScore).toBe(15000);
    expect(loadedNewDevice.activeRun).toEqual(snapshot);

    // Даже если чанки activeRun отсутствуют в облаке, основной ключ безопасно отдаёт весь MetaSave
    vkStorage.delete('balite_save_v1_r0');
    localStorage.clear();
    const fallbackDeviceBridge = createBalitePlatformBridge({
      localBackupKey: 'balite_vk_local_fallback_device',
    });
    await fallbackDeviceBridge.init();
    const loadedWithoutChunks = await loadBaliteSave(fallbackDeviceBridge);
    expect(loadedWithoutChunks.revision).toBe(11);
    expect(loadedWithoutChunks.meta.unlockedDecks).toEqual(['b_red', 'b_blue']);
    expect(loadedWithoutChunks.activeRun).toBeNull();

    bridge.audio.dispose();
    freshDeviceBridge.audio.dispose();
    fallbackDeviceBridge.audio.dispose();
  });

  it('возвращает валидное стартовое сохранение на первом запуске и защищает более свежий локальный сейв от старого облака', async () => {
    window.history.replaceState({}, '', '/?platform=yandex&lang=en');
    const getData = vi.fn().mockResolvedValue({});

    (globalThis as Record<string, unknown>).YaGames = {
      init: vi.fn().mockResolvedValue({
        environment: { i18n: { lang: 'en' } },
        features: { LoadingAPI: { ready: vi.fn() }, GameplayAPI: { start: vi.fn(), stop: vi.fn() } },
        getPlayer: vi.fn().mockResolvedValue({
          getData,
          setData: vi.fn().mockResolvedValue(undefined),
        }),
        on: vi.fn(() => () => {}),
      }),
    };

    const bridge1 = createBalitePlatformBridge({ localBackupKey: 'balite_empty_init_test' });
    await bridge1.init();

    const initialSave = await loadBaliteSave(bridge1, { nowMs: 9000 });
    expect(initialSave.revision).toBe(0);
    expect(initialSave.updatedAt).toBe(9000);
    expect(initialSave.meta.settings.lang).toBe('en');
    expect(initialSave.activeRun).toBeNull();

    // Локальный сейв ревизии 9 не затирается облаком ревизии 4
    const localMeta = createInitialMetaSave(8000, { lang: 'ru', animationSpeed: 4 });
    const localRun = serializeRunStateToSnapshot(createOversizedRunState(), 9, 8000);
    const localSave = createPlayerSaveData(localMeta, localRun, 9, 8000);
    localStorage.setItem('balite_conflict_test', JSON.stringify(localSave));

    getData.mockResolvedValueOnce(
      createPlayerSaveData(
        createInitialMetaSave(2000, { lang: 'en', animationSpeed: 1 }),
        null,
        4,
        2000,
      ),
    );

    const bridge2 = createBalitePlatformBridge({ localBackupKey: 'balite_conflict_test' });
    await bridge2.init();
    const resolved = await loadBaliteSave(bridge2);

    expect(resolved.revision).toBe(9);
    expect(resolved.meta.settings.lang).toBe('ru');
    expect(resolved.activeRun).toEqual(localRun);

    bridge1.audio.dispose();
    bridge2.audio.dispose();
  });

  it('поддерживает flush: true в persistBaliteSave, ок-адаптер с лимитом 2200 байт на ключ и безопасное восстановление из битого localStorage', async () => {
    window.history.replaceState({}, '', '/?platform=ok');

    const okStorage = new Map<string, string>();
    (globalThis as Record<string, unknown>).FAPI = {
      init: vi.fn((_s: string, _c: string, onSuccess?: () => void) => onSuccess?.()),
      Client: {
        call: vi.fn(
          (
            params: Record<string, unknown>,
            cb: (status: string, data: unknown) => void,
          ) => {
            if (params.method === 'storage.set') {
              okStorage.set(String(params.key ?? ''), String(params.value ?? ''));
              cb('ok', { success: true });
            } else if (params.method === 'storage.get') {
              const reqKeys = Array.isArray(params.keys) ? (params.keys as string[]) : [];
              const dataObj: Record<string, string> = {};
              for (const k of reqKeys) {
                if (okStorage.has(k)) dataObj[k] = okStorage.get(k)!;
              }
              cb('ok', { data: dataObj });
            }
          },
        ),
      },
      UI: {},
    };

    const bridge = createBalitePlatformBridge({
      localBackupKey: 'balite_ok_save_test',
    });
    await bridge.init();

    const meta = createInitialMetaSave(7000, { unlockedDecks: ['b_red', 'b_yellow'] });
    const snapshot = serializeRunStateToSnapshot(createOversizedRunState(), 12, 7000);
    const fullSave = createPlayerSaveData(meta, snapshot, 12, 7000);

    // Немедленный сброс с опцией flush: true без ожидания 1500 мс
    await expect(persistBaliteSave(bridge, fullSave, { flush: true })).resolves.toBe(true);
    for (const [, val] of okStorage) {
      expect(val.length).toBeLessThanOrEqual(2200);
      expect(utf8ByteLength(val)).toBeLessThanOrEqual(2200);
    }
    const okPrimaryValue = okStorage.get('balite_save_v1')!;
    const cloudObj = JSON.parse(okPrimaryValue) as PlayerSaveData;
    expect(cloudObj.activeRun).toBeNull();
    expect(cloudObj.meta.unlockedDecks).toEqual(['b_red', 'b_yellow']);

    // Имитируем перезагрузку страницы при повреждённом JSON в localStorage —
    // новый экземпляр bridge безопасно восстанавливает и MetaSave, и activeRun из облака OK
    localStorage.setItem('balite_ok_save_test', '{broken_json');
    const reloadedBridge = createBalitePlatformBridge({
      localBackupKey: 'balite_ok_save_test',
    });
    await reloadedBridge.init();
    const recovered = await loadBaliteSave(reloadedBridge);
    expect(recovered.revision).toBe(12);
    expect(recovered.meta.unlockedDecks).toEqual(['b_red', 'b_yellow']);
    expect(recovered.activeRun).toEqual(snapshot);
    reloadedBridge.audio.dispose();

    // При экстремально малом лимите, куда не влезает даже compactFallback, облако не затирается пустым '{}'
    const tinyBridge = createBalitePlatformBridge({
      localBackupKey: 'balite_tiny_limit_test',
      maxStorageBytes: 50,
    });
    await tinyBridge.init();
    const prevStored = okStorage.get('balite_save_v1');
    await expect(persistBaliteSave(tinyBridge, fullSave, { flush: true })).resolves.toBe(false);
    expect(okStorage.get('balite_save_v1')).toBe(prevStored);

    bridge.audio.dispose();
    tinyBridge.audio.dispose();
  });

  it('при 100% открытой Коллекции (unlockAllCollection) и полной статистике укладывает каждый ключ облака в <= 2200 байт и полностью восстанавливает открытия и activeRun', async () => {
    window.history.replaceState({}, '', '/?platform=vk');

    const vkStorage = new Map<string, string>();
    vkBridgeMock.send.mockImplementation(async (method: string, params?: Record<string, unknown>) => {
      if (method === 'VKWebAppStorageSet') {
        vkStorage.set(String(params?.key ?? ''), String(params?.value ?? ''));
        return { result: true };
      }
      if (method === 'VKWebAppStorageGet') {
        const reqKeys = Array.isArray(params?.keys) ? (params.keys as string[]) : [];
        return {
          keys: reqKeys
            .filter((k) => vkStorage.has(k))
            .map((k) => ({ key: k, value: vkStorage.get(k)! })),
        };
      }
      return {};
    });

    const bridge = createBalitePlatformBridge({
      localBackupKey: 'balite_vk_unlock_all_test',
      cloudDebounceMs: 0,
    });
    await bridge.init();

    const baseMeta = createInitialMetaSave(9000, {
      lang: 'ru',
      animationSpeed: 2,
      crtMode: 'light',
      tutorialCompleted: true,
      tutorialStep: 21,
    });
    const unlockedMeta = unlockAllCollection(baseMeta);
    const allHandCounts = Object.fromEntries(HAND_TYPES.map((hand, idx) => [hand, idx + 3]));
    const richMeta = {
      ...unlockedMeta,
      stats: {
        ...unlockedMeta.stats,
        runsStarted: 25,
        runsWon: 8,
        highestAnte: 10,
        highestRound: 30,
        bestHandScore: 145000,
        maxDollars: 450,
        bestWinStreak: 5,
        currentWinStreak: 3,
        totalHandsPlayed: 310,
        handPlayCounts: allHandCounts,
        totalMoneySpent: 2800,
        totalShopRerolls: 60,
        totalCelestialsUsed: 55,
      },
    };

    const snapshot = serializeRunStateToSnapshot(createOversizedRunState(), 19, 9000);
    const fullSave: PlayerSaveData = createPlayerSaveData(richMeta, snapshot, 19, 9000);

    const compactSave = createCompactFallbackSave(fullSave);
    const serializedCompact = trySerializeWithinLimit(compactSave, BALITE_MAX_STORAGE_BYTES);
    expect(serializedCompact).not.toBeNull();
    expect(utf8ByteLength(serializedCompact!)).toBeLessThanOrEqual(BALITE_MAX_STORAGE_BYTES);
    expect(utf8ByteLength(serializedCompact!)).toBeLessThanOrEqual(2500);

    // После санитизации все открытия 100% коллекции полностью восстанавливаются
    const sanitizedCompact = sanitizePlayerSaveData(JSON.parse(serializedCompact!) as unknown);
    expect(countMetaDiscoveries(sanitizedCompact.meta!)).toBe(139);
    expect(sanitizedCompact.meta?.unlockedDecks).toEqual(unlockedMeta.unlockedDecks);
    expect(sanitizedCompact.meta?.discoveredRelics).toEqual(unlockedMeta.discoveredRelics);
    expect(sanitizedCompact.meta?.discoveredConsumables).toEqual(unlockedMeta.discoveredConsumables);
    expect(sanitizedCompact.meta?.discoveredCharters).toEqual(unlockedMeta.discoveredCharters);
    expect(sanitizedCompact.meta?.discoveredBosses).toEqual(unlockedMeta.discoveredBosses);
    expect(sanitizedCompact.meta?.discoveredTags).toEqual(unlockedMeta.discoveredTags);
    expect(sanitizedCompact.meta?.discoveredMonsters).toEqual(unlockedMeta.discoveredMonsters);
    expect(sanitizedCompact.meta?.discoveredPacks).toEqual(unlockedMeta.discoveredPacks);
    expect(sanitizedCompact.meta?.discoveredEditions).toEqual(unlockedMeta.discoveredEditions);
    expect(sanitizedCompact.meta?.seenCollectionItems).toEqual(unlockedMeta.seenCollectionItems);
    expect(sanitizedCompact.meta?.stats.totalMoneySpent).toBe(2800);
    expect(sanitizedCompact.meta?.stats.totalShopRerolls).toBe(60);
    expect(sanitizedCompact.meta?.stats.totalCelestialsUsed).toBe(55);

    // Сохранение через мост в облако VK проходит успешно в рамках 2200 байт на каждый ключ
    await expect(persistBaliteSave(bridge, fullSave)).resolves.toBe(true);
    for (const [, storedVal] of vkStorage) {
      expect(storedVal.length).toBeLessThanOrEqual(BALITE_MAX_STORAGE_BYTES);
      expect(utf8ByteLength(storedVal)).toBeLessThanOrEqual(BALITE_MAX_STORAGE_BYTES);
    }

    // На чистом устройстве из облачного сейва VK восстанавливается вся 100% Коллекция и activeRun
    localStorage.clear();
    const freshDeviceBridge = createBalitePlatformBridge({
      localBackupKey: 'balite_vk_unlock_all_fresh_device',
    });
    await freshDeviceBridge.init();
    const loadedFromCloud = await loadBaliteSave(freshDeviceBridge);
    expect(loadedFromCloud.revision).toBe(19);
    expect(loadedFromCloud.activeRun).toEqual(snapshot);
    expect(countMetaDiscoveries(loadedFromCloud.meta)).toBe(139);
    expect(loadedFromCloud.meta.unlockedDecks).toEqual(unlockedMeta.unlockedDecks);
    expect(loadedFromCloud.meta.discoveredRelics).toEqual(unlockedMeta.discoveredRelics);
    expect(loadedFromCloud.meta.discoveredConsumables).toEqual(unlockedMeta.discoveredConsumables);
    expect(loadedFromCloud.meta.discoveredCharters).toEqual(unlockedMeta.discoveredCharters);
    expect(loadedFromCloud.meta.discoveredBosses).toEqual(unlockedMeta.discoveredBosses);
    expect(loadedFromCloud.meta.discoveredTags).toEqual(unlockedMeta.discoveredTags);
    expect(loadedFromCloud.meta.discoveredMonsters).toEqual(unlockedMeta.discoveredMonsters);
    expect(loadedFromCloud.meta.discoveredPacks).toEqual(unlockedMeta.discoveredPacks);
    expect(loadedFromCloud.meta.discoveredEditions).toEqual(unlockedMeta.discoveredEditions);
    expect(loadedFromCloud.meta.seenCollectionItems).toEqual(unlockedMeta.seenCollectionItems);
    expect(loadedFromCloud.meta.stats.totalMoneySpent).toBe(2800);
    expect(loadedFromCloud.meta.stats.totalShopRerolls).toBe(60);
    expect(loadedFromCloud.meta.stats.totalCelestialsUsed).toBe(55);

    bridge.audio.dispose();
    freshDeviceBridge.audio.dispose();
  });
});
