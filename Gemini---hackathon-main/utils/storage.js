/**
 * Dyslexia-Friendly Reading Tool - Storage Utilities
 * Handles global settings, per-site overrides, and schema versioning
 */
(function () {
    // Prevent re-declaration if already injected
    if (window.DyslexiaStorage) return;

    // Current settings schema version for migrations
    const SETTINGS_VERSION = 1;

    // ========================================
    // Default Global Settings
    // ========================================

    const DEFAULT_GLOBAL_SETTINGS = {
        version: SETTINGS_VERSION,
        enabled: false,

        // Active profile
        activeProfile: 'balanced',

        // Font settings
        fontFamily: 'system',
        fontSize: 100,

        // Spacing
        lineHeight: 1.6,
        letterSpacing: 1,
        wordSpacing: 2,
        paragraphSpacing: 1.5,

        // Colors
        colorMode: 'normal', // normal, high-contrast, dark, sepia, custom
        customBgColor: '#fdf6e3',
        customTextColor: '#657b83',

        // Features
        gradientEnabled: false,
        gradientStrength: 50,

        rulerEnabled: false,
        rulerType: 'line', // line, focus-1, focus-3, focus-paragraph
        rulerOpacity: 80,

        immersiveMode: false,
        maxReadingWidth: 720,

        // TTS
        ttsEnabled: false,
        ttsRate: 1.0,
        ttsVoice: null, // null = default

        // Behavior
        autoApply: true,
        rememberSites: true,
        respectMotion: true,
        respectColorScheme: true,

        // Shortcuts
        shortcutsEnabled: true
    };

    // ========================================
    // Reading Profiles
    // ========================================

    const READING_PROFILES = {
        balanced: {
            name: 'Balanced',
            description: 'Comfortable everyday reading',
            icon: '⚖️',
            settings: {
                fontFamily: 'system',
                fontSize: 105,
                lineHeight: 1.6,
                letterSpacing: 1,
                wordSpacing: 2,
                colorMode: 'normal',
                gradientEnabled: false,
                rulerEnabled: false,
                immersiveMode: false
            }
        },
        highFocus: {
            name: 'High Focus',
            description: 'Maximum readability for deep work',
            icon: '🎯',
            settings: {
                fontFamily: 'OpenDyslexic',
                fontSize: 115,
                lineHeight: 2.0,
                letterSpacing: 2,
                wordSpacing: 4,
                colorMode: 'normal',
                gradientEnabled: true,
                gradientStrength: 60,
                rulerEnabled: true,
                rulerType: 'focus-3',
                immersiveMode: true
            }
        },
        nightReading: {
            name: 'Night Reading',
            description: 'Easy on eyes in low light',
            icon: '🌙',
            settings: {
                fontFamily: 'system',
                fontSize: 110,
                lineHeight: 1.8,
                letterSpacing: 1,
                wordSpacing: 2,
                colorMode: 'dark',
                gradientEnabled: false,
                rulerEnabled: false,
                immersiveMode: true
            }
        },
        documentation: {
            name: 'Documentation',
            description: 'Optimized for technical docs',
            icon: '📖',
            settings: {
                fontFamily: 'system',
                fontSize: 100,
                lineHeight: 1.5,
                letterSpacing: 0.5,
                wordSpacing: 1,
                colorMode: 'normal',
                gradientEnabled: false,
                rulerEnabled: false,
                immersiveMode: false
            }
        },
        sepia: {
            name: 'Sepia',
            description: 'Warm paper-like tones',
            icon: '📜',
            settings: {
                fontFamily: 'serif',
                fontSize: 108,
                lineHeight: 1.7,
                letterSpacing: 0.5,
                wordSpacing: 2,
                colorMode: 'sepia',
                gradientEnabled: false,
                rulerEnabled: false,
                immersiveMode: false
            }
        },
        adhd: {
            name: 'ADHD Focus',
            description: 'Minimize distractions',
            icon: '🧠',
            settings: {
                fontFamily: 'system',
                fontSize: 110,
                lineHeight: 1.8,
                letterSpacing: 1.5,
                wordSpacing: 3,
                colorMode: 'normal',
                gradientEnabled: true,
                gradientStrength: 40,
                rulerEnabled: true,
                rulerType: 'line',
                immersiveMode: true
            }
        }
    };

    // ========================================
    // Storage Functions
    // ========================================

    /**
     * Get global settings from storage
     * @returns {Promise<Object>} Global settings object
     */
    async function getGlobalSettings() {
        try {
            const result = await chrome.storage.sync.get('globalSettings');
            if (!result.globalSettings) {
                return { ...DEFAULT_GLOBAL_SETTINGS };
            }

            // Migrate if needed
            const settings = migrateSettings(result.globalSettings);
            return { ...DEFAULT_GLOBAL_SETTINGS, ...settings };
        } catch (error) {
            console.error('[Storage] Error getting global settings:', error);
            return { ...DEFAULT_GLOBAL_SETTINGS };
        }
    }

    /**
     * Save global settings to storage
     * @param {Object} settings - Settings to save
     */
    async function saveGlobalSettings(settings) {
        try {
            settings.version = SETTINGS_VERSION;
            await chrome.storage.sync.set({ globalSettings: settings });
        } catch (error) {
            console.error('[Storage] Error saving global settings:', error);
        }
    }

    /**
     * Get per-site settings for a domain
     * @param {string} domain - Domain to get settings for
     * @returns {Promise<Object|null>} Site-specific settings or null
     */
    async function getSiteSettings(domain) {
        try {
            const result = await chrome.storage.sync.get('siteSettings');
            const siteSettings = result.siteSettings || {};
            return siteSettings[domain] || null;
        } catch (error) {
            console.error('[Storage] Error getting site settings:', error);
            return null;
        }
    }

    /**
     * Save per-site settings for a domain
     * @param {string} domain - Domain to save settings for
     * @param {Object} settings - Settings to save
     */
    async function saveSiteSettings(domain, settings) {
        try {
            const result = await chrome.storage.sync.get('siteSettings');
            const siteSettings = result.siteSettings || {};
            siteSettings[domain] = {
                ...settings,
                lastModified: Date.now()
            };
            await chrome.storage.sync.set({ siteSettings });
        } catch (error) {
            console.error('[Storage] Error saving site settings:', error);
        }
    }

    /**
     * Clear per-site settings for a domain
     * @param {string} domain - Domain to clear settings for
     */
    async function clearSiteSettings(domain) {
        try {
            const result = await chrome.storage.sync.get('siteSettings');
            const siteSettings = result.siteSettings || {};
            delete siteSettings[domain];
            await chrome.storage.sync.set({ siteSettings });
        } catch (error) {
            console.error('[Storage] Error clearing site settings:', error);
        }
    }

    /**
     * Get effective settings (global merged with site overrides)
     * @param {string} domain - Current domain
     * @returns {Promise<Object>} Merged settings
     */
    async function getEffectiveSettings(domain) {
        const global = await getGlobalSettings();

        if (!global.rememberSites) {
            return global;
        }

        const site = await getSiteSettings(domain);
        if (!site) {
            return global;
        }

        // Merge with site overrides taking precedence
        return { ...global, ...site, _hasSiteOverride: true };
    }

    /**
     * Apply a reading profile
     * @param {string} profileId - Profile to apply
     * @returns {Object} Profile settings
     */
    function applyProfile(profileId) {
        const profile = READING_PROFILES[profileId];
        if (!profile) {
            return READING_PROFILES.balanced.settings;
        }
        return { ...profile.settings, activeProfile: profileId };
    }

    /**
     * Get all available profiles
     * @returns {Object} All profiles
     */
    function getProfiles() {
        return READING_PROFILES;
    }

    /**
     * Migrate settings from older versions
     * @param {Object} settings - Old settings
     * @returns {Object} Migrated settings
     */
    function migrateSettings(settings) {
        const version = settings.version || 0;

        // Add migrations here as schema evolves
        if (version < 1) {
            // v0 -> v1 migration
            settings.version = 1;
        }

        return settings;
    }

    /**
     * Reset all settings to defaults
     */
    async function resetAllSettings() {
        try {
            await chrome.storage.sync.clear();
            await saveGlobalSettings(DEFAULT_GLOBAL_SETTINGS);
        } catch (error) {
            console.error('[Storage] Error resetting settings:', error);
        }
    }

    /**
     * Export current settings (for backup)
     * @returns {Promise<Object>} All settings
     */
    async function exportSettings() {
        try {
            const data = await chrome.storage.sync.get(null);
            return data;
        } catch (error) {
            console.error('[Storage] Error exporting settings:', error);
            return null;
        }
    }

    /**
     * Import settings (from backup)
     * @param {Object} data - Settings to import
     */
    async function importSettings(data) {
        try {
            await chrome.storage.sync.clear();
            await chrome.storage.sync.set(data);
        } catch (error) {
            console.error('[Storage] Error importing settings:', error);
        }
    }

    // Export for use in other modules
    window.DyslexiaStorage = {
        getGlobalSettings,
        saveGlobalSettings,
        getSiteSettings,
        saveSiteSettings,
        clearSiteSettings,
        getEffectiveSettings,
        applyProfile,
        getProfiles,
        resetAllSettings,
        exportSettings,
        importSettings,
        DEFAULT_GLOBAL_SETTINGS,
        READING_PROFILES
    };
})();
