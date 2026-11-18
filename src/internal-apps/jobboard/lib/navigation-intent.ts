export const BEFORE_ROUTER_POPSTATE = "cockpit:before-router-popstate";

const indexKey = "__cockpitHistoryIndex";

/** Older browsers expose a destination state at popstate, but no entry index. */
export function trackLegacyHistory() {
  const history = window.history;
  const originalReplace = history.replaceState.bind(history);
  const originalPush = history.pushState.bind(history);
  let current = Number.isSafeInteger(history.state?.[indexKey])
    ? Number(history.state[indexKey])
    : 0;
  let currentUrl = window.location.href;

  // Preserve the router's state and any unrelated structured-clone values.
  function withIndex(state: unknown, index: number) {
    if (
      state == null ||
      (typeof state === "object" &&
        Object.getPrototypeOf(state) === Object.prototype)
    )
      return { ...state, [indexKey]: index };
    return state;
  }
  originalReplace(withIndex(history.state, current), "");
  history.replaceState = (state, title, url) => {
    originalReplace(withIndex(state, current), title, url);
    currentUrl = window.location.href;
  };
  history.pushState = (state, title, url) => {
    originalPush(withIndex(state, current + 1), title, url);
    current++;
    currentUrl = window.location.href;
  };

  return () => {
    const previousUrl = new URL(currentUrl);
    currentUrl = window.location.href;
    const url = new URL(currentUrl);
    const routeChanged =
      previousUrl.pathname !== url.pathname ||
      previousUrl.search !== url.search;
    let next: unknown = history.state?.[indexKey];
    if (!Number.isSafeInteger(next)) {
      // Native fragment links can create a same-document entry without pushState.
      if (!routeChanged && previousUrl.hash !== url.hash) {
        next = current + 1;
        originalReplace(withIndex(history.state, Number(next)), "");
      } else return null;
    }
    const delta = Number(next) - current;
    current = Number(next);
    return routeChanged ? delta : null;
  };
}

export function leavesCurrentDocument(
  current: string,
  destination: string,
  intent: {
    button: number;
    modified: boolean;
    target: string;
    download: boolean;
  },
) {
  if (
    intent.button !== 0 ||
    intent.modified ||
    intent.download ||
    (intent.target !== "" && intent.target !== "_self")
  )
    return false;
  try {
    const from = new URL(current);
    const to = new URL(destination, from);
    if (to.protocol !== "http:" && to.protocol !== "https:") return false;
    return (
      from.origin !== to.origin ||
      from.pathname !== to.pathname ||
      from.search !== to.search
    );
  } catch {
    return false;
  }
}
