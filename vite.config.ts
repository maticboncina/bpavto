import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
    base: "",
    optimizeDeps: {
        esbuildOptions: {
            target: "es2022",
        },
    },
    esbuild: {
        logOverride: { "this-is-undefined-in-esm": "silent" },
    },
    plugins: [
        react({
            babel: {
                plugins: [
                    "babel-plugin-twin",
                    "babel-plugin-macros",
                    "babel-plugin-styled-components",
                ],
            },
        }),
    ],
});
