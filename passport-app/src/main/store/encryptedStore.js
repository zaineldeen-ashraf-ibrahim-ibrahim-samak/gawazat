const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');
const { makeVoyage, makeAppSettings } = require('../../shared/entities');
const logger = require('../services/logger');

/**
 * Encrypted JSON store for all application state
 * Uses Electron's safeStorage for at-rest encryption (DPAPI on Windows)
 */
class EncryptedStore {
  constructor() {
    this.storePath = path.join(app.getPath('userData'), 'store.enc');
    this.state = this.getDefaultState();
    this.saveTimeout = null;
    this.saveDebouncedMs = 200;
  }

  getDefaultState() {
    return {
      schemaVersion: 1,
      voyage: null,
      manifest: [],
      scan_events: [],
      boarding_records: {},
      pending_approval: [],
      settings: makeAppSettings(),
    };
  }

  async load() {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Encryption is not available on this system');
    }

    if (fs.existsSync(this.storePath)) {
      try {
        const encrypted = fs.readFileSync(this.storePath);
        const decrypted = safeStorage.decryptString(encrypted);
        this.state = JSON.parse(decrypted);
        logger.info('Store loaded from disk');
      } catch (err) {
        logger.error('Failed to load store:', err.message);
        // Fall back to default state
        this.state = this.getDefaultState();
      }
    } else {
      // Initialize with default state
      this.state = this.getDefaultState();
      await this.save();
      logger.info('Store initialized with defaults');
    }
  }

  async save() {
    try {
      const json = JSON.stringify(this.state);
      const encrypted = safeStorage.encryptString(json);
      
      // Atomic write: write to temp file then rename
      const tempPath = this.storePath + '.tmp';
      fs.writeFileSync(tempPath, encrypted);
      fs.renameSync(tempPath, this.storePath);
      
      logger.info('Store saved');
    } catch (err) {
      logger.error('Failed to save store:', err.message);
      throw err;
    }
  }

  /**
   * Get a frozen snapshot of the current state
   */
  getState() {
    return Object.freeze(JSON.parse(JSON.stringify(this.state)));
  }

  /**
   * Mutate state and schedule auto-save
   */
  mutate(fn) {
    fn(this.state);
    this.scheduleSave();
  }

  /**
   * Schedule save with debounce
   */
  scheduleSave() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(async () => {
      try {
        await this.save();
      } catch (err) {
        logger.error('Debounced save failed:', err.message);
      }
    }, this.saveDebouncedMs);
  }

  /**
   * Force immediate save
   */
  async forceSave() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    await this.save();
  }
}

module.exports = { EncryptedStore };
