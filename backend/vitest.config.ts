import { defineConfig } from "vitest/config"

export default defineConfig({
    test: {
        // Vitest's default include globs the whole project, so a compiled copy
        // of a test in dist/ gets collected alongside its source and every test
        // runs twice. tsconfig.build.json keeps tests out of a real build, but
        // nothing stops a stray tsc invocation from putting one there.
        exclude: ["node_modules", "dist"],
    },
})
