#!/usr/bin/env bun
// build.ts - Build script for hnswlib-bun

import { $ } from "bun";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";

const platform = process.platform;
const arch = process.arch;

async function main() {
  const outputDir = join(import.meta.dir, "build");

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Download hnswlib if not exists
  const hnswlibDir = join(import.meta.dir, "hnswlib");
  if (!existsSync(hnswlibDir)) {
    console.log("Downloading hnswlib...");
    await $`git clone --depth 1 https://github.com/nmslib/hnswlib.git ${hnswlibDir}`;
  }

  // Build based on platform
  const sourceFile = join(import.meta.dir, "cpp", "hnswlib_wrapper.cpp");

  if (platform === "linux") {
    const outputFile = join(outputDir, `libhnswlib-${arch}.so`);
    console.log("Building for Linux...");
    console.log(`Output: ${outputFile}`);

    // Use Bun shell with template literal
    await $`g++ -shared -fPIC -O3 -std=c++17 -I/usr/include/eigen3 -I./hnswlib -o ${outputFile} ${sourceFile}`;

    console.log(`✓ Built ${outputFile}`);
  } else if (platform === "darwin") {
    const outputFile = join(outputDir, `libhnswlib-${arch}.dylib`);
    console.log("Building for macOS...");
    console.log(`Output: ${outputFile}`);

    await $`clang++ -dynamiclib -fPIC -O3 -std=c++17 -I/opt/homebrew/include/eigen3 -I/usr/local/include/eigen3 -I./hnswlib -o ${outputFile} ${sourceFile}`;

    console.log(`✓ Built ${outputFile}`);
  } else {
    console.error(`Unsupported platform: ${platform}`);
    process.exit(1);
  }

  console.log("\n✓ Build complete!");
}

main().catch((err: Error) => {
  console.error("Build failed:", err);
  process.exit(1);
});
