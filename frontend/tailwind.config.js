/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Base surfaces - bright, not stark white, so glass panels have
        // something to read against.
        canvas: "#FAFAFC",
        surface: "#FFFFFF",
        ink: "#1A1B2E",
        muted: "#6B7089",
        // "Chain" violet - lifted directly from GenLayer's own consensus
        // diagrams (the #6D5DF5 used for chain/consensus nodes in their
        // docs), so the palette reads as GenLayer-native rather than a
        // generic Web3-purple.
        chain: {
          50: "#F3F1FF",
          100: "#EFEDFF",
          300: "#B9B0FF",
          500: "#6D5DF5",
          600: "#5744E0",
          900: "#251E63",
        },
        // "Compute" blue - the GenVM/validator color from the same source.
        compute: {
          50: "#EAF7FF",
          300: "#A8D7F2",
          500: "#2686C4",
          700: "#175A85",
          900: "#113F59",
        },
        active: {
          50: "#E9F8F0",
          300: "#8FDCB8",
          500: "#23966B",
          900: "#123F30",
        },
        halted: {
          50: "#FDEDEE",
          300: "#F3AEB4",
          500: "#D6435A",
          900: "#5A1420",
        },
        pending: {
          50: "#FFF4E5",
          300: "#F0C77E",
          500: "#D58A16",
          900: "#583705",
        },
      },
      fontFamily: {
        display: ["'Space Grotesk'", "system-ui", "sans-serif"],
        body: ["'Inter'", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glass: "0 1px 1px rgba(20, 20, 43, 0.03), 0 12px 32px -12px rgba(87, 68, 224, 0.18)",
        lift: "0 20px 45px -18px rgba(87, 68, 224, 0.35)",
      },
      backgroundImage: {
        "grid-fade":
          "radial-gradient(circle at 1px 1px, rgba(109,93,245,0.14) 1px, transparent 0)",
      },
    },
  },
  plugins: [],
};
