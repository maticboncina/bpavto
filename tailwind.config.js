const colors = require("tailwindcss/colors");

/** @type {import('tailwindcss').Config} */
 
module.exports = {
    content: ["./src/**/*.{html,js,ts,jsx,tsx}"],
    theme: {
        extend: {
            colors: {
                background: "#111111",
                slate: colors.slate,
                gray: colors.gray,
                neutral: colors.neutral,
                stone: colors.stone,
                red: colors.red,
                orange: colors.orange,
                yellow: colors.yellow,
                green: colors.green,
                cyan: colors.cyan,
                sky: colors.sky,
                blue: colors.blue,
                indigo: colors.indigo,
            },
        },
    },
    plugins: [],
};
