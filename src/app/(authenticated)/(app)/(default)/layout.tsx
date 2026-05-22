interface DefaultLayoutProps {
  children: React.ReactNode;
}

export default function DefaultLayout({ children }: DefaultLayoutProps) {
  return <div className="mx-auto w-full max-w-4xl flex-1 p-6">{children}</div>;
}
