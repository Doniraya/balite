import { describe, expect, it } from 'vitest';
import {
  detectPlatformId,
  getAllUrlParams,
  normalizeLang,
  parseUrlParams,
} from '../../src/platform/env';

describe('parseUrlParams', () => {
  it('приводит ключи к нижнему регистру и декодирует значения с "+"', () => {
    expect(parseUrlParams('?Platform=VK&User_Name=Ivan+Ivanov&Msg=%D0%BF%D1%80%D0%B8%D0%B2%D0%B5%D1%82')).toEqual({
      platform: 'VK',
      user_name: 'Ivan Ivanov',
      msg: 'привет',
    });
  });

  it('сохраняет ключи без "=" с пустой строкой и не падает на битом percent-encoding', () => {
    expect(parseUrlParams('#debug&bad=%E0%A4%A&empty=')).toEqual({
      debug: '',
      bad: '%E0%A4%A',
      empty: '',
    });
  });
});

describe('getAllUrlParams', () => {
  it('отдаёт приоритет search перед hash и парсит hash только при наличии "="', () => {
    expect(getAllUrlParams('?platform=vk&lang=en', '#lang=ru&debug')).toEqual({
      platform: 'vk',
      lang: 'en',
      debug: '',
    });

    expect(getAllUrlParams('?foo=1', '#yandex')).toEqual({
      foo: '1',
    });
  });
});

describe('normalizeLang', () => {
  it('корректно преобразует числовые коды и языки СНГ/мира', () => {
    expect(normalizeLang('0')).toBe('ru');
    expect(normalizeLang('1')).toBe('ru');
    expect(normalizeLang('2')).toBe('ru');
    expect(normalizeLang('3')).toBe('en');

    expect(normalizeLang('ru-RU')).toBe('ru');
    expect(normalizeLang('be')).toBe('ru');
    expect(normalizeLang('kk_KZ')).toBe('ru');
    expect(normalizeLang('kz')).toBe('ru');
    expect(normalizeLang('uk')).toBe('ru');
    expect(normalizeLang('ua')).toBe('ru');
    expect(normalizeLang('uz')).toBe('ru');

    expect(normalizeLang('en-US')).toBe('en');
    expect(normalizeLang('de-DE')).toBe('en');
  });

  it('откатывается на navigatorLang и затем на "ru"', () => {
    expect(normalizeLang('', 'en-GB')).toBe('en');
    expect(normalizeLang(null, 'kk')).toBe('ru');
    expect(normalizeLang(undefined, '')).toBe('ru');
  });
});

describe('detectPlatformId', () => {
  it('учитывает явный ?platform с высшим приоритетом', () => {
    expect(detectPlatformId({ platform: 'yandex', vk_app_id: '1' })).toBe('yandex');
    expect(detectPlatformId({ platform: 'vk' })).toBe('vk');
    expect(detectPlatformId({ platform: 'ok' })).toBe('ok');
    expect(detectPlatformId({ platform: 'vkplay' })).toBe('vkplay');
    expect(detectPlatformId({ platform: 'mock' }, { YaGames: {} })).toBe('mock');
  });

  it('определяет платформу по глобальным SDK-объектам и WebView-мостам', () => {
    expect(detectPlatformId({}, { YaGames: {} })).toBe('yandex');
    expect(detectPlatformId({}, { FAPI: {} })).toBe('ok');
    expect(detectPlatformId({}, { iframeApi: {} })).toBe('vkplay');
    expect(detectPlatformId({}, { AndroidBridge: {} })).toBe('vk');
    expect(
      detectPlatformId({}, { webkit: { messageHandlers: { VKWebAppClose: {} } } }),
    ).toBe('vk');
  });

  it('определяет платформу по URL-параметрам и hash', () => {
    expect(detectPlatformId({ vk_app_id: '123' })).toBe('vk');
    expect(detectPlatformId({ api_id: '1', viewer_id: '2' })).toBe('vk');
    expect(detectPlatformId({ api_server: 'https://api.ok.ru/' })).toBe('ok');
    expect(detectPlatformId({ sig: 's', session_key: 'k', logged_user_id: 'u' })).toBe('ok');
    expect(detectPlatformId({ vkplay_appid: '42' })).toBe('vkplay');
    expect(detectPlatformId({ app_id: '77' })).toBe('vkplay');
    expect(detectPlatformId({ yandex: '' })).toBe('yandex');
    expect(detectPlatformId({}, { location: { hash: '#yandex' } })).toBe('yandex');
  });

  it('определяет платформу по хосту/referrer и отсекает ложные подстроки доменов', () => {
    expect(detectPlatformId({}, { location: { hostname: 'yandex.ru' } })).toBe('yandex');
    expect(detectPlatformId({}, {}, 'playhop.com')).toBe('yandex');
    expect(detectPlatformId({}, { location: { hostname: 'm.vk.com' } })).toBe('vk');
    expect(detectPlatformId({}, {}, 'vk.ru')).toBe('vk');
    expect(detectPlatformId({}, { location: { hostname: 'app.vk-apps.com' } })).toBe('vk');
    expect(detectPlatformId({}, {}, 'apiok.ru')).toBe('ok');
    expect(detectPlatformId({}, { location: { hostname: 'vkplay.ru' } })).toBe('vkplay');

    // Ложноположительные подстроки не должны определяться как соцсети
    expect(detectPlatformId({}, { location: { hostname: 'evil-vk.com' } })).toBe('mock');
    expect(detectPlatformId({}, {}, 'myvk.ru')).toBe('mock');
    expect(detectPlatformId({}, { location: { hostname: 'mybook.ru' } })).toBe('mock');
    expect(detectPlatformId({}, { location: { hostname: 'yandex.evil.com' } })).toBe('mock');
    expect(detectPlatformId({}, { location: { hostname: 'foo.vkplay.evil.com' } })).toBe('mock');
    expect(detectPlatformId({ api_server: 'https://notok.ru/' })).toBe('mock');
    expect(detectPlatformId({ app_id: '77' }, { location: { hostname: 'games.yandex.ru' } })).toBe('yandex');
    expect(detectPlatformId({}, {}, 'localhost')).toBe('mock');
  });
});
