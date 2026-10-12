import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Saat development, request /api diteruskan ke Flask (python api/index.py)
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:5000" } },
});
