import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";
import { vaultEnabled } from "./src/core/vault-policy";
import { PROVIDER_IDS } from "./src/core/model";
const savedSignIn = PROVIDER_IDS.some(vaultEnabled);

export default defineConfig({
  manifestVersion: 3,
  outDir: ".output",
  modules: ["@wxt-dev/module-react"],
  zip: {
    zipSources: false,
    excludeSources: [
      "artifacts/**",
      "local-data/**",
      "**/.env*",
      "**/*.pem",
      "**/*.key",
    ],
    artifactTemplate: "{{name}}-{{packageVersion}}-{{browser}}.zip",
  },
  vite: ({ browser }) => ({
    plugins: [tailwindcss()],
    define: {
      __MYLIMITS_BROWSER__: JSON.stringify(browser),
    },
  }),
  manifest: ({ browser }) => ({
    name: "MyLimits",
    version: "3.4.0",
    version_name: "3.4 Website tracking",
    description:
      "Keep your AI accounts, usage limits, and reset times in one place.",
    permissions: [
      "storage",
      "alarms",
      "scripting",
      "idle",
      ...(browser === "firefox" ? [] : ["sidePanel"]),
    ],
    optional_permissions: [
      "notifications",
      "cookies",
      ...(savedSignIn && browser !== "firefox"
        ? ["declarativeNetRequestWithHostAccess"]
        : []),
    ],
    optional_host_permissions: [
      "https://claude.ai/*",
      "https://chatgpt.com/*",
      "https://cursor.com/*",
      "https://api.github.com/*",
    ],
    action: {
      default_title: "MyLimits",
    },
    icons: {
      16: "icon/16.png",
      32: "icon/32.png",
      48: "icon/48.png",
      128: "icon/128.png",
    },
    ...(browser === "firefox"
      ? {
          browser_specific_settings: {
            gecko: {
              id: "mylimits@voiddev011",
              strict_min_version: "140.0",
              data_collection_permissions: { required: ["none"] },
            },
          },
        }
      : { minimum_chrome_version: "116" }),
  }),
});
