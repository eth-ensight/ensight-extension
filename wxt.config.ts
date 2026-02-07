// wxt.config.ts
import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    permissions: ["tabs", "activeTab", "scripting", "storage"],
    action: {
      default_popup: "popup.html",
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
