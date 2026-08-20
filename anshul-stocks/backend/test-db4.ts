import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function run() {
  const res = await pool.query("SELECT company_name, gmp, gmp_trends FROM ipo_data WHERE company_name ILIKE '%Tempsens%'");
  console.log(JSON.stringify(res.rows, null, 2));
  process.exit(0);
}
run();
