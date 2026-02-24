# Dyslexia-Friendly Reading Engine: Project Description

## 1. Executive Summary
The **Dyslexia-Friendly Reading Engine** is a sophisticated browser extension designed to transform the web reading experience for individuals with dyslexia, ADHD, and visual processing differences. By leveraging smart content detection and dynamic styling, it instantly converts cluttered, difficult-to-read web pages into accessible, calm, and highly readable environments tailored to the user's neurological needs.

## 2. Problem Statement
The modern web is hostile to neurodiverse readers:
-   **Clutter**: Ads, sidebars, and pop-ups break concentration.
-   **Typography**: Standard fonts and tight spacing cause "visual crowding," making letters merge together.
-   **Contrast**: Stark black-on-white high contrast can cause eye strain and halo effects for some readers.
-   **Tracking**: Users with dyslexia often struggle to keep their eyes on the correct line (linear tracking issues).

## 3. The Solution
Our engine acts as an intelligent layer between the website and the user. It doesn't just zoom text; it reconstructs the reading experience.

### Key Innovations
*   **Smart "Reader Mode" Detection**: Unlike basic blockers, our algorithm intelligently identifies the *main content* of a page (article, documentation, news) and isolates it, dimming distractions.
*   **BeeLine-Inspired Gradient**: A scientifically-backed technique where text color gradients guide the eye from the end of one line to the beginning of the next, significantly reducing "line skipping."
*   **Neurological Profiles**: One-click presets customized for different needs (e.g., "ADHD Focus" maximizes stimulation to prevent boredom, "Night Mode" reduces blue light).

## 4. Detailed Feature Set

### A. Accessibility Core
-   **OpenDyslexic Font**: Integrated support for the specialized font designed to prevent letter flipping.
-   **Typographic Control**: Fine-grained control over:
    -   Font Size (50% - 200%)
    -   Line Height (Leading)
    -   Letter Spacing (Tracking)
    -   Word Spacing
    -   Paragraph Spacing

### B. Visual Aids
-   **BeeLine Gradient**: Customizable strength sliders to blend gradients (Red -> Blue -> Purple) into text for tracking assistance.
-   **Reading Ruler**: A digital guide (purple line or focus band) that follows the mouse cursor to isolate the current line of text.
-   **Immersive Mode**: automatically dims purely decorative elements (navbars, ads, footers) to 15% opacity, spotlighting only the text.

### C. Text-to-Speech (TTS)
-   **Smart Playback**: Reads only the main content, skipping navigation and menus.
-   **Visual Synchronization**: Highlights the current sentence being read to reinforce word-sound association.

### D. Adaptive Themes
-   **Night Mode**: A "True Dark" mode that forces dark backgrounds even on sites that don't support it, preventing white-on-white text issues.
-   **Sepia & Cream**: Low-contrast themes to reduce visual stress.

## 5. Technical Architecture

### Stack
-   **Frontend**: Vanilla JavaScript (ES6+), CSS3 Variables.
-   **Manifest**: Chrome Extension Manifest V3 (Privacy-first).
-   **Storage**: Chrome Search Sync API for cross-device setting persistence.

### Logic Flow
1.  **Detection**: `detection.js` scans the DOM using heuristics (density of text, specific selectors) to classify the page type (Article, Documentation, News).
2.  **Injection**: `contentScript.js` creates a Shadow DOM or scoped style blocks to override site styles without breaking functional layout.
3.  **Optimization**: Heavy rendering tasks (like gradient calculation) are optimized using CSS properties (`background-clip: text`) with JS fallbacks for older renderers.

## 6. Future Roadmap
-   **AI Simplification**: Integration with Gemini/LLMs to "Simplify Text" (rewrite complex paragraphs into simple language).
-   **PDF Support**: Extending the engine to render PDF files in the browser.
-   **Eye Tracking**: WebCam-based scrolling integration.

---
*Built for the Gemini Hackathon.*
