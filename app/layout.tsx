import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import "./globals.css";
import { ThemeToggle } from "@/components/theme-toggle";
import { ChatDock } from "@/components/ui";
import { ThemeLogo } from "@/components/ui/theme-logo";
import { ScrollableHeader } from "../components/scrollable-header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Happy Journey",
  description: "Happy Journey",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/logoDark.png", media: "(prefers-color-scheme: dark)" },
      { url: "/logowhite.png", media: "(prefers-color-scheme: light)" }
    ],
    apple: "/logoDark.png",
    shortcut: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
          suppressHydrationWarning={true}
        >
          <ScrollableHeader />
          <div className="pt-20 sm:pt-24">
            {children}
          </div>
          <ChatDock />
        </body>
      </html>
    </ClerkProvider>
  );
}