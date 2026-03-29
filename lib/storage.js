const { buildJsonStorage } = require('./storage-json');

let storageInstance = null;

function createStorage() {
  if (!process.env.DATABASE_URL) {
    return buildJsonStorage();
  }

  try {
    const { buildPostgresStorage } = require('./storage-postgres');
    return buildPostgresStorage(process.env.DATABASE_URL);
  } catch (error) {
    console.error('Falling back to JSON storage:', error.message);
    return buildJsonStorage();
  }
}

function getStorage() {
  if (!storageInstance) {
    storageInstance = createStorage();
  }

  return storageInstance;
}

module.exports = getStorage();
