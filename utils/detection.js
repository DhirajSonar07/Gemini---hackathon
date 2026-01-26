/**
 * Dyslexia-Friendly Reading Tool - Content Detection Engine
 * Automatically detects readable content and classifies site types
 */

// ========================================
// Site Type Classification
// ========================================

const SITE_TYPES = {
    ARTICLE: 'article',
    DOCUMENTATION: 'documentation',
    NEWS: 'news',
    SOCIAL: 'social',
    ECOMMERCE: 'ecommerce',
    FORUM: 'forum',
    UNKNOWN: 'unknown'
};

// Domain patterns for quick classification
const DOMAIN_PATTERNS = {
    documentation: [
        /docs\./i, /documentation\./i, /wiki\./i, /readme\./i,
        /developer\./i, /devdocs/i, /mdn/i, /stackoverflow/i,
        /github\.com.*readme/i, /github\.com.*wiki/i
    ],
    news: [
        /news\./i, /bbc/i, /cnn/i, /nytimes/i, /reuters/i,
        /theguardian/i, /washingtonpost/i, /huffpost/i
    ],
    social: [
        /twitter/i, /x\.com/i, /facebook/i, /instagram/i,
        /reddit/i, /linkedin/i, /tiktok/i
    ],
    forum: [
        /forum/i, /community/i, /discuss/i, /discourse/i
    ],
    ecommerce: [
        /amazon/i, /ebay/i, /shop/i, /store/i, /cart/i
    ]
};

// ========================================
// Content Selectors
// ========================================

// Elements that typically contain main readable content
const CONTENT_SELECTORS = [
    'article',
    '[role="article"]',
    '[role="main"]',
    'main',
    '.post-content',
    '.article-content',
    '.entry-content',
    '.content-body',
    '.post-body',
    '.story-body',
    '#content',
    '#main-content',
    '.markdown-body', // GitHub
    '.prose', // Many modern sites
    '.reader-content'
];

// Elements to exclude from processing
const EXCLUDE_SELECTORS = [
    'nav',
    'header:not(article header)',
    'footer:not(article footer)',
    'aside',
    '.sidebar',
    '.navigation',
    '.menu',
    '.ad',
    '.advertisement',
    '.social-share',
    '.comments',
    '.related-posts',
    'script',
    'style',
    'noscript',
    'iframe',
    'svg',
    'canvas',
    'video',
    'audio',
    'form:not(article form)',
    '[role="navigation"]',
    '[role="banner"]',
    '[role="complementary"]',
    '[aria-hidden="true"]',
    '.code-block', // Keep code separate
    'pre',
    'code'
];

// ========================================
// Detection Functions
// ========================================

/**
 * Classify the current site type based on URL and content
 * @returns {string} Site type
 */
function classifySiteType() {
    const url = window.location.href;
    const hostname = window.location.hostname;

    // Check domain patterns first (faster)
    for (const [type, patterns] of Object.entries(DOMAIN_PATTERNS)) {
        for (const pattern of patterns) {
            if (pattern.test(hostname) || pattern.test(url)) {
                return type;
            }
        }
    }

    // Check page structure
    if (document.querySelector('article') || document.querySelector('[role="article"]')) {
        // Check for news-like structure
        if (document.querySelectorAll('article').length > 3) {
            return SITE_TYPES.NEWS;
        }
        return SITE_TYPES.ARTICLE;
    }

    // Check for documentation patterns
    if (document.querySelector('.markdown-body') ||
        document.querySelector('.documentation') ||
        document.querySelector('[class*="docs"]')) {
        return SITE_TYPES.DOCUMENTATION;
    }

    return SITE_TYPES.UNKNOWN;
}

/**
 * Get optimal profile for site type
 * @param {string} siteType - Detected site type
 * @returns {string} Recommended profile ID
 */
function getOptimalProfile(siteType) {
    const profileMap = {
        [SITE_TYPES.ARTICLE]: 'balanced',
        [SITE_TYPES.DOCUMENTATION]: 'documentation',
        [SITE_TYPES.NEWS]: 'balanced',
        [SITE_TYPES.SOCIAL]: 'balanced',
        [SITE_TYPES.ECOMMERCE]: 'balanced',
        [SITE_TYPES.FORUM]: 'balanced',
        [SITE_TYPES.UNKNOWN]: 'balanced'
    };

    return profileMap[siteType] || 'balanced';
}

/**
 * Find the main readable content on the page
 * @returns {Element|null} Main content element
 */
function findMainContent() {
    // Try specific selectors first
    for (const selector of CONTENT_SELECTORS) {
        const element = document.querySelector(selector);
        if (element && isReadableContent(element)) {
            return element;
        }
    }

    // Fallback: Find element with most text
    return findLargestTextBlock();
}

/**
 * Find all readable content areas on the page
 * @returns {Element[]} Array of content elements
 */
function findAllReadableContent() {
    const contentAreas = [];

    for (const selector of CONTENT_SELECTORS) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
            if (isReadableContent(el) && !isExcluded(el)) {
                contentAreas.push(el);
            }
        });
    }

    // Deduplicate (remove nested elements)
    return deduplicateNestedElements(contentAreas);
}

/**
 * Check if an element contains readable content
 * @param {Element} element - Element to check
 * @returns {boolean} True if element has readable content
 */
function isReadableContent(element) {
    if (!element) return false;

    // Get text content length
    const text = element.textContent || '';
    const wordCount = text.trim().split(/\s+/).length;

    // Minimum thresholds
    if (wordCount < 50) return false;

    // Check for paragraph density
    const paragraphs = element.querySelectorAll('p');
    if (paragraphs.length < 2) {
        // Could still be readable if it has enough text
        if (wordCount < 200) return false;
    }

    // Check computed styles to ensure visibility
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') {
        return false;
    }

    return true;
}

/**
 * Check if an element should be excluded
 * @param {Element} element - Element to check
 * @returns {boolean} True if element should be excluded
 */
function isExcluded(element) {
    if (!element) return true;

    // Check if element matches any exclude selector
    for (const selector of EXCLUDE_SELECTORS) {
        try {
            if (element.matches(selector)) {
                return true;
            }
        } catch (e) {
            // Invalid selector, skip
        }
    }

    // Check if any parent is excluded
    let parent = element.parentElement;
    while (parent && parent !== document.body) {
        for (const selector of EXCLUDE_SELECTORS) {
            try {
                if (parent.matches(selector)) {
                    return true;
                }
            } catch (e) {
                // Invalid selector, skip
            }
        }
        parent = parent.parentElement;
    }

    return false;
}

/**
 * Find the element with the largest text block
 * @returns {Element|null} Element with most text
 */
function findLargestTextBlock() {
    let bestElement = null;
    let bestScore = 0;

    // Check common container elements
    const candidates = document.querySelectorAll('div, section, main');

    candidates.forEach(element => {
        if (isExcluded(element)) return;

        const text = element.textContent || '';
        const wordCount = text.trim().split(/\s+/).length;
        const paragraphCount = element.querySelectorAll('p').length;

        // Score based on word count and paragraph density
        const score = wordCount + (paragraphCount * 50);

        // Prefer smaller containers with good content
        const rect = element.getBoundingClientRect();
        const area = rect.width * rect.height;
        const density = score / (area || 1);

        if (wordCount > 100 && score > bestScore) {
            // Check it's not too large (full page)
            if (element !== document.body && !element.matches('html')) {
                bestElement = element;
                bestScore = score;
            }
        }
    });

    return bestElement;
}

/**
 * Remove nested/duplicate elements from array
 * @param {Element[]} elements - Array of elements
 * @returns {Element[]} Deduplicated array
 */
function deduplicateNestedElements(elements) {
    return elements.filter((el, index) => {
        // Check if this element contains any other element in the array
        for (let i = 0; i < elements.length; i++) {
            if (i !== index && el.contains(elements[i])) {
                return false; // Remove parent, keep child
            }
        }
        return true;
    });
}

/**
 * Get text nodes within an element (for TTS and highlighting)
 * @param {Element} element - Parent element
 * @returns {Text[]} Array of text nodes
 */
function getTextNodes(element) {
    const textNodes = [];
    const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function (node) {
                // Skip empty or whitespace-only nodes
                if (!node.textContent.trim()) {
                    return NodeFilter.FILTER_REJECT;
                }
                // Skip code blocks
                const parent = node.parentElement;
                if (parent && (parent.tagName === 'CODE' || parent.tagName === 'PRE')) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    let node;
    while (node = walker.nextNode()) {
        textNodes.push(node);
    }

    return textNodes;
}

/**
 * Split text into sentences for TTS
 * @param {string} text - Text to split
 * @returns {string[]} Array of sentences
 */
function splitIntoSentences(text) {
    // Split on sentence-ending punctuation followed by space
    const sentences = text.split(/(?<=[.!?])\s+/);
    return sentences.filter(s => s.trim().length > 0);
}

/**
 * Get page metadata for analytics/optimization
 * @returns {Object} Page metadata
 */
function getPageMetadata() {
    return {
        url: window.location.href,
        hostname: window.location.hostname,
        title: document.title,
        siteType: classifySiteType(),
        contentFound: !!findMainContent(),
        wordCount: estimateWordCount(),
        readingTime: estimateReadingTime(),
        hasCodeBlocks: document.querySelectorAll('pre, code').length > 0,
        hasImages: document.querySelectorAll('article img, main img').length > 0
    };
}

/**
 * Estimate total word count on page
 * @returns {number} Estimated word count
 */
function estimateWordCount() {
    const content = findMainContent();
    if (!content) return 0;

    const text = content.textContent || '';
    return text.trim().split(/\s+/).length;
}

/**
 * Estimate reading time in minutes
 * @returns {number} Estimated minutes
 */
function estimateReadingTime() {
    const words = estimateWordCount();
    const wordsPerMinute = 200; // Average reading speed
    return Math.ceil(words / wordsPerMinute);
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.DyslexiaDetection = {
        classifySiteType,
        getOptimalProfile,
        findMainContent,
        findAllReadableContent,
        isReadableContent,
        isExcluded,
        getTextNodes,
        splitIntoSentences,
        getPageMetadata,
        estimateWordCount,
        estimateReadingTime,
        SITE_TYPES,
        CONTENT_SELECTORS,
        EXCLUDE_SELECTORS
    };
}
