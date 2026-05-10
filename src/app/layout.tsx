import localFont from "next/font/local";
import "./globals.css";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { QueryProvider } from "@/components/query-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
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
  description:
    "Sign in to START Cockpit with your START Berlin Google account.",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${avenirNext.variable} antialiased`}>
        <NuqsAdapter>
          <QueryProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </QueryProvider>
        </NuqsAdapter>
        <Toaster theme="light" />
      </body>
    </html>
  );
}
