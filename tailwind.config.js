module.exports = {
  // ... other config
  theme: {
    extend: {
      animation: {
        glow: "glow 4s linear infinite",
      },
      keyframes: {
        glow: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
      },
    },
  },
};
