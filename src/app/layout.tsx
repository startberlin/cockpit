import localFont from "next/font/local";
import "./globals.css";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "@/components/ui/sonner";
import { createMetadata } from "@/lib/metadata";

const avenirNext = localFont({
  src: [
    {
      path: "../../fonts/avenirnext-medium.otf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../fonts/avenirnext-bold.otf",
      weight: "700",
      style: "normal",
    },
    {
      path: "../../fonts/avenirnext-heavy.otf",
      weight: "900",
      style: "normal",
    },
  ],
  variable: "--font-avenir-next",
  display: "swap",
});

export const metadata = createMetadata({
  title: "Cockpit",
  description: "Manage your membership, get access to software and more.",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${avenirNext.variable} antialiased`}>
        <NuqsAdapter>{children}</NuqsAdapter>
        <Toaster theme="light" />
      </body>
    </html>
  );
}
