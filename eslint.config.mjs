import react from "eslint-plugin-react";
import regex from "eslint-plugin-regex";
import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";
import eslintPluginUnicorn from 'eslint-plugin-unicorn'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default [{
    ignores: ["!**/*"],
}, ...compat.extends("plugin:react/recommended"), {
    plugins: {
        react,
        regex,
        unicorn: eslintPluginUnicorn
    },

    languageOptions: {
        globals: {
            ...globals.browser,
            JSX: "readonly",
            WindowEventMap: true,
            DocumentEventMap: true,
        },
    },

    settings: {
        react: {
            version: "detect",
        },
    },

    rules: {
        "unicorn/prevent-abbreviations": ["error", {
            allowList: {
                ref: true,
                Ref: true,
            },

            checkShorthandImports: false,
        }],

        "jsx-a11y/anchor-is-valid": "off",
        "jsx-a11y/no-autofocus": "off",
        "sonarjs/cognitive-complexity": "off",
        "react/button-has-type": "error",
        "react/prop-types": "off",
        "react/react-in-jsx-scope": "off",
        "jsx-a11y/no-static-element-interactions": "off",
        "jsx-a11y/click-events-have-key-events": "off",
        "react/no-unknown-property": "off",
        "sonarjs/no-nested-template-literals": "off",
        "sonarjs/no-duplicate-string": "off",
    },
}];
