// tailwind.config.js
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        "aicte-navy": "#0A1F44",
        "aicte-saffron": "#FF9933",
        "aicte-green": "#138808",
      },
    },
  },
  plugins: [],
};
