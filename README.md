# Dyslexia-Friendly Reading Engine

A premium accessibility tool that automatically improves web readability with smart content detection, customizable reading profiles, BeeLine gradients, reading ruler, and text-to-speech.

## Features

-   **Smart Content Detection**: Automatically detects and enhances the main content of a page (articles, documentation, news) while ignoring clutter.
-   **Customizable Profiles**: Pre-defined profiles for different needs (Balanced, High Focus, Night Reading, ADHD Focus, etc.).
-   **Typography Control**:
    -   Font selection (System, OpenDyslexic, Serif, Sans-serif).
    -   Adjustable font size, line height, letter spacing, word spacing, and paragraph spacing.
-   **Color Modes**: Normal, High Contrast, Dark, Sepia, Cream, Grey.
-   **BeeLine Gradient**: Apply color gradients to text to guide the eye from the end of one line to the beginning of the next.
-   **Reading Ruler**: A customizable ruler (line or focus mode) to help keep your place.
-   **Immersive Mode**: Dims distractions (sidebar, ads, nav) to focus only on the content.
-   **Text-to-Speech (TTS)**: Reads the content aloud with sentence highlighting.

## Installation

1.  **Clone or Download** this repository.
2.  Open **Google Chrome** (or any Chromium-based browser like Edge, Brave).
3.  Navigate to `chrome://extensions/`.
4.  Enable **Developer mode** in the top right corner.
5.  Click **Load unpacked**.
6.  Select the directory containing this extension (where `manifest.json` is located).

## Usage

1.  Click the extension icon 📖 in the browser toolbar to open the popup.
2.  **Enable** the Reading Mode toggle.
3.  Choose a **Profile** or customize settings in the **Typography** and **Features** tabs.
4.  Settings are automatically applied to the current tab.
5.  Use **Text-to-Speech** controls to listen to articles.

### Keyboard Shortcuts

-   **Alt+Shift+D**: Toggle Extension (On/Off)
-

## Technologies

-   **Manifest V3**: Modern, secure extension architecture.
-   **Vanilla JavaScript**: No heavy frameworks, ensuring fast performance.
-   **CSS Variables**: Dynamic styling updates.
-   **Chrome Storage Sync**: Syncs your settings across devices.

## Troubleshooting

-   **Font Issues**: If the OpenDyslexic font does not load, it might be blocked by the website's security policy (CSP). The extension attempts to load it from a CDN.
-   **TTS Not Working**: Ensure you are on a page with readable content.
