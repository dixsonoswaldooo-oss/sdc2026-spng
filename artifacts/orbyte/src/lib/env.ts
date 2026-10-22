// The public settings (set in .replit-artifact/artifact.toml), read here so nothing else touches import.meta.env.

/** Mock data unless VITE_USE_MOCK is exactly "false", so a missing setting still gives a working demo. */
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

/** Backend address without a trailing slash. Empty means the same server as this page (calls go to /api/...). */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

/**
 * Google Sheet with the demo data (the long ID in its link: docs.google.com/spreadsheets/d/<ID>/edit).
 * Empty means the built-in Kopi Kawan data. Only used in mock mode.
 */
export const SHEET_ID = (import.meta.env.VITE_SHEET_ID ?? '').trim();

/** The floating Demo button shows only when VITE_DEMO_MODE is "true". */
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';
