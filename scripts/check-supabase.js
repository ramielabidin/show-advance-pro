#!/usr/bin/env node
/**
 * Supabase connectivity check script.
 *
 * Usage:
 *   node scripts/check-supabase.js
 *
 * Requires .env.local to be set up:
 *   VITE_SUPABASE_URL=https://knwdjeicyisqsfiisaic.supabase.co
 *   VITE_SUPABASE_ANON_KEY=<anon key>
 *
 * Or pass env vars directly:
 *   VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... node scripts/check-supabase.js
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// Load .env.local if present
const envPath = join(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [key, ...rest] = trimmed.split("=");
    if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
  }
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
  console.error("   Copy .env.example to .env.local and fill in values.");
  process.exit(1);
}

console.log(`Checking Supabase project: ${SUPABASE_URL}\n`);

const headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  Accept: "application/json",
};

/** Check a table is accessible (returns array, even if empty) */
async function checkTable(table) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?select=id&limit=1`,
    { headers }
  );
  if (res.ok) {
    const data = await res.json();
    console.log(`  ✓ ${table} (${Array.isArray(data) ? "accessible" : "unexpected response"})`);
    return true;
  }
  const text = await res.text();
  console.log(`  ✗ ${table} — HTTP ${res.status}: ${text.slice(0, 80)}`);
  return false;
}

async function main() {
  // 1. Auth health
  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
    headers: { apikey: SUPABASE_ANON_KEY },
  });
  if (authRes.ok) {
    console.log("✓ Auth endpoint reachable");
  } else {
    console.log(`✗ Auth endpoint — HTTP ${authRes.status}`);
    const deny = authRes.headers.get("x-deny-reason");
    if (deny === "host_not_allowed") {
      console.log(
        "\n⚠️  This Supabase project restricts allowed origins/hosts.\n" +
        "   Requests from this machine are blocked.\n" +
        "   Run this script from an allowed origin (e.g., your local dev machine\n" +
        "   or a browser at http://localhost:5173) or add this IP to the\n" +
        "   Supabase allowlist: Settings → API → Allowed Hosts."
      );
      process.exit(1);
    }
  }

  // 2. Tables
  console.log("\nChecking tables:");
  const tables = [
    "shows",
    "tours",
    "teams",
    "team_members",
    "touring_party_members",
    "schedule_entries",
    "app_settings",
    "band_documents",
  ];
  let allOk = true;
  for (const t of tables) {
    const ok = await checkTable(t);
    if (!ok) allOk = false;
  }

  console.log(allOk ? "\n✓ All tables accessible" : "\n✗ Some tables failed");
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
