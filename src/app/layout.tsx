import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider, themeScript } from "@/components/theme-provider";
import { LookProvider, lookScript } from "@/components/look-provider";
import { ShellSwitcher } from "@/components/shell-switcher";
import type { ShellAccount } from "@/components/app-shell";
import { getAccount } from "@/lib/db/queries";
import { LOOK_COOKIE, normalizeLook } from "@/lib/look";
import { getDisabledModules, TOGGLEABLE_MODULES } from "@/lib/modules";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Nirnside — your ESO account, out of game",
  description:
    "A local, private hub for your Elder Scrolls Online account: characters, inventory, stickerbook and a live encyclopedia.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const look = normalizeLook((await cookies()).get(LOOK_COOKIE)?.value);
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
    // Pre-paint themeScript + lookScript add classes to <html> before React
    // hydrates, so attributes intentionally differ between server and client.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: lookScript }} />
      </head>
      <body className="h-full overflow-hidden">
        <ThemeProvider>
          <LookProvider initialLook={look}>
            <ShellSwitcher account={account} hiddenModules={hiddenModules} modules={TOGGLEABLE_MODULES}>
              {children}
            </ShellSwitcher>
          </LookProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
