/**
 * Tests for NativeFileSystemBlobDriver.
 *
 * The driver itself is pure glue around an injected AudioDownloader.
 * These tests confirm:
 *   - With no downloader (the default in the MVP), every operation is
 *     a safe no-op — read returns null, write doesn't throw, remove
 *     doesn't throw. This is what ships today, so the MVP can't
 *     regress into a hard failure if the driver is instantiated
 *     prematurely.
 *   - With a downloader, write() delegates to download(url, key) and
 *     read() checks has/resolve before returning a blob with the
 *     local URI.
 *
 * Req anchor: 7.2 (local cache of pre-generated audio). The downloader
 * is the seam that turns the signed URL into on-device bytes; this
 * test verifies the contract without actually wiring `expo-file-system`
 * — that module is still held back per Task 6.3 constraints.
 */

import {
  NativeFileSystemBlobDriver,
  type AudioDownloader,
} from '../AudioCache';

function makeFakeDownloader(): AudioDownloader & {
  __store: Map<string, { uri: string; bytes: number }>;
  download: jest.Mock;
  has: jest.Mock;
  resolve: jest.Mock;
  remove: jest.Mock;
  clear: jest.Mock;
} {
  const store = new Map<string, { uri: string; bytes: number }>();
  const api = {
    __store: store,
    download: jest.fn(async (remoteUrl: string, localKey: string) => {
      const entry = { uri: `file:///cache/${localKey}.m4a`, bytes: remoteUrl.length * 10 };
      store.set(localKey, entry);
      return entry;
    }),
    has: jest.fn(async (localKey: string) => store.has(localKey)),
    resolve: jest.fn(async (localKey: string) => store.get(localKey)?.uri ?? null),
    remove: jest.fn(async (localKey: string) => {
      store.delete(localKey);
    }),
    clear: jest.fn(async () => {
      store.clear();
    }),
  };
  return api;
}

describe('NativeFileSystemBlobDriver — without downloader', () => {
  it('read always returns null (safe fallback while expo-file-system is held back)', async () => {
    const driver = new NativeFileSystemBlobDriver();
    expect(await driver.read('sentence/s1')).toBeNull();
  });

  it('write is a no-op when no downloader is injected', async () => {
    const driver = new NativeFileSystemBlobDriver();
    await expect(
      driver.write('sentence/s1', { uri: 'https://x/y.m4a', bytes: 100 }),
    ).resolves.toBeUndefined();
  });

  it('remove and clear are no-ops without a downloader', async () => {
    const driver = new NativeFileSystemBlobDriver();
    await expect(driver.remove('sentence/s1')).resolves.toBeUndefined();
    await expect(driver.clear()).resolves.toBeUndefined();
  });
});

describe('NativeFileSystemBlobDriver — with injected downloader', () => {
  it('write() calls download(remoteUrl, localKey) with the signed URL', async () => {
    const downloader = makeFakeDownloader();
    const driver = new NativeFileSystemBlobDriver({ downloader });

    await driver.write('sentence/s1', {
      uri: 'https://cdn.example.com/sign.m4a',
      bytes: 0,
    });

    expect(downloader.download).toHaveBeenCalledTimes(1);
    expect(downloader.download).toHaveBeenCalledWith(
      'https://cdn.example.com/sign.m4a',
      'sentence/s1',
    );
  });

  it('write() with no uri is a no-op — nothing to download', async () => {
    const downloader = makeFakeDownloader();
    const driver = new NativeFileSystemBlobDriver({ downloader });

    await driver.write('sentence/s1', { bytes: 0 });
    expect(downloader.download).not.toHaveBeenCalled();
  });

  it('read() returns the local URI produced by download() on a subsequent read', async () => {
    const downloader = makeFakeDownloader();
    const driver = new NativeFileSystemBlobDriver({ downloader });

    await driver.write('sentence/s1', {
      uri: 'https://cdn.example.com/sign.m4a',
      bytes: 0,
    });
    const got = await driver.read('sentence/s1');

    expect(got).not.toBeNull();
    expect(got?.uri).toBe('file:///cache/sentence/s1.m4a');
    expect(downloader.has).toHaveBeenCalledWith('sentence/s1');
    expect(downloader.resolve).toHaveBeenCalledWith('sentence/s1');
  });

  it('read() returns null when the downloader reports no entry', async () => {
    const downloader = makeFakeDownloader();
    const driver = new NativeFileSystemBlobDriver({ downloader });

    expect(await driver.read('sentence/missing')).toBeNull();
    expect(downloader.has).toHaveBeenCalledWith('sentence/missing');
    expect(downloader.resolve).not.toHaveBeenCalled();
  });

  it('remove() delegates to the downloader', async () => {
    const downloader = makeFakeDownloader();
    const driver = new NativeFileSystemBlobDriver({ downloader });

    await driver.write('sentence/s1', {
      uri: 'https://cdn.example.com/sign.m4a',
      bytes: 0,
    });
    await driver.remove('sentence/s1');

    expect(downloader.remove).toHaveBeenCalledWith('sentence/s1');
    expect(await driver.read('sentence/s1')).toBeNull();
  });

  it('clear() delegates to the downloader when present', async () => {
    const downloader = makeFakeDownloader();
    const driver = new NativeFileSystemBlobDriver({ downloader });

    await driver.write('sentence/s1', {
      uri: 'https://cdn.example.com/sign.m4a',
      bytes: 0,
    });
    await driver.clear();

    expect(downloader.clear).toHaveBeenCalledTimes(1);
    expect(await driver.read('sentence/s1')).toBeNull();
  });
});
