export {
  detectCapabilities,
  permissionState,
  writeClipboard,
  type Capabilities,
  type ClipboardResult,
  type ClipboardScratch,
  type PermissionAnswer,
  type PlatformEnv,
} from "./capabilities.ts";
export {
  caretScrollDelta,
  KEYBOARD_OPEN_RATIO,
  trackVisibleArea,
  visibleArea,
  type ViewportReading,
  type ViewportWindow,
  type VisibleArea,
} from "./viewport.ts";
export { layoutForWidth, meetsTargetSize, PHONE_MAX, TABLET_MAX, TARGET_MIN_AA, targetMinSize, type Layout } from "./layout.ts";
export {
  memoryStorage,
  PROBE_DATABASE,
  probeIndexedDb,
  safeLocalStorage,
  type IndexedDbProbe,
  type ProbeIdbFactory,
  type ProbeOpenRequest,
  type StorageEnv,
  type StorageLike,
} from "./storage.ts";
