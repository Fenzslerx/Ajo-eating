import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, "utf-8");
  const env = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  }
  return env;
}

const localEnv = parseEnv(path.resolve(process.cwd(), ".env.local"));
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || localEnv.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  localEnv.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  localEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  localEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in environment or .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const isDryRun = process.argv.includes("--dry-run");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : undefined;
const emailArg = process.argv.find((arg) => arg.startsWith("--email="))?.split("=")[1];
const passwordArg = process.argv.find((arg) => arg.startsWith("--password="))?.split("=")[1];

async function authenticateIfRequired() {
  if (emailArg && passwordArg) {
    console.log(`Authenticating as ${emailArg}...`);
    const { error } = await supabase.auth.signInWithPassword({
      email: emailArg,
      password: passwordArg,
    });
    if (error) {
      console.error("Auth error:", error.message);
      process.exit(1);
    }
    console.log("Authenticated successfully.");
  } else if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !localEnv.SUPABASE_SERVICE_ROLE_KEY) {
    console.log("Notice: Running with Publishable/Anon key without --email & --password.");
    console.log("If your tables have RLS enabled, please pass --email=your@email.com --password=xxx or add SUPABASE_SERVICE_ROLE_KEY to .env.local to access owned rows.");
  }
}

function parseBase64(base64String) {
  const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    return {
      contentType: "image/jpeg",
      buffer: Buffer.from(base64String.replace(/^data:image\/[a-z]+;base64,/, ""), "base64"),
    };
  }
  return {
    contentType: matches[1],
    buffer: Buffer.from(matches[2], "base64"),
  };
}

async function migrateDogs() {
  console.log("\n[1/2] Checking dogs with base64 photos...");
  let query = supabase.from("dogs").select("id, name, photo").like("photo", "data:image%");
  if (limit) query = query.limit(limit);

  const { data: dogs, error } = await query;
  if (error) {
    console.error("Error querying dogs:", error.message);
    return;
  }

  console.log(`Found ${dogs?.length || 0} dogs with base64 photos.`);
  for (const dog of dogs || []) {
    const { contentType, buffer } = parseBase64(dog.photo);
    const storagePath = `${dog.id}/avatar.jpg`;
    console.log(`- Dog "${dog.name}" (${dog.id}): ${(buffer.length / 1024).toFixed(1)} KB -> ${storagePath}`);

    if (!isDryRun) {
      const { error: uploadError } = await supabase.storage
        .from("dog-photos")
        .upload(storagePath, buffer, { contentType, upsert: true });

      if (uploadError) {
        console.error(`  Upload failed:`, uploadError.message);
        continue;
      }

      const { error: updateError } = await supabase
        .from("dogs")
        .update({ photo: storagePath })
        .eq("id", dog.id);

      if (updateError) {
        console.error(`  DB update failed:`, updateError.message);
      } else {
        console.log(`  Successfully migrated dog photo to ${storagePath}`);
      }
    }
  }
}

async function migrateLogs() {
  console.log("\n[2/2] Checking logs with base64 photos...");
  let query = supabase.from("logs").select("id, dog_id, photo").like("photo", "data:image%");
  if (limit) query = query.limit(limit);

  const { data: logs, error } = await query;
  if (error) {
    console.error("Error querying logs:", error.message);
    return;
  }

  console.log(`Found ${logs?.length || 0} logs with base64 photos.`);
  for (const log of logs || []) {
    const { contentType, buffer } = parseBase64(log.photo);
    const storagePath = `${log.dog_id}/${log.id}.jpg`;
    console.log(`- Log (${log.id}) for dog (${log.dog_id}): ${(buffer.length / 1024).toFixed(1)} KB -> ${storagePath}`);

    if (!isDryRun) {
      const { error: uploadError } = await supabase.storage
        .from("meal-photos")
        .upload(storagePath, buffer, { contentType, upsert: true });

      if (uploadError) {
        console.error(`  Upload failed:`, uploadError.message);
        continue;
      }

      const { error: updateError } = await supabase
        .from("logs")
        .update({ photo: storagePath })
        .eq("id", log.id);

      if (updateError) {
        console.error(`  DB update failed:`, updateError.message);
      } else {
        console.log(`  Successfully migrated log photo to ${storagePath}`);
      }
    }
  }
}

async function main() {
  console.log("=== Supabase Base64 to Storage Migration ===");
  if (isDryRun) console.log("Mode: DRY RUN (no files uploaded, no records updated)");
  if (limit) console.log(`Limit: ${limit} records per table`);

  await authenticateIfRequired();

  await migrateDogs();
  await migrateLogs();
  console.log("\nMigration completed.");
}

main().catch(console.error);
