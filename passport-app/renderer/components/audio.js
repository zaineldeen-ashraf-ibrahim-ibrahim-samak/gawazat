/**
 * Audio Component
 * Plays success/warning sound cues during passport scanning.
 * Respects the sound_enabled setting.
 */

let successAudio = null;
let warningAudio = null;
let soundEnabled = true;

/**
 * Initialize audio — preload both sound files
 */
export function initAudio() {
  try {
    successAudio = new Audio('./assets/audio/success.wav');
    warningAudio = new Audio('./assets/audio/warning.wav');
    successAudio.volume = 0.6;
    warningAudio.volume = 0.7;
    // Preload
    successAudio.load();
    warningAudio.load();
  } catch (err) {
    console.warn('Audio init failed (will run silently):', err.message);
  }
}

/**
 * Update sound enabled state from settings
 * @param {boolean} enabled
 */
export function setSoundEnabled(enabled) {
  soundEnabled = enabled;
}

/**
 * Play the success chime (green scan result)
 */
export function playSuccess() {
  if (!soundEnabled || !successAudio) return;
  try {
    successAudio.currentTime = 0;
    successAudio.play().catch(() => {});
  } catch (err) { /* silent */ }
}

/**
 * Play the warning tone (yellow, orange, or red scan result)
 */
export function playWarning() {
  if (!soundEnabled || !warningAudio) return;
  try {
    warningAudio.currentTime = 0;
    warningAudio.play().catch(() => {});
  } catch (err) { /* silent */ }
}
