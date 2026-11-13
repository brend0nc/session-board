// Copy the page files that TypeScript does not compile, and make the CLI runnable.
import fs from "node:fs";

fs.mkdirSync("dist/web", { recursive: true });
for (const file of ["index.html", "style.css"]) fs.copyFileSync("web/" + file, "dist/web/" + file);
fs.chmodSync("dist/cli.js", 0o755);
