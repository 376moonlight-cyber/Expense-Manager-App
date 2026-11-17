import { randomBytes } from "crypto";
import { existsSync, readFileSync, writeFileSync } from "fs";

const secret = randomBytes(32).toString("base64url");
const paths = [".env", ".env.local"];
const existingEnv = paths.filter((p) => existsSync(p));

function ensureKeys(filePath, createIfMissing) {
  let text = "";
  if (existsSync(filePath)) {
    text = readFileSync(filePath, "utf8");
  } else if (!createIfMissing) {
    return;
  }

  const additions = [];
  if (!/^AUTH_SECRET=/m.test(text)) {
    additions.push(`AUTH_SECRET="${secret}"`);
  }
  if (!/^AUTH_TRUST_HOST=/m.test(text)) {
    additions.push("AUTH_TRUST_HOST=true");
  }

  if (additions.length === 0) {
    console.log(`Auth env already set in ${filePath}`);
    return;
  }

  const prefix = text.length === 0 || text.endsWith("\n") ? "" : "\n";
  const next = `${text}${prefix}${additions.join("\n")}\n`;
  if (existsSync(filePath)) {
    writeFileSync(filePath, next);
  } else {
    writeFileSync(filePath, next);
  }
  console.log(`Updated ${filePath} with ${additions.map((l) => l.split("=")[0]).join(", ")}`);
}

if (existingEnv.length === 0) {
  ensureKeys(".env.local", true);
} else {
  for (const path of existingEnv) {
    ensureKeys(path, false);
  }
}
