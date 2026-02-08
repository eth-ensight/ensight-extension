// wxt.config.ts
import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    permissions: ["tabs", "activeTab", "scripting", "storage", "sidePanel"],
    action: {
    },
    web_accessible_resources: [
      {
        resources: ["ethereum-main-world.js"],
        matches: ["<all_urls>"],
      },
    ],
  },
  webExt: { disabled: true },
});
