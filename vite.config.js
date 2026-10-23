import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Unik ID for hvert bygg. Appen sammenligner sin egen ID med /version.json
// og laster seg selv på nytt når en nyere versjon er publisert.
const BUILD_ID = process.env.GITHUB_SHA || String(Date.now());

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [
    react(),
    {
      name: 'version-file',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD_ID }) });
      },
    },
  ],
});
