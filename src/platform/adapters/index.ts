import type { AdapterContext, PlatformAdapter, PlatformId } from '../types';
import { MockAdapter } from './mock';
import { OkAdapter } from './ok';
import { VkAdapter } from './vk';
import { VkPlayAdapter } from './vkplay';
import { YandexAdapter } from './yandex';

/**
 * Создаёт адаптер для определённой игровой площадки.
 */
export function createPlatformAdapter<TSave extends Record<string, unknown> = Record<string, unknown>>(
  platformId: PlatformId,
  ctx: AdapterContext<TSave>,
): PlatformAdapter<TSave> {
  switch (platformId) {
    case 'yandex':
      return new YandexAdapter<TSave>(ctx);
    case 'vk':
      return new VkAdapter<TSave>(ctx);
    case 'ok':
      return new OkAdapter<TSave>(ctx);
    case 'vkplay':
      return new VkPlayAdapter<TSave>(ctx);
    case 'mock':
    default:
      return new MockAdapter<TSave>(ctx);
  }
}

export { MockAdapter, OkAdapter, VkAdapter, VkPlayAdapter, YandexAdapter };
