import "../../tokens/tokens.css";
import { SaveStatus } from "./SaveStatus";

export default { title: "Uređivač/Stanje spremanja", component: SaveStatus };

export const SavedOnDevice = { args: { state: "LOCAL_DURABLE" } } as const;
export const SavedOnServer = { args: { state: "SYNCED" } } as const;
export const Saving = { args: { state: "SAVING_LOCAL" } } as const;
export const Unsaved = { args: { state: "ERROR" } } as const;
export const Offline = { args: { state: "LOCAL_DURABLE", online: false } } as const;
export const OfflineUnsaved = { args: { state: "ERROR", online: false } } as const;
export const Blocked = { args: { state: "EDITING", blocked: true } } as const;
