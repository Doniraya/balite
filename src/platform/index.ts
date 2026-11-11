import { createPlatformBridge } from './bridge';

export { createAudioUnlockController } from './audioUnlock';
export { createPlatformBridge } from './bridge';
export { detectPlatformId, getAllUrlParams, normalizeLang, parseUrlParams } from './env';
export { readLocalSave, serializeWithinLimit, utf8ByteLength, writeLocalSave } from './storage';
export type * from './types';

export const platformBridge = createPlatformBridge();
