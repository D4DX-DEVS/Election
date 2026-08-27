import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(portalRoot, ".env") });
