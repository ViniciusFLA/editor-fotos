const DB_NAME = 'creative-editor';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

const LAST_PROJECT_ID_KEY = 'creative-editor:lastProjectId';

export function getLastProjectId(): string | null {
  try {
    return localStorage.getItem(LAST_PROJECT_ID_KEY);
  } catch {
    return null;
  }
}

export function setLastProjectId(id: string): void {
  try {
    localStorage.setItem(LAST_PROJECT_ID_KEY, id);
  } catch {
    // localStorage may be unavailable
  }
}

interface ProjectRecord {
  id: string;
  name: string;
  data: string;
  updatedAt: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Database upgrade blocked. Close other tabs and try again.'));
  });
}

export async function saveProjectData(
  id: string,
  name: string,
  data: string,
): Promise<void> {
  const db = await openDB();
  const record: ProjectRecord = {
    id,
    name,
    data,
    updatedAt: new Date().toISOString(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(record);

    tx.oncomplete = () => {
      db.close();
      setLastProjectId(id);
      resolve();
    };

    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('Transaction failed'));
    };

    tx.onabort = () => {
      db.close();
      reject(new Error('Transaction aborted. Storage may be full or quota exceeded.'));
    };
  });
}

export async function loadProjectData(id: string): Promise<ProjectRecord | null> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      db.close();
      resolve(request.result ?? null);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

export async function deleteProjectData(id: string): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);

    tx.oncomplete = () => {
      db.close();
      resolve();
    };

    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('Transaction failed'));
    };

    tx.onabort = () => {
      db.close();
      reject(new Error('Transaction aborted. Storage may be full or quota exceeded.'));
    };
  });
}

export interface ProjectListItem {
  id: string;
  name: string;
  updatedAt: string;
}

export async function listProjects(): Promise<ProjectListItem[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.openCursor();
    const results: ProjectListItem[] = [];

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        results.push({
          id: cursor.value.id,
          name: cursor.value.name,
          updatedAt: cursor.value.updatedAt,
        });
        cursor.continue();
      } else {
        db.close();
        resolve(results);
      }
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}
