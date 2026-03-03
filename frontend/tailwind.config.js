/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/**/*.{html,ts}",
    ],
    theme: {
        extend: {
            colors: {
                inespasa: {
                    dark: '#3C65AB',
                    light: '#5A9AD5',
                    DEFAULT: '#3C65AB',
                }
            }
        },
    },
    plugins: [],
}
