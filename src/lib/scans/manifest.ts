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
  /**
   * When another device's "ok" scan of this code has reached the server, the
   * earliest such time — otherwise null. This is what lets a second device
   * catch a duplicate that already happened elsewhere, as long as both
   * devices are online; it does nothing during an actual signal blackout,
   * which is the accepted limitation the spec describes.
   */
  checkedInAt: string | null;
};

export type Manifest = {
  entries: ManifestEntry[];
  /** Server clock when the manifest was generated. */
  generatedAt: string;
};
