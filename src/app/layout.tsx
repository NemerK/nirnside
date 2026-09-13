import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider, themeScript } from "@/components/theme-provider";
import { AppShell, type ShellAccount } from "@/components/app-shell";
import { getAccount } from "@/lib/db/queries";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Nirnside — your ESO account, out of game",
  description:
    "A local, private hub for your Elder Scrolls Online account: characters, inventory, stickerbook and a live encyclopedia.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  let account: ShellAccount | null = null;
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

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full">
        <ThemeProvider>
          <AppShell account={account}>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
