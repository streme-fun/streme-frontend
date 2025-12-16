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
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
      },
    },
  },
};
