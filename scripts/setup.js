// Cross-platform first-run helper (works in PowerShell, cmd, zsh, bash).
import { copyFileSync, existsSync } from "node:fs";
if (!existsSync(".env")) {
  copyFileSync(".env.example", ".env");
  console.log("Created .env. Paste your ANTHROPIC_API_KEY into it, or leave it blank for mock mode.");
} else {
  console.log(".env already exists; leaving it alone.");
}
console.log("Next: npm run mock   (or npm start with a key), then load extension/ via chrome://extensions > Load unpacked");
