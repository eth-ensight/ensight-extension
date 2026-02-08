import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'ENSight',
    description: 'Real-time perception layer for Ethereum — intercepting wallet actions and explaining intent, risk, and context.',
    permissions: ['storage', 'activeTab', 'scripting'],
    host_permissions: ['<all_urls>'],
    web_accessible_resources: [
      {
        resources: ['ethereum-main-world.js'],
        matches: ['<all_urls>'],
      },
    ],
  },
  // Don't auto-launch Chrome (avoids "No Chrome installations found" if Chrome isn't in PATH).
  // Load the extension manually: chrome://extensions → Load unpacked → .output/chrome-mv3
  runner: {
    disabled: true,
  },
});
