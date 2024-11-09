/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,vue}",
    "./node_modules/flowbite/**/*.js"
  ],
  theme: {
    extend: {
      colors: {
        'orange-custom': '#E26D35'
      }
    },
  },
  plugins: [
    require('flowbite/plugin')
  ]
}

