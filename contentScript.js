/**
 * Dyslexia-Friendly Reading Engine - Content Script
 * Premium reading experience with automatic content detection,
 * typography control, BeeLine gradients, reading ruler, and TTS
 */

// ========================================
// Constants & Configuration
// ========================================

const STYLE_ID = 'dyslexia-reader-styles';
const RULER_ID = 'dyslexia-reader-ruler';
const OVERLAY_ID = 'dyslexia-reader-overlay';
const TTS_HIGHLIGHT_CLASS = 'dyslexia-tts-highlight';
const CONTENT_WRAPPER_CLASS = 'dyslexia-content-wrapper';
const TOAST_CONTAINER_ID = 'dyslexia-toast-container';

const FONT_CDN = 'https://fonts.cdnfonts.com/css/opendyslexic';

// Font family mappings
const FONTS = {
  'system': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  'OpenDyslexic': '"OpenDyslexic", sans-serif',
  'serif': 'Georgia, "Times New Roman", Times, serif',
  'sans': 'Arial, Helvetica, sans-serif',
  'mono': '"Fira Code", "Source Code Pro", Consolas, monospace'
};

// Color schemes
const COLOR_SCHEMES = {
  'normal': { bg: null, text: null, link: null },
  'high-contrast': { bg: '#ffffff', text: '#000000', link: '#0000cc' },
  'dark': { bg: '#1a1a2e', text: '#e8e8e8', link: '#6ea8fe' },
  'sepia': { bg: '#f4ecd8', text: '#5b4636', link: '#7b5b3a' },
  'cream': { bg: '#fffef0', text: '#333333', link: '#0066cc' },
  'grey': { bg: '#e0e0e0', text: '#222222', link: '#0055aa' }
};

// BeeLine gradient colors
const GRADIENT_COLORS = [
  '#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#9b59b6'
];

// ========================================
// State Management
// ========================================

// SPA double-injection guard
let isInitialized = false;

let currentSettings = null;
let isEnabled = false;
let styleElement = null;
let rulerElement = null;
let overlayElement = null;
let fontLinkElement = null;

// TTS State
let ttsState = {
  isPlaying: false,
  utterance: null,
  currentIndex: 0,
  sentences: [],
  highlightedElement: null,
  rootElement: null
};

// ========================================
// Initialization
// ========================================

/**
 * Show a non-blocking toast notification
 * @param {string} message - Message to display
 * @param {number} duration - Duration in milliseconds (default: 3000)
 */
function showToast(message, duration = 3000) {
  // Create or get toast container
  let container = document.getElementById(TOAST_CONTAINER_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = TOAST_CONTAINER_ID;
    container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000000;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
    `;
    document.body.appendChild(container);
  }

  // Create toast element
  const toast = document.createElement('div');
  toast.style.cssText = `
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    line-height: 1.4;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    max-width: 300px;
    word-wrap: break-word;
    pointer-events: auto;
    animation: slideIn 0.3s ease-out;
  `;
  toast.textContent = message;

  // Add animation keyframes if not already present
  if (!document.getElementById('dyslexia-toast-animations')) {
    const style = document.createElement('style');
    style.id = 'dyslexia-toast-animations';
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes slideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(400px);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  container.appendChild(toast);

  // Auto-remove after duration
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
      // Remove container if empty
      if (container.children.length === 0) {
        container.remove();
      }
    }, 300);
  }, duration);
}

/**
 * Initialize the content script
 */
async function initialize() {
  // SPA double-injection guard
  if (isInitialized) {
    // console.log('[ContentScript] Already initialized, skipping...');
    return;
  }
  
  isInitialized = true;
  // console.log('[ContentScript] Initializing...');

  // Load settings
  try {
    const result = await chrome.storage.sync.get('globalSettings');
    currentSettings = result.globalSettings;

    if (currentSettings?.enabled) {
      await applySettings(currentSettings);
    }
  } catch (error) {
    // console.error('[ContentScript] Error loading settings:', error);
  }

  // Set up message listener (only once)
  chrome.runtime.onMessage.addListener(handleMessage);

  // Set up keyboard listeners for ruler (only once)
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('mousemove', handleMouseMove);

  // console.log('[ContentScript] Initialized');
}

// ========================================
// Message Handling
// ========================================

function handleMessage(message, sender, sendResponse) {
  // console.log('[ContentScript] Message received:', message.action);

  switch (message.action) {
    case 'applySettings':
      applySettings(message.settings).then(() => sendResponse({ success: true }));
      return true;

    case 'toggleTTS':
      toggleTTS();
      sendResponse({ success: true, isPlaying: ttsState.isPlaying });
      return true;

    case 'pauseTTS':
      pauseTTS();
      sendResponse({ success: true, isPlaying: false });
      return true;

    case 'resumeTTS':
      resumeTTS();
      sendResponse({ success: true, isPlaying: true });
      return true;

    case 'showToast':
      showToast(message.message, message.duration);
      sendResponse({ success: true });
      return true;

    case 'getPageInfo':
      const info = window.DyslexiaDetection?.getPageMetadata() || {};
      sendResponse(info);
      return true;

    case 'stopTTS':
      stopTTS();
      sendResponse({ success: true });
      return true;

    case 'disable':
      removeAllStyles();
      sendResponse({ success: true });
      return true;

    default:
      sendResponse({ error: 'Unknown action' });
  }
}

// ========================================
// Main Style Application
// ========================================

/**
 * Apply all settings to the page
 */
async function applySettings(settings) {
  currentSettings = settings;
  isEnabled = settings.enabled;

  if (!isEnabled) {
    removeAllStyles();
    return;
  }

  // console.log('[ContentScript] Applying settings...');

  // Load OpenDyslexic font if needed
  if (settings.fontFamily === 'OpenDyslexic') {
    loadOpenDyslexicFont();
  }

  // Generate and inject main styles
  injectMainStyles(settings);

  // Handle BeeLine gradient
  if (settings.gradientEnabled) {
    applyGradient(settings.gradientStrength, settings.colorMode);
  } else {
    removeGradient();
  }

  // Handle reading ruler
  if (settings.rulerEnabled) {
    createRuler(settings.rulerType, settings.rulerOpacity);
  } else {
    removeRuler();
  }

  // Handle immersive mode
  if (settings.immersiveMode) {
    applyImmersiveMode(settings.maxReadingWidth);
  } else {
    removeImmersiveMode();
  }
}

/**
 * Remove all injected styles and elements
 */
function removeAllStyles() {
  isEnabled = false;

  // Remove style element
  if (styleElement) {
    styleElement.remove();
    styleElement = null;
  }

  // Remove ruler
  removeRuler();

  // Remove gradient
  removeGradient();

  // Remove immersive overlay
  removeImmersiveMode();

  // Stop TTS
  if (ttsState.isPlaying) {
    stopTTS();
  }

  // Remove body class
  document.body.classList.remove('dyslexia-reader-enabled');

  // console.log('[ContentScript] All styles removed');
}

// ========================================
// Font Loading
// ========================================

/**
 * Load OpenDyslexic font from CDN
 */
function loadOpenDyslexicFont() {
  if (document.getElementById('dyslexia-font-link')) return;

  const link = document.createElement('link');
  link.id = 'dyslexia-font-link';
  link.rel = 'stylesheet';
  link.href = FONT_CDN;
  document.head.appendChild(link);
  fontLinkElement = link;
}

// ========================================
// Style Injection
// ========================================

/**
 * Generate and inject main CSS styles
 */
function injectMainStyles(settings) {
  const css = generateMainCSS(settings);

  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = STYLE_ID;
    document.head.appendChild(styleElement);
  }

  styleElement.textContent = css;
  document.body.classList.add('dyslexia-reader-enabled');
}

/**
 * Generate main CSS based on settings
 */
function generateMainCSS(settings) {
  const font = FONTS[settings.fontFamily] || FONTS.system;
  const colors = COLOR_SCHEMES[settings.colorMode] || COLOR_SCHEMES.normal;
  const fontSize = settings.fontSize / 100;

  // Check for reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const transitions = prefersReducedMotion || !settings.respectMotion ? 'none' : 'all 0.2s ease';

  let css = `
    /* Dyslexia-Friendly Reading Engine - Injected Styles */
    
    /* Base typography for enabled state */
    body.dyslexia-reader-enabled {
      --dyslexia-font: ${font};
      --dyslexia-font-size: ${fontSize};
      --dyslexia-line-height: ${settings.lineHeight};
      --dyslexia-letter-spacing: ${settings.letterSpacing}px;
      --dyslexia-word-spacing: ${settings.wordSpacing}px;
      --dyslexia-paragraph-spacing: ${settings.paragraphSpacing}em;
      --dyslexia-transition: ${transitions};
    }
    
    /* Apply to readable content */
    body.dyslexia-reader-enabled,
    body.dyslexia-reader-enabled article,
    body.dyslexia-reader-enabled main,
    body.dyslexia-reader-enabled .${CONTENT_WRAPPER_CLASS},
    body.dyslexia-reader-enabled [role="main"],
    body.dyslexia-reader-enabled [role="article"] {
      font-family: var(--dyslexia-font) !important;
      line-height: var(--dyslexia-line-height) !important;
      letter-spacing: var(--dyslexia-letter-spacing) !important;
      word-spacing: var(--dyslexia-word-spacing) !important;
      transition: var(--dyslexia-transition);
    }
    
    /* Text elements */
    body.dyslexia-reader-enabled p,
    body.dyslexia-reader-enabled li,
    body.dyslexia-reader-enabled span:not([class*="icon"]):not([class*="svg"]),
    body.dyslexia-reader-enabled div:not([class*="icon"]):not([class*="button"]),
    body.dyslexia-reader-enabled td,
    body.dyslexia-reader-enabled th,
    body.dyslexia-reader-enabled label,
    body.dyslexia-reader-enabled a {
      font-family: var(--dyslexia-font) !important;
      line-height: var(--dyslexia-line-height) !important;
      letter-spacing: var(--dyslexia-letter-spacing) !important;
      word-spacing: var(--dyslexia-word-spacing) !important;
    }
    
    /* Font size scaling */
    body.dyslexia-reader-enabled {
      font-size: calc(1rem * var(--dyslexia-font-size)) !important;
    }
    
    body.dyslexia-reader-enabled h1 { font-size: calc(2em * var(--dyslexia-font-size)) !important; }
    body.dyslexia-reader-enabled h2 { font-size: calc(1.75em * var(--dyslexia-font-size)) !important; }
    body.dyslexia-reader-enabled h3 { font-size: calc(1.5em * var(--dyslexia-font-size)) !important; }
    body.dyslexia-reader-enabled h4 { font-size: calc(1.25em * var(--dyslexia-font-size)) !important; }
    body.dyslexia-reader-enabled h5,
    body.dyslexia-reader-enabled h6 { font-size: calc(1.1em * var(--dyslexia-font-size)) !important; }
    
    body.dyslexia-reader-enabled p {
      margin-bottom: var(--dyslexia-paragraph-spacing) !important;
    }
    
    /* Preserve code blocks */
    body.dyslexia-reader-enabled pre,
    body.dyslexia-reader-enabled code,
    body.dyslexia-reader-enabled kbd,
    body.dyslexia-reader-enabled samp,
    body.dyslexia-reader-enabled .hljs,
    body.dyslexia-reader-enabled [class*="code"],
    body.dyslexia-reader-enabled [class*="Code"] {
      font-family: ${FONTS.mono} !important;
      letter-spacing: 0 !important;
      word-spacing: normal !important;
    }
    
    /* TTS highlighting */
    .${TTS_HIGHLIGHT_CLASS} {
      background: linear-gradient(120deg, #ffd93d 0%, #ff6b6b 100%) !important;
      color: #000 !important;
      padding: 2px 4px !important;
      border-radius: 3px !important;
      box-decoration-break: clone !important;
    }
  `;

  // Add color mode styles
  if (colors.bg) {
    // For strict modes (Dark, High Contrast), we need to be aggressive
    if (['dark', 'high-contrast'].includes(settings.colorMode)) {
      css += `
        /* Aggressive Default Mode for ${settings.colorMode} */
        body.dyslexia-reader-enabled {
          background-color: ${colors.bg} !important;
          color: ${colors.text} !important;
        }

        /* Force all elements to inherit or set color/bg */
        body.dyslexia-reader-enabled *:not(img):not(video):not(svg):not(canvas):not(iframe):not([class*="icon"]) {
          background-color: transparent !important; /* Let body bg shine through or use explicit bg */
          color: inherit !important;
          border-color: ${colors.link} !important; /* Subtle border visibility */
        }
        
        /* Re-apply bg to main containers to ensure opacity coverage */
        body.dyslexia-reader-enabled article,
        body.dyslexia-reader-enabled main,
        body.dyslexia-reader-enabled [role="main"],
        body.dyslexia-reader-enabled .${CONTENT_WRAPPER_CLASS},
        body.dyslexia-reader-enabled .mw-body, /* Wikipedia */
        body.dyslexia-reader-enabled .content,
        body.dyslexia-reader-enabled #content {
          background-color: ${colors.bg} !important;
          color: ${colors.text} !important;
        }

        /* Fix links */
        body.dyslexia-reader-enabled a,
        body.dyslexia-reader-enabled a * {
          color: ${colors.link} !important;
        }
      `;
    } else {
      // Gentle modes (Sepia, Cream, etc)
      css += `
        /* Color mode: ${settings.colorMode} */
        body.dyslexia-reader-enabled,
        body.dyslexia-reader-enabled article,
        body.dyslexia-reader-enabled main,
        body.dyslexia-reader-enabled [role="main"],
        body.dyslexia-reader-enabled [role="article"],
        body.dyslexia-reader-enabled .${CONTENT_WRAPPER_CLASS} {
          background-color: ${colors.bg} !important;
          color: ${colors.text} !important;
        }
        
        body.dyslexia-reader-enabled p,
        body.dyslexia-reader-enabled li,
        body.dyslexia-reader-enabled td,
        body.dyslexia-reader-enabled th {
          color: ${colors.text} !important;
        }
        
        body.dyslexia-reader-enabled a {
          color: ${colors.link} !important;
        }
      `;
    }

    css += `
      /* Preserve images and media in all modes */
      body.dyslexia-reader-enabled img,
      body.dyslexia-reader-enabled video,
      body.dyslexia-reader-enabled svg,
      body.dyslexia-reader-enabled canvas,
      body.dyslexia-reader-enabled picture {
        background-color: transparent !important;
        opacity: 1 !important;
      }
    `;
  }

  // Custom colors
  if (settings.colorMode === 'custom') {
    css += `
      body.dyslexia-reader-enabled,
      body.dyslexia-reader-enabled article,
      body.dyslexia-reader-enabled main {
        background-color: ${settings.customBgColor} !important;
        color: ${settings.customTextColor} !important;
      }
    `;
  }

  return css;
}

/**
 * Helper to interpolate between two RGB colors.
 * @param {object} color1 - {r, g, b}
 * @param {object} color2 - {r, g, b}
 * @param {number} factor - Interpolation factor (0 to 1)
 * @returns {object} Interpolated color {r, g, b}
 */
function interpolateColor(color1, color2, factor) {
  const result = {
    r: Math.round(color1.r + factor * (color2.r - color1.r)),
    g: Math.round(color1.g + factor * (color2.g - color1.g)),
    b: Math.round(color1.b + factor * (color2.b - color1.b))
  };
  return result;
}

/**
 * Apply BeeLine-style gradient to text
 */
function applyGradient(strength, colorMode) {
  // 1. Determine Base Text Color based on Mode
  const isDarkMode = ['dark', 'high-contrast'].includes(colorMode);
  // RGB values: High-Contrast Dark uses whiteish text, others use dark text
  const baseColor = isDarkMode ? { r: 232, g: 232, b: 232 } : { r: 34, g: 34, b: 34 };

  // 2. Determine Gradient Target Colors
  let targetColors;
  if (isDarkMode) {
    // Pastels for dark mode
    targetColors = [
      { r: 255, g: 107, b: 107 }, // Red
      { r: 255, g: 217, b: 61 },  // Yellow
      { r: 107, g: 203, b: 119 }, // Green
      { r: 77, g: 150, b: 255 },  // Blue
      { r: 155, g: 89, b: 182 }   // Purple
    ];
  } else {
    // Saturated darks for light mode
    targetColors = [
      { r: 200, g: 40, b: 40 },   // Dark Red
      { r: 200, g: 100, b: 0 },   // Dark Orange
      { r: 40, g: 160, b: 60 },   // Dark Green
      { r: 30, g: 80, b: 200 },   // Dark Blue
      { r: 120, g: 40, b: 140 }   // Dark Purple
    ];
  }

  // 3. Interpolate Colors based on Strength (0-100)
  // Strength 0 = Base Color (no gradient)
  // Strength 100 = Target Gradient Color
  const factor = strength / 100;

  const finalColors = targetColors.map(c => interpolateColor(baseColor, c, factor));

  // 4. Construct CSS
  const gradientStops = finalColors.map((c, i) => {
    const percent = i * 25;
    return `rgb(${c.r}, ${c.g}, ${c.b}) ${percent}%`;
  }).join(',\n        ');

  const gradientCSS = `
    /* BeeLine Gradient Mode */
    body.dyslexia-reader-enabled p,
    body.dyslexia-reader-enabled li {
      background: linear-gradient(
        90deg,
        ${gradientStops}
      );
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      text-fill-color: transparent;
      color: transparent !important;
    }
    
    /* Fallback for browsers that don't support background-clip: text */
    @supports not (background-clip: text) {
       /* Fallback: Just show simple colored text if Gradient is strong, otherwise base */
       body.dyslexia-reader-enabled p,
       body.dyslexia-reader-enabled li {
         color: rgb(${baseColor.r}, ${baseColor.g}, ${baseColor.b}) !important;
         -webkit-text-fill-color: inherit !important;
         text-fill-color: inherit !important;
       }
    }
  `;

  let gradientStyle = document.getElementById('dyslexia-gradient-style');
  if (!gradientStyle) {
    gradientStyle = document.createElement('style');
    gradientStyle.id = 'dyslexia-gradient-style';
    document.head.appendChild(gradientStyle);
  }

  gradientStyle.textContent = gradientCSS;
}

/**
 * Remove BeeLine gradient
 */
function removeGradient() {
  const gradientStyle = document.getElementById('dyslexia-gradient-style');
  if (gradientStyle) {
    gradientStyle.remove();
  }
}

// ========================================
// Reading Ruler
// ========================================

/**
 * Create reading ruler element
 */
function createRuler(type, opacity) {
  removeRuler(); // Remove existing ruler

  rulerElement = document.createElement('div');
  rulerElement.id = RULER_ID;

  const opacityValue = opacity / 100;

  const baseStyles = `
    position: fixed;
    left: 0;
    right: 0;
    pointer-events: none;
    z-index: 999999;
    transition: top 0.05s ease-out;
  `;

  switch (type) {
    case 'line':
      rulerElement.style.cssText = `
        ${baseStyles}
        height: 3px;
        background: linear-gradient(90deg, #6366f1, #8b5cf6, #a855f7);
        box-shadow: 0 0 10px rgba(99, 102, 241, 0.5);
        opacity: ${opacityValue};
      `;
      break;

    case 'focus-1':
      rulerElement.style.cssText = `
        ${baseStyles}
        height: 100vh;
        background: linear-gradient(
          to bottom,
          rgba(0, 0, 0, ${opacityValue * 0.8}) 0%,
          rgba(0, 0, 0, ${opacityValue * 0.8}) calc(50% - 20px),
          transparent calc(50% - 20px),
          transparent calc(50% + 20px),
          rgba(0, 0, 0, ${opacityValue * 0.8}) calc(50% + 20px),
          rgba(0, 0, 0, ${opacityValue * 0.8}) 100%
        );
      `;
      break;

    case 'focus-3':
      rulerElement.style.cssText = `
        ${baseStyles}
        height: 100vh;
        background: linear-gradient(
          to bottom,
          rgba(0, 0, 0, ${opacityValue * 0.7}) 0%,
          rgba(0, 0, 0, ${opacityValue * 0.7}) calc(50% - 60px),
          transparent calc(50% - 60px),
          transparent calc(50% + 60px),
          rgba(0, 0, 0, ${opacityValue * 0.7}) calc(50% + 60px),
          rgba(0, 0, 0, ${opacityValue * 0.7}) 100%
        );
      `;
      break;

    case 'focus-paragraph':
      rulerElement.style.cssText = `
        ${baseStyles}
        height: 100vh;
        background: linear-gradient(
          to bottom,
          rgba(0, 0, 0, ${opacityValue * 0.6}) 0%,
          rgba(0, 0, 0, ${opacityValue * 0.6}) calc(50% - 100px),
          transparent calc(50% - 100px),
          transparent calc(50% + 100px),
          rgba(0, 0, 0, ${opacityValue * 0.6}) calc(50% + 100px),
          rgba(0, 0, 0, ${opacityValue * 0.6}) 100%
        );
      `;
      break;

    default:
      rulerElement.style.cssText = `
        ${baseStyles}
        height: 2px;
        background: #6366f1;
        opacity: ${opacityValue};
      `;
  }

  document.body.appendChild(rulerElement);
}

// Ruler animation logic
let rulerRafId = null;

/**
 * Update ruler position based on mouse
 */
function updateRulerPosition(y) {
  if (!rulerElement || !currentSettings?.rulerEnabled) return;

  if (rulerRafId) cancelAnimationFrame(rulerRafId);

  rulerRafId = requestAnimationFrame(() => {
    const type = currentSettings.rulerType;
    
    // All ruler types now follow mouse movement
    if (type === 'line') {
      // Simple line follows cursor exactly
      rulerElement.style.top = `${y}px`;
    } else if (type === 'focus-1' || type === 'focus-3' || type === 'focus-paragraph') {
      // Focus rulers: move the entire overlay so the transparent area centers on cursor
      // The gradient is centered at 50vh, so we offset by (y - 50vh)
      const offset = y - (window.innerHeight / 2);
      rulerElement.style.top = `${offset}px`;
    }
  });
}

/**
 * Remove reading ruler
 */
function removeRuler() {
  // Always try to find by ID to ensure cleanup
  const existing = document.getElementById(RULER_ID);
  if (existing) {
    existing.remove();
  }
  rulerElement = null;
}

// ========================================
// Immersive Mode
// ========================================

/**
 * Apply immersive mode - dims non-content areas
 */
function applyImmersiveMode(maxWidth) {
  // Find main content
  const mainContent = window.DyslexiaDetection?.findMainContent();

  if (!mainContent) {
    return;
  }

  // Add immersive styles
  let immersiveStyle = document.getElementById('dyslexia-immersive-style');
  if (!immersiveStyle) {
    immersiveStyle = document.createElement('style');
    immersiveStyle.id = 'dyslexia-immersive-style';
    document.head.appendChild(immersiveStyle);
  }

  const immersiveCSS = `
    /* Immersive Mode */
    body.dyslexia-reader-enabled.dyslexia-immersive-active nav,
    body.dyslexia-reader-enabled.dyslexia-immersive-active header:not(article header),
    body.dyslexia-reader-enabled.dyslexia-immersive-active footer:not(article footer),
    body.dyslexia-reader-enabled.dyslexia-immersive-active aside,
    body.dyslexia-reader-enabled.dyslexia-immersive-active .sidebar,
    body.dyslexia-reader-enabled.dyslexia-immersive-active .advertisement,
    body.dyslexia-reader-enabled.dyslexia-immersive-active .ad,
    body.dyslexia-reader-enabled.dyslexia-immersive-active [role="banner"],
    body.dyslexia-reader-enabled.dyslexia-immersive-active [role="navigation"],
    body.dyslexia-reader-enabled.dyslexia-immersive-active [role="complementary"] {
      opacity: 0.15 !important;
      filter: blur(2px) !important;
      transition: opacity 0.3s ease, filter 0.3s ease !important;
    }
    
    body.dyslexia-reader-enabled.dyslexia-immersive-active nav:hover,
    body.dyslexia-reader-enabled.dyslexia-immersive-active header:hover,
    body.dyslexia-reader-enabled.dyslexia-immersive-active aside:hover {
      opacity: 1 !important;
      filter: none !important;
    }
    
    /* Center and constrain main content */
    body.dyslexia-reader-enabled.dyslexia-immersive-active article,
    body.dyslexia-reader-enabled.dyslexia-immersive-active main,
    body.dyslexia-reader-enabled.dyslexia-immersive-active [role="main"] {
      max-width: ${maxWidth}px !important;
      margin-left: auto !important;
      margin-right: auto !important;
      padding-left: 20px !important;
      padding-right: 20px !important;
    }
  `;

  immersiveStyle.textContent = immersiveCSS;
  document.body.classList.add('dyslexia-immersive-active');
}

/**
 * Remove immersive mode
 */
function removeImmersiveMode() {
  const immersiveStyle = document.getElementById('dyslexia-immersive-style');
  if (immersiveStyle) {
    immersiveStyle.remove();
  }
  document.body.classList.remove('dyslexia-immersive-active');
}

// ========================================
// Text-to-Speech (TTS)
// ========================================

/**
 * Toggle TTS playback
 */
async function toggleTTS() {
  if (ttsState.isPlaying) {
    stopTTS();
  } else {
    await startTTS();
  }
}

/**
 * Start TTS playback with robust fallback and voice loading
 */
async function startTTS() {
  // 1. Immediate Cancellation
  speechSynthesis.cancel();
  ttsState.isPlaying = false;

  // 2. Ensure Voices are Loaded
  const voice = await waitForVoices();

  // 3. Detect Content Source
  let textToRead = '';
  let rootElement = null;

  const selection = window.getSelection();
  const hasSelection = selection && !selection.isCollapsed && selection.toString().trim().length > 0;

  if (hasSelection) {
    // Case A: Read Selected Text
    textToRead = selection.toString().trim();
    console.log('[ContentScript] TTS: Using User Selection');

    // Determine context for highlighting
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      let container = range.commonAncestorContainer;
      rootElement = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
    }

  } else {
    // Case B: Fallback to Focused/Main Content
    console.log('[ContentScript] TTS: No Selection, Detecting Main Content...');

    // Attempt 1: Main Content Detector
    rootElement = window.DyslexiaDetection?.findMainContent();

    if (!rootElement) {
      console.warn('[ContentScript] TTS: No main content found. Trying backup detection.');
      // Attempt 2: Fallback to body if detection fails but text exists
      if (document.body.innerText.length > 200) {
        rootElement = document.body;
      }
    }

    if (rootElement) {
      textToRead = rootElement.innerText || rootElement.textContent; // innerText is often better for "readable" text
      console.log('[ContentScript] TTS: Found content in', rootElement.tagName);
    }
  }

  // 4. Validate Content
  if (!textToRead || textToRead.trim().length === 0) {
    console.error('[ContentScript] TTS: No readable text found.');
    showToast('No readable text found. Please select some text or navigate to a page with content.');
    return;
  }

  // 5. Prepare State
  ttsState.sentences = window.DyslexiaDetection?.splitIntoSentences(textToRead) || [textToRead];
  ttsState.currentIndex = 0;
  ttsState.rootElement = rootElement || document.body;
  ttsState.isPlaying = true;

  // 6. Begin Speaking
  speakNextSentence(voice);
}

/**
 * Wait for voices to be loaded (Chrome async issue fix)
 */
function waitForVoices() {
  return new Promise((resolve) => {
    let voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices);
      return;
    }

    // If empty, wait for event
    speechSynthesis.onvoiceschanged = () => {
      voices = speechSynthesis.getVoices();
      resolve(voices);
    };

    // Timeout fallback (some browsers don't fire event if no internet/error)
    setTimeout(() => {
      resolve(speechSynthesis.getVoices());
    }, 2000);
  });
}

/**
 * Speak the next sentence
 */
function speakNextSentence(voices) {
  if (!ttsState.isPlaying) return;

  if (ttsState.currentIndex >= ttsState.sentences.length) {
    stopTTS();
    return;
  }

  const sentence = ttsState.sentences[ttsState.currentIndex];

  // Skip empty sentences
  if (!sentence || sentence.trim().length === 0) {
    ttsState.currentIndex++;
    speakNextSentence(voices);
    return;
  }

  // Create utterance
  ttsState.utterance = new SpeechSynthesisUtterance(sentence);

  // Apply Settings
  ttsState.utterance.rate = currentSettings?.ttsRate || 1.0;
  ttsState.utterance.pitch = 1.0;
  ttsState.utterance.volume = 1.0;

  // Apply Voice
  if (currentSettings?.ttsVoice && voices) {
    const selectedVoice = voices.find(v => v.name === currentSettings.ttsVoice);
    if (selectedVoice) {
      ttsState.utterance.voice = selectedVoice;
    }
  }

  // Event Handlers
  ttsState.utterance.onstart = () => {
    if (ttsState.isPlaying) {
      highlightSentence(sentence);
    }
  };

  ttsState.utterance.onend = () => {
    clearHighlight();
    ttsState.currentIndex++;
    if (ttsState.isPlaying) {
      speakNextSentence(voices);
    }
  };

  ttsState.utterance.onerror = (e) => {
    console.error('[ContentScript] TTS Error:', e);
    // Continue despite error?
    if (e.error !== 'interrupted' && e.error !== 'canceled') {
      clearHighlight();
      ttsState.currentIndex++;
      speakNextSentence(voices);
    }
  };

  // Speak
  speechSynthesis.speak(ttsState.utterance);
}

/**
 * Pause TTS playback
 */
function pauseTTS() {
  if (!ttsState.isPlaying) return;
  
  ttsState.isPlaying = false;
  speechSynthesis.pause();
  // Keep highlight visible during pause
}

/**
 * Resume TTS playback
 */
function resumeTTS() {
  if (ttsState.isPlaying) return;
  
  ttsState.isPlaying = true;
  speechSynthesis.resume();
}

/**
 * Stop TTS playback
 */
function stopTTS() {
  ttsState.isPlaying = false;
  ttsState.currentIndex = 0;
  ttsState.sentences = [];
  ttsState.rootElement = null;
  speechSynthesis.cancel();
  clearHighlight();
}

/**
 * Highlight the current sentence being spoken
 */
function highlightSentence(sentence) {
  clearHighlight();

  const root = ttsState.rootElement || window.DyslexiaDetection?.findMainContent();
  if (!root || !root.isConnected) return; // Note: isConnected check prevents errors on detached nodes

  // Find and highlight the sentence in the DOM
  const textNodes = window.DyslexiaDetection?.getTextNodes(root) || [];

  for (const node of textNodes) {
    const nodeText = node.textContent;
    if (nodeText.includes(sentence.substring(0, 50))) {
      // Create highlight wrapper
      const range = document.createRange();
      range.selectNode(node);

      const highlight = document.createElement('span');
      highlight.className = TTS_HIGHLIGHT_CLASS;

      try {
        range.surroundContents(highlight);
        ttsState.highlightedElement = highlight;

        // Scroll into view
        highlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (e) {
        // Range might span multiple elements
      }

      break;
    }
  }
}

/**
 * Clear TTS highlight
 */
function clearHighlight() {
  if (ttsState.highlightedElement) {
    const parent = ttsState.highlightedElement.parentNode;
    if (parent) {
      while (ttsState.highlightedElement.firstChild) {
        parent.insertBefore(ttsState.highlightedElement.firstChild, ttsState.highlightedElement);
      }
      parent.removeChild(ttsState.highlightedElement);
    }
    ttsState.highlightedElement = null;
  }

  // Also clear any orphaned highlights
  document.querySelectorAll(`.${TTS_HIGHLIGHT_CLASS}`).forEach(el => {
    const parent = el.parentNode;
    while (el.firstChild) {
      parent.insertBefore(el.firstChild, el);
    }
    parent.removeChild(el);
  });
}

// ========================================
// Event Handlers
// ========================================

/**
 * Handle keyboard events
 */
function handleKeyDown(event) {
  // Future: Could add escape to close immersive mode, etc.
}

/**
 * Handle mouse movement for ruler
 */
function handleMouseMove(event) {
  if (currentSettings?.rulerEnabled) {
    updateRulerPosition(event.clientY);
  }
}

// ========================================
// Initialize on Load
// ========================================

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// Export for testing
if (typeof window !== 'undefined') {
  window.DyslexiaReader = {
    applySettings,
    removeAllStyles,
    toggleTTS,
    startTTS,
    stopTTS,
    getCurrentSettings: () => currentSettings,
    isEnabled: () => isEnabled
  };
}
