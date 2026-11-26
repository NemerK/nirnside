import type { Metadata } from "next";
import localFont from "next/font/local";
import "../globals.css";
import { ThemeProvider, themeScript } from "@/components/theme-provider";
import { ShellSwitcher } from "@/components/shell-switcher";
import type { ShellAccount } from "@/components/atlas/shell";
import { getAccount } from "@/lib/db/queries";
import { getDisabledModules, TOGGLEABLE_MODULES } from "@/lib/modules";

// Bundled with the app (same Geist as before): the build and the app both work offline.
const geistSans = localFont({
  variable: "--font-geist-sans",
  src: "../fonts/Geist-Variable.woff2",
  weight: "100 900",
  display: "swap",
});
const geistMono = localFont({
  variable: "--font-geist-mono",
  src: "../fonts/GeistMono-Variable.woff2",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nirnside — your ESO account, out of game",
  description:
    "A local, private hub for your Elder Scrolls Online account: characters, inventory, stickerbook and a live encyclopedia.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  let account: ShellAccount | null = null;
  let hiddenModules: string[] = [];
  try {
    const a = getAccount();
    if (a) {
      account = {
        displayName: a.displayName,
        region: a.region,
        esoPlus: a.esoPlus,
        lastSnapshot: a.lastSnapshot,
      };
    }
  } catch {
    account = null;
  }
  try {
    hiddenModules = getDisabledModules();
  } catch {
    hiddenModules = [];
  }

  return (
    // Pre-paint themeScript adds classes to <html> before React
    // hydrates, so attributes intentionally differ between server and client.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} look-atlas h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="h-full overflow-hidden">
        <ThemeProvider>
          <ShellSwitcher account={account} hiddenModules={hiddenModules} modules={TOGGLEABLE_MODULES}>
            {children}
          </ShellSwitcher>
        </ThemeProvider>
      </body>
    </html>
  );
}
