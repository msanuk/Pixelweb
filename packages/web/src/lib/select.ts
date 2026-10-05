/**
 * Helpers for selectors used with useSyncExternalStore.
 *
 * useSyncExternalStore compares snapshots with Object.is. A selector that derives a new array or
 * object on every call (`s.items.filter(...)`) therefore never looks stable and React bails into a
 * render loop ("Maximum update depth exceeded"). `memoSelector` keeps the previous result while the
 * new one is equal under `isEqual`, so derived selectors are safe by construction.
 */

export type Selector<S, T> = (s: S) => T;

function isPlainObject(x: object): boolean {
  const proto = Object.getPrototypeOf(x);
  return proto === Object.prototype || proto === null;
}

/** Object.is on primitives; one-level comparison for arrays and plain objects. Anything else only equals itself. */
export function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  // Set, Map, Date… have no enumerable keys, so a key comparison would call any two of them equal
  if (!Array.isArray(a) && (!isPlainObject(a) || !isPlainObject(b))) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false;
    return true;
  }
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false;
  }
  return true;
}

/**
 * Wraps a selector so that it returns the previous result whenever the new one is `isEqual` to it.
 * The selector is taken through a getter so an inline arrow function that changes between renders
 * is always the latest one while the cache survives.
 */
export function memoSelector<S, T>(getSelector: () => Selector<S, T>, isEqual: (a: T, b: T) => boolean): Selector<S, T> {
  let has = false;
  let prev: T;
  return (s: S) => {
    const next = getSelector()(s);
    if (has && isEqual(prev, next)) return prev;
    has = true;
    prev = next;
    return next;
  };
}
