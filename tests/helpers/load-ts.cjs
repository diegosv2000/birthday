const { readFileSync } = require("node:fs");
const { createRequire } = require("node:module");
const { resolve } = require("node:path");
const { transpileModule, ModuleKind, ScriptTarget } = require("typescript");

// Ejecutar el código real de TypeScript con dependencias simuladas, sin servidor ni DB.
module.exports = function loadTs(relativePath, mocks = {}) {
  const filename = resolve(__dirname, "../..", relativePath);
  const { outputText } = transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 },
    fileName: filename,
  });
  const nativeRequire = createRequire(filename);
  const localRequire = (name) => Object.hasOwn(mocks, name) ? mocks[name] : nativeRequire(name);
  const loaded = { exports: {} };
  new Function("require", "module", "exports", outputText)(localRequire, loaded, loaded.exports);
  return loaded.exports;
};
