interface AppsLayoutProps {
  children: React.ReactNode;
}

/**
 * Container for internal apps, sibling to `(default)`.
 *
 * Route groups do not affect URLs, so an app declared with
 * `basePath: "/example"` still lives at /example. Apps get their own group
 * (rather than sitting in `(default)`) so they can diverge from the membership
 * pages' `max-w-4xl` column when they need the width — the same reason
 * `org-chart` sits outside `(default)`. It starts identical to the default
 * container so nothing looks different on day one.
 */
export default function AppsLayout({ children }: AppsLayoutProps) {
  return <div className="mx-auto w-full max-w-4xl flex-1 p-6">{children}</div>;
}
