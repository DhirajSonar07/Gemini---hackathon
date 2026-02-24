/**
 * Dyslexia-Friendly Reading Engine - Popup Controller
 * Handles UI interactions, settings management, and content script communication
 */

// ========================================
// Utilities
// ========================================

/**
 * Debounce utility to prevent excessive function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ========================================
// State
// ========================================

let currentSettings = null;
let currentDomain = null;
let hasSiteOverride = false;

// ========================================
// DOM References
// ========================================

const elements = {};

// ========================================
// Initialization
// ========================================

document.addEventListener('DOMContentLoaded', async () => {
  cacheElements();
  await loadSettings();
  attachEventListeners();
  setupTabs();
});

/**
 * Cache DOM element references
 */
function cacheElements() {
  // Main controls
  elements.enableToggle = document.getElementById('enableToggle');
  elements.statusText = document.getElementById('statusText');
  elements.siteIndicator = document.getElementById('siteIndicator');
  elements.resetBtn = document.getElementById('resetBtn');
  elements.rememberSiteToggle = document.getElementById('rememberSiteToggle');

  // Tabs
  elements.tabs = document.querySelectorAll('.tab');
  elements.panels = document.querySelectorAll('.panel');

  // Profiles
  elements.profileCards = document.querySelectorAll('.profile-card');

  // Typography
  elements.fontRadios = document.querySelectorAll('input[name="fontFamily"]');
  elements.fontSizeSlider = document.getElementById('fontSizeSlider');
  elements.fontSizeValue = document.getElementById('fontSizeValue');
  elements.lineHeightSlider = document.getElementById('lineHeightSlider');
  elements.lineHeightValue = document.getElementById('lineHeightValue');
  elements.letterSpacingSlider = document.getElementById('letterSpacingSlider');
  elements.letterSpacingValue = document.getElementById('letterSpacingValue');
  elements.wordSpacingSlider = document.getElementById('wordSpacingSlider');
  elements.wordSpacingValue = document.getElementById('wordSpacingValue');
  elements.paragraphSpacingSlider = document.getElementById('paragraphSpacingSlider');
  elements.paragraphSpacingValue = document.getElementById('paragraphSpacingValue');
  elements.colorModeRadios = document.querySelectorAll('input[name="colorMode"]');

  // Features
  elements.gradientToggle = document.getElementById('gradientToggle');
  elements.gradientStrengthSlider = document.getElementById('gradientStrengthSlider');
  elements.gradientStrengthValue = document.getElementById('gradientStrengthValue');

  elements.rulerToggle = document.getElementById('rulerToggle');
  elements.rulerTypeRadios = document.querySelectorAll('input[name="rulerType"]');
  elements.rulerOpacitySlider = document.getElementById('rulerOpacitySlider');
  elements.rulerOpacityValue = document.getElementById('rulerOpacityValue');

  elements.immersiveToggle = document.getElementById('immersiveToggle');
  elements.maxWidthSlider = document.getElementById('maxWidthSlider');
  elements.maxWidthValue = document.getElementById('maxWidthValue');

  // TTS
  elements.ttsPlayBtn = document.getElementById('ttsPlayBtn');
  elements.ttsPauseBtn = document.getElementById('ttsPauseBtn');
  elements.ttsStopBtn = document.getElementById('ttsStopBtn');
  elements.ttsRateSlider = document.getElementById('ttsRateSlider');
  elements.ttsRateValue = document.getElementById('ttsRateValue');
}

/**
 * Load settings from background
 */
async function loadSettings() {
  try {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab?.url) {
      try {
        currentDomain = new URL(tab.url).hostname;
      } catch (e) {
        currentDomain = null;
      }
    }

    // Get settings from storage
    const result = await chrome.storage.sync.get(['globalSettings', 'siteSettings']);
    currentSettings = result.globalSettings || getDefaultSettings();

    // Check for site-specific settings
    if (currentDomain && currentSettings.rememberSites) {
      const siteSettings = result.siteSettings || {};
      if (siteSettings[currentDomain]) {
        currentSettings = { ...currentSettings, ...siteSettings[currentDomain] };
        hasSiteOverride = true;
      }
    }

    applySettingsToUI();
  } catch (error) {
    // console.error('[Popup] Error loading settings:', error);
    currentSettings = getDefaultSettings();
    applySettingsToUI();
  }
}

/**
 * Get default settings
 * Uses the canonical defaults from utils/storage.js
 */
function getDefaultSettings() {
  // If storage module is available, use its defaults
  if (window.DyslexiaStorage?.DEFAULT_GLOBAL_SETTINGS) {
    return { ...window.DyslexiaStorage.DEFAULT_GLOBAL_SETTINGS };
  }
  
  // Fallback if storage module not loaded (shouldn't happen in popup context)
  return {
    enabled: false,
    activeProfile: 'balanced',
    fontFamily: 'system',
    fontSize: 100,
    lineHeight: 1.6,
    letterSpacing: 1,
    wordSpacing: 2,
    paragraphSpacing: 1.5,
    colorMode: 'normal',
    gradientEnabled: false,
    gradientStrength: 50,
    rulerEnabled: false,
    rulerType: 'line',
    rulerOpacity: 80,
    immersiveMode: false,
    maxReadingWidth: 720,
    ttsEnabled: false,
    ttsRate: 1.0,
    rememberSites: true
  };
}

/**
 * Apply current settings to UI elements
 */
function applySettingsToUI() {
  // Enable toggle
  elements.enableToggle.checked = currentSettings.enabled;
  updateStatusText(currentSettings.enabled);

  // Site indicator
  if (hasSiteOverride) {
    elements.siteIndicator.classList.remove('hidden');
  } else {
    elements.siteIndicator.classList.add('hidden');
  }

  // Remember site toggle
  elements.rememberSiteToggle.checked = hasSiteOverride;

  // Profile
  updateProfileSelection(currentSettings.activeProfile);

  // Font
  elements.fontRadios.forEach(radio => {
    radio.checked = radio.value === currentSettings.fontFamily;
  });

  // Sliders
  setSliderValue(elements.fontSizeSlider, elements.fontSizeValue, currentSettings.fontSize, '%');
  setSliderValue(elements.lineHeightSlider, elements.lineHeightValue, currentSettings.lineHeight);
  setSliderValue(elements.letterSpacingSlider, elements.letterSpacingValue, currentSettings.letterSpacing, 'px');
  setSliderValue(elements.wordSpacingSlider, elements.wordSpacingValue, currentSettings.wordSpacing, 'px');
  setSliderValue(elements.paragraphSpacingSlider, elements.paragraphSpacingValue, currentSettings.paragraphSpacing, 'em');

  // Color mode
  elements.colorModeRadios.forEach(radio => {
    radio.checked = radio.value === currentSettings.colorMode;
  });

  // Features
  elements.gradientToggle.checked = currentSettings.gradientEnabled;
  setSliderValue(elements.gradientStrengthSlider, elements.gradientStrengthValue, currentSettings.gradientStrength, '%');

  elements.rulerToggle.checked = currentSettings.rulerEnabled;
  elements.rulerTypeRadios.forEach(radio => {
    radio.checked = radio.value === currentSettings.rulerType;
  });
  setSliderValue(elements.rulerOpacitySlider, elements.rulerOpacityValue, currentSettings.rulerOpacity, '%');

  elements.immersiveToggle.checked = currentSettings.immersiveMode;
  setSliderValue(elements.maxWidthSlider, elements.maxWidthValue, currentSettings.maxReadingWidth, 'px');

  // TTS
  setSliderValue(elements.ttsRateSlider, elements.ttsRateValue, currentSettings.ttsRate, 'x');
}

/**
 * Set slider value and display
 */
function setSliderValue(slider, display, value, suffix = '') {
  slider.value = value;
  display.textContent = Number.isInteger(value) ? `${value}${suffix}` : `${value.toFixed(1)}${suffix}`;
}

/**
 * Update status text
 */
function updateStatusText(enabled) {
  elements.statusText.textContent = enabled ? 'Enabled' : 'Disabled';
  elements.statusText.classList.toggle('enabled', enabled);
}

/**
 * Update profile selection UI
 */
function updateProfileSelection(profileId) {
  elements.profileCards.forEach(card => {
    card.setAttribute('aria-pressed', card.dataset.profile === profileId);
  });
}

// ========================================
// Event Listeners
// ========================================

// Create debounced save handler (300ms delay)
const debouncedSaveAndApply = debounce(saveAndApply, 300);

function attachEventListeners() {
  // Master toggle
  elements.enableToggle.addEventListener('change', handleEnableToggle);

  // Reset button
  elements.resetBtn.addEventListener('click', handleReset);

  // Remember site toggle
  elements.rememberSiteToggle.addEventListener('change', handleRememberSiteToggle);

  // Profiles
  elements.profileCards.forEach(card => {
    card.addEventListener('click', () => handleProfileSelect(card.dataset.profile));
  });

  // Font selection
  elements.fontRadios.forEach(radio => {
    radio.addEventListener('change', () => handleSettingChange('fontFamily', radio.value));
  });

  // Typography sliders
  elements.fontSizeSlider.addEventListener('input', (e) => {
    elements.fontSizeValue.textContent = `${e.target.value}%`;
    currentSettings.fontSize = parseInt(e.target.value);
    debouncedSaveAndApply();
  });
  elements.fontSizeSlider.addEventListener('change', (e) => {
    handleSettingChange('fontSize', parseInt(e.target.value));
  });

  elements.lineHeightSlider.addEventListener('input', (e) => {
    elements.lineHeightValue.textContent = parseFloat(e.target.value).toFixed(1);
    currentSettings.lineHeight = parseFloat(e.target.value);
    debouncedSaveAndApply();
  });
  elements.lineHeightSlider.addEventListener('change', (e) => {
    handleSettingChange('lineHeight', parseFloat(e.target.value));
  });

  elements.letterSpacingSlider.addEventListener('input', (e) => {
    elements.letterSpacingValue.textContent = `${e.target.value}px`;
    currentSettings.letterSpacing = parseFloat(e.target.value);
    debouncedSaveAndApply();
  });
  elements.letterSpacingSlider.addEventListener('change', (e) => {
    handleSettingChange('letterSpacing', parseFloat(e.target.value));
  });

  elements.wordSpacingSlider.addEventListener('input', (e) => {
    elements.wordSpacingValue.textContent = `${e.target.value}px`;
    currentSettings.wordSpacing = parseInt(e.target.value);
    debouncedSaveAndApply();
  });
  elements.wordSpacingSlider.addEventListener('change', (e) => {
    handleSettingChange('wordSpacing', parseInt(e.target.value));
  });

  elements.paragraphSpacingSlider.addEventListener('input', (e) => {
    elements.paragraphSpacingValue.textContent = `${parseFloat(e.target.value).toFixed(2)}em`;
    currentSettings.paragraphSpacing = parseFloat(e.target.value);
    debouncedSaveAndApply();
  });
  elements.paragraphSpacingSlider.addEventListener('change', (e) => {
    handleSettingChange('paragraphSpacing', parseFloat(e.target.value));
  });

  // Color mode
  elements.colorModeRadios.forEach(radio => {
    radio.addEventListener('change', () => handleSettingChange('colorMode', radio.value));
  });

  // Gradient
  elements.gradientToggle.addEventListener('change', (e) => {
    handleSettingChange('gradientEnabled', e.target.checked);
  });

  elements.gradientStrengthSlider.addEventListener('input', (e) => {
    elements.gradientStrengthValue.textContent = `${e.target.value}%`;
    currentSettings.gradientStrength = parseInt(e.target.value);
    debouncedSaveAndApply();
  });
  elements.gradientStrengthSlider.addEventListener('change', (e) => {
    handleSettingChange('gradientStrength', parseInt(e.target.value));
  });

  // Ruler
  elements.rulerToggle.addEventListener('change', (e) => {
    handleSettingChange('rulerEnabled', e.target.checked);
  });

  elements.rulerTypeRadios.forEach(radio => {
    radio.addEventListener('change', () => handleSettingChange('rulerType', radio.value));
  });

  elements.rulerOpacitySlider.addEventListener('input', (e) => {
    elements.rulerOpacityValue.textContent = `${e.target.value}%`;
    currentSettings.rulerOpacity = parseInt(e.target.value);
    debouncedSaveAndApply();
  });
  elements.rulerOpacitySlider.addEventListener('change', (e) => {
    handleSettingChange('rulerOpacity', parseInt(e.target.value));
  });

  // Immersive
  elements.immersiveToggle.addEventListener('change', (e) => {
    handleSettingChange('immersiveMode', e.target.checked);
  });

  elements.maxWidthSlider.addEventListener('input', (e) => {
    elements.maxWidthValue.textContent = `${e.target.value}px`;
    currentSettings.maxReadingWidth = parseInt(e.target.value);
    debouncedSaveAndApply();
  });
  elements.maxWidthSlider.addEventListener('change', (e) => {
    handleSettingChange('maxReadingWidth', parseInt(e.target.value));
  });

  // TTS
  elements.ttsPlayBtn.addEventListener('click', handleTTSPlay);
  elements.ttsPauseBtn.addEventListener('click', handleTTSPause);
  elements.ttsStopBtn.addEventListener('click', handleTTSStop);

  elements.ttsRateSlider.addEventListener('input', (e) => {
    elements.ttsRateValue.textContent = `${parseFloat(e.target.value).toFixed(1)}x`;
    currentSettings.ttsRate = parseFloat(e.target.value);
    debouncedSaveAndApply();
  });
  elements.ttsRateSlider.addEventListener('change', (e) => {
    handleSettingChange('ttsRate', parseFloat(e.target.value));
  });
}

// ========================================
// Tab Navigation
// ========================================

function setupTabs() {
  elements.tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Update tab states
      elements.tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      // Update panel visibility
      const panelId = tab.getAttribute('aria-controls');
      elements.panels.forEach(panel => {
        panel.classList.remove('active');
        panel.hidden = true;
      });

      const activePanel = document.getElementById(panelId);
      if (activePanel) {
        activePanel.classList.add('active');
        activePanel.hidden = false;
      }
    });
  });
}

// ========================================
// Event Handlers
// ========================================

/**
 * Handle enable/disable toggle
 */
async function handleEnableToggle() {
  currentSettings.enabled = elements.enableToggle.checked;
  updateStatusText(currentSettings.enabled);
  await saveAndApply();
}

/**
 * Handle profile selection
 */
async function handleProfileSelect(profileId) {
  // Get profile settings from storage module
  const profiles = window.DyslexiaStorage?.READING_PROFILES || {};
  const profile = profiles[profileId];

  if (profile) {
    // Apply profile settings
    Object.assign(currentSettings, profile.settings);
    currentSettings.activeProfile = profileId;

    // Update UI
    applySettingsToUI();
    updateProfileSelection(profileId);

    await saveAndApply();
  }
}

/**
 * Handle individual setting change
 */
async function handleSettingChange(key, value) {
  currentSettings[key] = value;
  await saveAndApply();
}

/**
 * Handle remember site toggle
 */
async function handleRememberSiteToggle() {
  if (elements.rememberSiteToggle.checked && currentDomain) {
    // Save settings for this site
    const result = await chrome.storage.sync.get('siteSettings');
    const siteSettings = result.siteSettings || {};
    siteSettings[currentDomain] = { ...currentSettings };
    await chrome.storage.sync.set({ siteSettings });

    hasSiteOverride = true;
    elements.siteIndicator.classList.remove('hidden');
  } else if (currentDomain) {
    // Remove site-specific settings
    const result = await chrome.storage.sync.get('siteSettings');
    const siteSettings = result.siteSettings || {};
    delete siteSettings[currentDomain];
    await chrome.storage.sync.set({ siteSettings });

    hasSiteOverride = false;
    elements.siteIndicator.classList.add('hidden');
  }
}

/**
 * Handle reset button
 */
async function handleReset() {
  // Keep confirm() for destructive actions - it's appropriate here
  if (confirm('Reset all settings to defaults?')) {
    currentSettings = getDefaultSettings();
    currentSettings.enabled = true;
    hasSiteOverride = false;

    // Clear site settings
    if (currentDomain) {
      const result = await chrome.storage.sync.get('siteSettings');
      const siteSettings = result.siteSettings || {};
      delete siteSettings[currentDomain];
      await chrome.storage.sync.set({ siteSettings });
    }

    applySettingsToUI();
    await saveAndApply();
    
    // Show success feedback via content script toast
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await chrome.tabs.sendMessage(tab.id, { 
          action: 'showToast', 
          message: 'Settings reset to defaults' 
        });
      }
    } catch (e) {
      // Toast not critical, ignore errors
    }
  }
}

// ========================================
// TTS Handlers
// ========================================

async function handleTTSPlay() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await chrome.tabs.sendMessage(tab.id, { action: 'toggleTTS' });
      elements.ttsPlayBtn.disabled = true;
      elements.ttsPauseBtn.disabled = false;
      elements.ttsStopBtn.disabled = false;
    }
  } catch (e) {
    // console.error('[Popup] TTS error:', e);
  }
}

async function handleTTSPause() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await chrome.tabs.sendMessage(tab.id, { action: 'toggleTTS' });
      elements.ttsPlayBtn.disabled = false;
      elements.ttsPauseBtn.disabled = true;
    }
  } catch (e) {
    // console.error('[Popup] TTS error:', e);
  }
}

async function handleTTSStop() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await chrome.tabs.sendMessage(tab.id, { action: 'stopTTS' });
      elements.ttsPlayBtn.disabled = false;
      elements.ttsPauseBtn.disabled = true;
      elements.ttsStopBtn.disabled = true;
    }
  } catch (e) {
    // console.error('[Popup] TTS error:', e);
  }
}

// ========================================
// Settings Persistence
// ========================================

/**
 * Save settings and apply to content script
 */
async function saveAndApply() {
  try {
    // Save to storage
    if (hasSiteOverride && currentDomain) {
      const result = await chrome.storage.sync.get('siteSettings');
      const siteSettings = result.siteSettings || {};
      siteSettings[currentDomain] = { ...currentSettings };
      await chrome.storage.sync.set({ siteSettings });
    }

    // Always save global
    await chrome.storage.sync.set({ globalSettings: currentSettings });

    // Apply to current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab?.id && !tab.url?.startsWith('chrome://')) {
      try {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'applySettings',
          settings: currentSettings
        });
      } catch (e) {
        // Try injecting content script
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['utils/storage.js', 'utils/detection.js', 'contentScript.js']
          });

          await new Promise(r => setTimeout(r, 100));

          await chrome.tabs.sendMessage(tab.id, {
            action: 'applySettings',
            settings: currentSettings
          });
        } catch (injectError) {
          // console.error('[Popup] Could not inject scripts:', injectError);
        }
      }
    }
  } catch (error) {
    // console.error('[Popup] Error saving settings:', error);
  }
}
