module.exports = {
  // ... other config
  theme: {
    extend: {
      animation: {
        glow: "glow 4s linear infinite",
        shimmer: "shimmer 2s infinite linear",
      },
      keyframes: {
        glow: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        shimmer: {
          "0%": { opacity: "0.1" },
          "50%": { opacity: "0.2" },
          "100%": { opacity: "0.1" },
        },
      },
    },
  },
};
