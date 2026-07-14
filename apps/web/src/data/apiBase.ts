// Shared opt-in API base (DEV_PLAN Phase 3). Unset = sync and auth are both
// fully absent: no fetch, no guest session, no Account UI — IndexedDB stays
// the sole source of truth. Read once at module load like any other
// build-time env var.
export const API = process.env.NEXT_PUBLIC_API_URL;
export const syncEnabled = Boolean(API);
