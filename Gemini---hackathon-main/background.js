/**
 * Dyslexia-Friendly Reading Engine - Background Service Worker
 * Handles extension lifecycle, keyboard shortcuts, and cross-tab coordination
 */

// Note: DEFAULT_SETTINGS is now the single source of truth in utils/storage.js
// We reference it via chrome.storage or define a minimal fallback here

// ========================================
// Minimal Default Settings Fallback
// ========================================
// This is only used if storage.js hasn't been loaded yet
// The canonical defaults are in utils/storage.js (DEFAULT_GLOBAL_SETTINGS)

const DEFAULT_SETTINGS = {
    version: 1,
    enabled: false,
    activeProfile: 'balanced',
    fontFamily: 'system',
    fontSize: 100,
    lineHeight: 1.6,
    letterSpacing: 1,
    wordSpacing: 2,
    paragraphSpacing: 1.5,
    colorMode: 'normal',
    customBgColor: '#fdf6e3',
    customTextColor: '#657b83',
    gradientEnabled: false,
    gradientStrength: 50,
    rulerEnabled: false,
    rulerType: 'line',
    rulerOpacity: 80,
    immersiveMode: false,
    maxReadingWidth: 720,
    ttsEnabled: false,
    ttsRate: 1.0,
    ttsVoice: null,
    autoApply: true,
    rememberSites: true,
    respectMotion: true,
    respectColorScheme: true,
    shortcutsEnabled: true
};

// ========================================
// Extension Lifecycle
// ========================================

/**
 * Handle extension installation
 */
chrome.runtime.onInstalled.addListener(async (details) => {
    // console.log('[Background] Extension installed/updated:', details.reason);

    if (details.reason === 'install') {
        // First install - set defaults
        try {
            await chrome.storage.sync.set({ globalSettings: DEFAULT_SETTINGS });
            // console.log('[Background] Default settings initialized');

            // Open welcome page (optional - can be added later)
            // chrome.tabs.create({ url: 'welcome.html' });
        } catch (error) {
            console.error('[Background] Error initializing settings:', error);
        }
    }

    if (details.reason === 'update') {
        // Handle updates - migrate settings if needed
        // console.log('[Background] Updated to version:', chrome.runtime.getManifest().version);
        await migrateSettingsIfNeeded();
    }
});

/**
 * Handle extension startup
 */
chrome.runtime.onStartup.addListener(() => {
    // console.log('[Background] Extension started');
});

/**
 * Migrate settings if schema has changed
 */
async function migrateSettingsIfNeeded() {
    try {
        const result = await chrome.storage.sync.get('globalSettings');
        const settings = result.globalSettings || {};

        // Add any new fields that might be missing
        const migrated = { ...DEFAULT_SETTINGS, ...settings };

        if (JSON.stringify(migrated) !== JSON.stringify(settings)) {
            await chrome.storage.sync.set({ globalSettings: migrated });
            // console.log('[Background] Settings migrated');
        }
    } catch (error) {
        console.error('[Background] Error migrating settings:', error);
    }
}

// ========================================
// Keyboard Shortcut Commands
// ========================================

chrome.commands.onCommand.addListener(async (command) => {
    // console.log('[Background] Command received:', command);

    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;

    // Skip restricted pages
    if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://')) {
        // console.log('[Background] Cannot apply to restricted page');
        return;
    }

    // Get current settings
    const result = await chrome.storage.sync.get('globalSettings');
    const settings = result.globalSettings || DEFAULT_SETTINGS;

    // Check if shortcuts are enabled
    if (!settings.shortcutsEnabled && command !== 'toggle-extension') {
        return;
    }

    let updatedSettings = { ...settings };

    switch (command) {
        case 'toggle-extension':
            updatedSettings.enabled = !settings.enabled;
            break;

        case 'toggle-ruler':
            updatedSettings.rulerEnabled = !settings.rulerEnabled;
            break;

        case 'toggle-tts':
            // Send TTS toggle command to content script
            await sendToTab(tab.id, { action: 'toggleTTS' });
            return; // Don't update settings for TTS toggle

        case 'increase-font':
            updatedSettings.fontSize = Math.min(200, settings.fontSize + 10);
            break;

        case 'decrease-font':
            updatedSettings.fontSize = Math.max(50, settings.fontSize - 10);
            break;

        case 'toggle-immersive':
            updatedSettings.immersiveMode = !settings.immersiveMode;
            break;

        case 'toggle-gradient':
            updatedSettings.gradientEnabled = !settings.gradientEnabled;
            break;

        default:
            // console.log('[Background] Unknown command:', command);
            return;
    }

    // Save and apply
    await chrome.storage.sync.set({ globalSettings: updatedSettings });
    await sendToTab(tab.id, { action: 'applySettings', settings: updatedSettings });
});

// ========================================
// Message Handling
// ========================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender).then(sendResponse);
    return true; // Async response
});

/**
 * Handle messages from popup and content scripts
 */
async function handleMessage(message, sender) {
    // console.log('[Background] Message received:', message.action);

    switch (message.action) {
        case 'getSettings':
            return await getSettingsForTab(sender.tab);

        case 'saveSettings':
            return await saveSettings(message.settings, message.domain);

        case 'getPageInfo':
            return await getPageInfo(sender.tab);

        case 'applyToAllTabs':
            return await applyToAllTabs(message.settings);

        case 'resetSettings':
            return await resetSettings(message.domain);

        case 'getSiteHasOverride':
            return await siteHasOverride(message.domain);

        default:
            // console.log('[Background] Unknown action:', message.action);
            return { error: 'Unknown action' };
    }
}

/**
 * Get settings for a specific tab
 */
async function getSettingsForTab(tab) {
    try {
        const result = await chrome.storage.sync.get(['globalSettings', 'siteSettings']);
        const global = result.globalSettings || DEFAULT_SETTINGS;

        let domain = null;
        try {
            domain = new URL(tab?.url || '').hostname;
        } catch (e) { }

        const siteSettings = result.siteSettings || {};
        const siteOverride = domain ? siteSettings[domain] : null;

        if (siteOverride && global.rememberSites) {
            return {
                settings: { ...global, ...siteOverride, _hasSiteOverride: true },
                domain
            };
        }

        return { settings: global, domain };
    } catch (error) {
        console.error('[Background] Error getting settings:', error);
        return { settings: DEFAULT_SETTINGS, domain: null };
    }
}

/**
 * Save settings (global or per-site)
 */
async function saveSettings(settings, domain) {
    try {
        if (domain && settings._saveForSite) {
            // Save per-site override
            const result = await chrome.storage.sync.get('siteSettings');
            const siteSettings = result.siteSettings || {};
            siteSettings[domain] = {
                ...settings,
                _saveForSite: undefined,
                lastModified: Date.now()
            };
            await chrome.storage.sync.set({ siteSettings });
        } else {
            // Save global
            delete settings._hasSiteOverride;
            delete settings._saveForSite;
            await chrome.storage.sync.set({ globalSettings: settings });
        }

        return { success: true };
    } catch (error) {
        console.error('[Background] Error saving settings:', error);
        return { error: error.message };
    }
}

/**
 * Reset settings for a site
 */
async function resetSettings(domain) {
    try {
        if (domain) {
            const result = await chrome.storage.sync.get('siteSettings');
            const siteSettings = result.siteSettings || {};
            delete siteSettings[domain];
            await chrome.storage.sync.set({ siteSettings });
        }
        return { success: true };
    } catch (error) {
        console.error('[Background] Error resetting settings:', error);
        return { error: error.message };
    }
}

/**
 * Check if site has override
 */
async function siteHasOverride(domain) {
    try {
        const result = await chrome.storage.sync.get('siteSettings');
        const siteSettings = result.siteSettings || {};
        return { hasOverride: !!siteSettings[domain] };
    } catch (error) {
        return { hasOverride: false };
    }
}

/**
 * Apply settings to all tabs
 */
async function applyToAllTabs(settings) {
    try {
        const tabs = await chrome.tabs.query({});

        for (const tab of tabs) {
            if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://')) {
                continue;
            }

            try {
                await sendToTab(tab.id, { action: 'applySettings', settings });
            } catch (e) {
                // Tab might not have content script
            }
        }

        return { success: true };
    } catch (error) {
        console.error('[Background] Error applying to all tabs:', error);
        return { error: error.message };
    }
}

/**
 * Send message to a tab
 */
async function sendToTab(tabId, message) {
    try {
        return await chrome.tabs.sendMessage(tabId, message);
    } catch (error) {
        // Try injecting content script first
        try {
            await chrome.scripting.executeScript({
                target: { tabId },
                files: ['utils/storage.js', 'utils/detection.js', 'contentScript.js']
            });
            await new Promise(r => setTimeout(r, 100));
            return await chrome.tabs.sendMessage(tabId, message);
        } catch (e) {
            // console.error('[Background] Could not send to tab:', e);
            throw e;
        }
    }
}

// ========================================
// Tab Events
// ========================================

/**
 * When tab finishes loading, apply settings if enabled
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete') return;
    if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://')) return;

    try {
        const { settings } = await getSettingsForTab(tab);

        if (settings.enabled && settings.autoApply) {
            await sendToTab(tabId, { action: 'applySettings', settings });
        }
    } catch (error) {
        // Content script not ready, that's okay
    }
});

// ========================================
// Storage Change Listener
// ========================================

chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName !== 'sync') return;

    if (changes.globalSettings) {
        const newSettings = changes.globalSettings.newValue;

        if (newSettings && newSettings.enabled) {
            // Apply to all tabs
            await applyToAllTabs(newSettings);
        }
    }
});

// console.log('[Background] Service worker initialized');
