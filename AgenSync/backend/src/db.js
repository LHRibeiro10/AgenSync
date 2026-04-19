import "dotenv/config";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL não configurada. Defina a URL do Postgres no backend/.env.");
}

const sql = postgres(connectionString, {
  max: Number(process.env.DATABASE_POOL_MAX || 5)
});

export default sql;
