export const BEFORE_ROUTER_POPSTATE = "cockpit:before-router-popstate";

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
