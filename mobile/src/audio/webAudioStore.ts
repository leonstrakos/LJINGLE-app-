const DATABASE = 'ljingle-audio-files';
const STORE = 'audio';
const PREFIX = 'ljingle-web-audio:';
const urls = new Map<string, string>();

function openStore() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function persistWebAudio(sourceUri: string) {
  const blob = await fetch(sourceUri).then((response) => response.blob());
  const key = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const database = await openStore();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).put(blob, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
  return `${PREFIX}${key}`;
}

export async function hydrateWebAudio(storedUri: string) {
  if (!storedUri.startsWith(PREFIX)) return storedUri;
  const cached = urls.get(storedUri);
  if (cached) return cached;
  const key = storedUri.slice(PREFIX.length);
  const database = await openStore();
  const blob = await new Promise<Blob | undefined>((resolve, reject) => {
    const request = database.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    request.onsuccess = () => resolve(request.result as Blob | undefined);
    request.onerror = () => reject(request.error);
  });
  database.close();
  if (!blob) throw new Error('Spremljena audio datoteka više nije dostupna.');
  const url = URL.createObjectURL(blob);
  urls.set(storedUri, url);
  return url;
}
