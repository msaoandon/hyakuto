// jsdom has no IndexedDB; the Zustand store persists through it (idb-keyval),
// so polyfill it for tests that touch the store.
import "fake-indexeddb/auto";
