import type { Plugin } from "vite";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function inspectOverlay(): Plugin {
  const virtualModuleId = "virtual:inspect-overlay";
  const clientPath = resolve(__dirname, "inspect-overlay-client.js");

  return {
    name: "inspect-overlay",
    apply: "serve",

    resolveId(id) {
      if (id === virtualModuleId) return clientPath;
    },

    transformIndexHtml: {
      order: "pre",
      handler(html) {
        return html.replace(
          "</body>",
          `<script type="module">import "${virtualModuleId}"</script>\n</body>`,
        );
      },
    },
  };
}
