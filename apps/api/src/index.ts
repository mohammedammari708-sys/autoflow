import { startServer } from "./server.js";

// Entry point: `npm run dev` (tsx watch) or `node dist/index.js`.
// Env is read in config.ts; in production a missing JWT_SECRET or
// ENCRYPTION_KEY refuses to start (thrown during import).
startServer();
