// VIZ alat: the fake server of a scenario over the generated contract and its
// vectors. The files are read here (e2e is not an app file), not in test-fakes.
import { readFileSync } from "node:fs";

import { vizServer, type Contract, type Opcije, type Scenarij, type Vector } from "../../test-fakes/viz-scenariji";

const read = <T>(path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")) as T;

export const generatedServer = (scenarij: Scenarij, opcije: Opcije = {}) => vizServer(
  read<Contract>("../../../../src/client/migration-contracts.generated.json"),
  read<Vector[]>("../../../../src/client/migration-contract-vectors.generated.json"),
  scenarij,
  opcije,
);
