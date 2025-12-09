import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Required for Neon serverless driver to work in Node.js environments (like local dev)
neonConfig.webSocketConstructor = ws;

// Create a singleton pool instance
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

export default pool;
