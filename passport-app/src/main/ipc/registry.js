const { ipcMain, dialog, BrowserWindow } = require('electron');
const logger = require('../services/logger');

/**
 * Central IPC handler registration point
 * All IPC communication is wired here
 */

function registerAllHandlers(handlers) {
  // ── Dialog handlers (Electron native dialogs) ──
  ipcMain.handle('dialog:openFile', async (event, args) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win, {
      title: args?.title || 'Open File',
      filters: args?.filters || [],
      properties: args?.properties || ['openFile']
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return { filePath: result.filePaths[0], filePaths: result.filePaths };
  });

  ipcMain.handle('dialog:saveFile', async (event, args) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showSaveDialog(win, {
      title: args?.title || 'Save File',
      defaultPath: args?.defaultPath || '',
      filters: args?.filters || []
    });
    if (result.canceled) {
      return null;
    }
    return { filePath: result.filePath };
  });

  // ── Manifest handlers ──
  const manifestHandlers = handlers.manifest;
  if (manifestHandlers) {
    ipcMain.handle('manifest:import', (event, args) => manifestHandlers.import(args));
    ipcMain.handle('manifest:preview', (event, args) => manifestHandlers.preview(args));
    ipcMain.handle('manifest:downloadTemplate', (event, args) => manifestHandlers.downloadTemplate(args));
    ipcMain.handle('manifest:list', (event, args) => manifestHandlers.list(args));
    ipcMain.handle('manifest:toggleEntered', (event, args) => manifestHandlers.toggleEntered(args));
    ipcMain.handle('manifest:exportFiltered', (event, args) => manifestHandlers.exportFiltered(args));
    ipcMain.handle('manifest:delete', (event, args) => manifestHandlers.deletePassenger(args));
  }

  // ── Scan handlers ──
  const scanHandlers = handlers.scan;
  if (scanHandlers) {
    ipcMain.handle('scan:submitMrz', (event, args) => scanHandlers.submitMrz(args));
    ipcMain.handle('scan:undoLast', (event, args) => scanHandlers.undoLast(args));
    ipcMain.handle('scan:submitManual', (event, args) => scanHandlers.submitManual(args));
    ipcMain.handle('regula:setMode', (event, args) => scanHandlers.setMode(args));
  }

  // ── Pending approval handlers ──
  const pendingHandlers = handlers.pending;
  if (pendingHandlers) {
    ipcMain.handle('pending:list', (event, args) => pendingHandlers.list(args));
    ipcMain.handle('pending:approve', (event, args) => pendingHandlers.approve(args));
    ipcMain.handle('pending:reject', (event, args) => pendingHandlers.reject(args));
  }

  // ── History handlers ──
  const historyHandlers = handlers.history;
  if (historyHandlers) {
    ipcMain.handle('history:list', (event, args) => historyHandlers.list(args));
    ipcMain.handle('history:export', (event, args) => historyHandlers.export(args));
  }

  // ── Reports handlers ──
  const reportHandlers = handlers.reports;
  if (reportHandlers) {
    ipcMain.handle('reports:generatePdf', (event, args) => reportHandlers.generatePdf(args));
    ipcMain.handle('reports:print', (event, args) => reportHandlers.print(args));
  }

  // ── Settings handlers ──
  const settingsHandlers = handlers.settings;
  if (settingsHandlers) {
    ipcMain.handle('settings:get', (event, args) => settingsHandlers.get(args));
    ipcMain.handle('settings:set', (event, args) => settingsHandlers.set(args));
    ipcMain.handle('settings:apiServerStatus', (event, args) => settingsHandlers.apiServerStatus(args));
    ipcMain.handle('session:clear', (event, args) => settingsHandlers.clearSession(args));
    ipcMain.handle('session:clearWithPassword', (event, args) => settingsHandlers.clearSessionWithPassword(args));
    ipcMain.handle('settings:testDeviceUrl', (event, args) => settingsHandlers.testDeviceUrl(args));
    ipcMain.handle('settings:getFieldRequirements', (event, args) => settingsHandlers.getFieldRequirements(event, args));
    ipcMain.handle('settings:setFieldRequirements', (event, args) => settingsHandlers.setFieldRequirements(event, args));
  }

  // ── Dashboard handlers ──
  const dashboardHandlers = handlers.dashboard;
  if (dashboardHandlers) {
    ipcMain.handle('dashboard:stats', (event, args) => dashboardHandlers.stats(args));
  }

  // ── Duplicate handlers ──
  const duplicateHandlers = handlers.duplicate;
  if (duplicateHandlers) {
    ipcMain.handle('duplicate:detect', (event, args) => duplicateHandlers.detectDuplicate(event, args));
    ipcMain.handle('duplicate:resolve', (event, args) => duplicateHandlers.resolveDuplicate(event, args));
  }

  logger.info('All IPC handlers registered');
}

module.exports = { registerAllHandlers };
