import { defineConfig, loadEnv } from "vite";
import { resolve } from "node:path";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    root: "demo",
    publicDir: resolve("public"),
    resolve: { alias: { "@": resolve(".") } },
    define: {
      "process.env.NEXT_PUBLIC_STATIC_TRIAL": JSON.stringify("true"),
      "process.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify(
        env.NEXT_PUBLIC_SUPABASE_URL || "",
      ),
      "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY": JSON.stringify(
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      ),
    },
    build: { outDir: "../dist-demo", emptyOutDir: true },
  };
});
