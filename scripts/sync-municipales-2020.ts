import "dotenv/config";
import { syncMunicipales2020 } from "../src/services/sync/municipales-2020";

const statsOnly = process.argv.includes("--stats");
syncMunicipales2020(statsOnly);
