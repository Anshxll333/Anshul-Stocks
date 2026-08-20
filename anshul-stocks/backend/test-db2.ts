import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function run() {
  const res = await pool.query("SELECT company_name, close_date, gmp, status FROM ipo_data WHERE company_name ILIKE '%Shankesh%'");
  console.log(JSON.stringify(res.rows, null, 2));
  process.exit(0);
}
run();
