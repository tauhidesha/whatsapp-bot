const fs = require('fs');

/**
 * Robustly find the Chromium/Chrome executable path especially for GCP/Linux.
 * Prefers non-snap binaries to avoid cgroup issues.
 */
function getChromiumPath() {
    // 1. Check environment variable first
    if (process.env.CHROMIUM_PATH && fs.existsSync(process.env.CHROMIUM_PATH)) {
        return process.env.CHROMIUM_PATH;
    }
    if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
        return process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    // 2. Common Linux paths (prefer google-chrome-stable over snap)
    const linuxPaths = [
        '/usr/bin/google-chrome-stable',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/snap/bin/chromium', // Last resort
    ];

    for (const p of linuxPaths) {
        if (fs.existsSync(p)) return p;
    }

    return undefined;
}

const DEFAULT_CHROME_ARGS = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--remote-debugging-pipe',
    '--disable-background-networking',
    '--disable-background-timer-throttling',
    '--disable-client-side-phishing-detection',
    '--disable-component-update',
    '--disable-default-apps',
    '--disable-domain-reliability',
    '--disable-extensions',
    '--disable-popup-blocking',
    '--disable-renderer-backgrounding',
    '--disable-sync',
    '--disable-accelerated-2d-canvas',
    '--disable-print-preview',
    '--disable-prompt-on-repost',
    '--metrics-recording-only',
    '--mute-audio',
    '--no-default-browser-check',
    '--no-first-run',
    '--password-store=basic',
    '--use-mock-keychain',
    '--hide-scrollbars',
    '--remote-debugging-port=0',
    '--disable-software-rasterizer',
    '--disable-features=IsolateOrigins,site-per-process',
    '--disable-web-security',
    '--disable-site-isolation-trials',
    '--disable-webgl',
    '--js-flags="--max-old-space-size=2048"',
    '--disk-cache-size=20000000',
    '--disable-breakpad',
    '--disable-hang-monitor',
    '--disable-ipc-flooding-protection',
    '--no-zygote',
    '--enable-features=NetworkService,NetworkServiceInProcess',
    '--disable-blink-features=AutomationControlled',
    '--exclude-switches=enable-automation',
    '--disable-infobars',
    '--window-size=1920,1080',
    '--start-maximized',
];

module.exports = {
    getChromiumPath,
    DEFAULT_CHROME_ARGS
};
