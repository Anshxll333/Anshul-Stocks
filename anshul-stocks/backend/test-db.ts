import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function run() {
  const res = await pool.query("SELECT id, symbol, company_name, gmp, gmp_trends, created_at, updated_at FROM ipo_data WHERE company_name ILIKE '%Shankesh%' OR company_name ILIKE '%Augmont%'");
  console.log(JSON.stringify(res.rows, null, 2));
  process.exit(0);
}
run();
