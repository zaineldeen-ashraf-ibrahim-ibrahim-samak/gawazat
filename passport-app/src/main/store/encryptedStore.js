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
    this.plainPath = path.join(app.getPath('userData'), 'store.json');
    this.state = this.getDefaultState();
    this.saveTimeout = null;
    this.saveDebouncedMs = 200;
    this.encryptionAvailable = false;
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
    try {
      this.encryptionAvailable = safeStorage.isEncryptionAvailable();
    } catch (err) {
      this.encryptionAvailable = false;
      logger.warn('safeStorage check failed: ' + err.message);
    }
    if (!this.encryptionAvailable) {
      logger.warn('Encryption unavailable — falling back to plaintext store');
    }

    const encryptedPath = this.storePath;
    const plainPath = this.plainPath;

    if (this.encryptionAvailable && fs.existsSync(encryptedPath)) {
      try {
        const encrypted = fs.readFileSync(encryptedPath);
        const decrypted = safeStorage.decryptString(encrypted);
        this.state = JSON.parse(decrypted);
        this._ensureSettingsDefaults();
        logger.info('Store loaded (encrypted)');
        return;
      } catch (err) {
        logger.error('Failed to load encrypted store: ' + err.message);
      }
    }

    if (fs.existsSync(plainPath)) {
      try {
        this.state = JSON.parse(fs.readFileSync(plainPath, 'utf-8'));
        this._ensureSettingsDefaults();
        logger.info('Store loaded (plaintext)');
        return;
      } catch (err) {
        logger.error('Failed to load plaintext store: ' + err.message);
      }
    }

    this.state = this.getDefaultState();
    try {
      await this.save();
      logger.info('Store initialized with defaults');
    } catch (err) {
      logger.error('Initial store save failed: ' + err.message);
    }
  }

  _ensureSettingsDefaults() {
    if (!this.state.settings) {
      this.state.settings = this.getDefaultState().settings;
    }
    const { DEFAULT_FIELD_REQUIREMENTS } = require('../../shared/fieldRequirements');
    if (this.state.settings.fieldRequirements === undefined) {
      this.state.settings.fieldRequirements = { ...DEFAULT_FIELD_REQUIREMENTS };
    }
    if (this.state.settings.geminiNoticeAcknowledged === undefined) {
      this.state.settings.geminiNoticeAcknowledged = false;
    }
    // Also patch in memory session defaults for duplication audit if needed
    if (!this.state.session) {
      this.state.session = { duplicateDecisionsAudit: [] };
    }
  }

  async save() {
    try {
      const json = JSON.stringify(this.state);
      let targetPath;
      let payload;
      if (this.encryptionAvailable) {
        targetPath = this.storePath;
        payload = safeStorage.encryptString(json);
      } else {
        targetPath = this.plainPath;
        payload = json;
      }
      const tempPath = targetPath + '.tmp';
      fs.writeFileSync(tempPath, payload);
      fs.renameSync(tempPath, targetPath);
      logger.info('Store saved');
    } catch (err) {
      logger.error('Failed to save store: ' + err.message);
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
