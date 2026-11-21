import "../../tokens/tokens.css";
import { SaveStatus } from "./SaveStatus";

export default { title: "Uređivač/Stanje spremanja", component: SaveStatus };

export const SavedOnDevice = { args: { state: "LOCAL_DURABLE" } };
export const SavedOnServer = { args: { state: "SYNCED" } };
export const Saving = { args: { state: "SAVING_LOCAL" } };
export const Unsaved = { args: { state: "ERROR" } };
export const Offline = { args: { state: "LOCAL_DURABLE", online: false } };
export const OfflineUnsaved = { args: { state: "ERROR", online: false } };
export const Blocked = { args: { state: "EDITING", blocked: true } };
