/**
 * The shape the scanner caches offline. Deliberately minimal: 600 of these is
 * roughly 60KB, small enough to hold in IndexedDB and re-download on a whim.
 *
 * It carries no email, no receipt path, and no GCash reference — a scanner
 * phone is passed between volunteers and may be left unlocked on a table.
 */
export type ManifestEntry = {
  code: string;
  registrationId: string;
  fullName: string;
  yearLevel: string;
  section: string;
};

export type Manifest = {
  entries: ManifestEntry[];
  /** Server clock when the manifest was generated. */
  generatedAt: string;
};
