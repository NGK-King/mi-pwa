
import { neon } from "@neondatabase/serverless";

const connectionString =
    process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!connectionString) {
    throw new Error("No se encontró la conexión con Neon");
}

const sql = neon(connectionString);

export default sql;
