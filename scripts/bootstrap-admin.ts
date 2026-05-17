import "dotenv/config";
import { customAlphabet } from "nanoid";
import { Pool } from "pg";

const nanoid = customAlphabet(
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz",
  16,
);

const [email, firstName, lastName] = process.argv.slice(2);

if (!email || !firstName || !lastName) {
  console.error(
    "Usage: npm run admin:bootstrap -- <email> <firstName> <lastName>",
  );
  console.error(
    "Example: npm run admin:bootstrap -- you@start-berlin.com Jane Doe",
  );
  process.exit(1);
}

const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) {
  console.error("DATABASE_URL must be set");
  process.exit(1);
}

const pool = new Pool({ connectionString: rawUrl, max: 1 });

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const userId = `usr_${nanoid()}`;
    const upserted = await client.query<{ id: string }>(
      `INSERT INTO "user" (
        id, name, email, email_verified,
        first_name, last_name, personal_email,
        status, created_at, updated_at
      ) VALUES ($1, $2, $3, true, $4, $5, $3, 'member', NOW(), NOW())
      ON CONFLICT (email) DO UPDATE
        SET first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            status = 'member',
            updated_at = NOW()
      RETURNING id`,
      [userId, `${firstName} ${lastName}`, email, firstName, lastName],
    );

    const id = upserted.rows[0].id;

    await client.query(
      `INSERT INTO user_access_grant (
        id, user_id, "grant", scope, department, created_at, updated_at
      ) VALUES ($1, $2, 'admin', 'global', NULL, NOW(), NOW())
      ON CONFLICT (user_id, "grant", scope, department) DO NOTHING`,
      [`aug_${nanoid()}`, id],
    );

    await client.query("COMMIT");

    console.log(`Bootstrapped admin user ${email} (${id}).`);
    console.log("Now sign in with Google at /auth to link the account.");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

main()
  .catch((err: Error) => {
    console.error("Bootstrap failed:", err.message);
    console.error(err);
    process.exit(1);
  })
  .finally(() => pool.end());
