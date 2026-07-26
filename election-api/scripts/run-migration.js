/**
 * Run SQL migration files against Supabase Postgres.
 * Requires DATABASE_URL in election-api/.env (Supabase Dashboard → Database → Connection string → URI).
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const { encryptCredential } = require("../lib/credentialVault");

const MIGRATIONS_DIR = path.join(__dirname, "../migrations");

async function migrateLegacyVoterCredentials(client) {
  const { rows } = await client.query(
    "SELECT id, plain_password FROM public.users WHERE plain_password IS NOT NULL AND plain_password <> ''"
  );
  for (const row of rows) {
    await client.query(
      "UPDATE public.users SET credential_ciphertext = $1 WHERE id = $2",
      [encryptCredential(row.plain_password), row.id]
    );
  }
  if (rows.length) {
    console.log(`  ✓ encrypted ${rows.length} legacy voter credential(s)`);
  }
}

async function verifyColumns(supabaseUrl, serviceKey) {
  const { createClient } = require("@supabase/supabase-js");
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await supabase
    .from("elections")
    .select("admin_voting_details_enabled, manual_winner_selection, manual_winner_ids, ballot_selection_rule")
    .limit(1);
  if (error) return false;
  const { error: userError } = await supabase
    .from("users")
    .select("credential_ciphertext")
    .limit(1);
  return !userError;
}

async function main() {
  const databaseUrl = (process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || "").trim();
  if (!databaseUrl) {
    console.error(
      "Missing DATABASE_URL in election-api/.env\n\n" +
        "Add your Supabase Postgres URI from:\n" +
        "  Supabase Dashboard → Project Settings → Database → Connection string → URI\n\n" +
        "Example:\n" +
        "  DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
    );
    process.exit(1);
  }

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (!files.length) {
    console.log("No migration files found.");
    return;
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log("Connected to database.");

  try {
    for (const file of files) {
      if (file === "remove-persistent-plain-passwords.sql") {
        await migrateLegacyVoterCredentials(client);
      }
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8").trim();
      if (!sql) continue;
      console.log(`Running ${file}...`);
      await client.query(sql);
      console.log(`  ✓ ${file}`);
    }
  } finally {
    await client.end();
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && serviceKey) {
    const ok = await verifyColumns(supabaseUrl, serviceKey);
    if (ok) {
      console.log("\nMigration complete — new election columns verified.");
    } else {
      console.warn("\nMigration ran but column verification failed. Check Supabase schema cache.");
    }
  } else {
    console.log("\nMigration SQL executed.");
  }
}

main().catch((err) => {
  console.error("Migration failed:", err.message || err);
  process.exit(1);
});
