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
import Navigation from "@/components/navigation";
import { ChatDock } from "@/components/ui";

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
          <header className="border-b bg-background">
            <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
              <a href="/" className="font-semibold text-foreground">Happy Journey</a>
              <nav className="flex items-center gap-4">
                <a href="/trips" className="text-sm text-foreground">Trips</a>
                <ThemeToggle />
                <SignedOut>
                  <div className="flex items-center gap-2">
                    <SignInButton mode="modal">
                      <button className="px-4 py-2 text-sm font-medium text-foreground bg-background border border-border rounded-md hover:bg-muted transition-colors">
                        Sign In
                      </button>
                    </SignInButton>
                    <SignUpButton mode="modal">
                      <button className="px-4 py-2 text-sm font-medium text-background bg-foreground border border-foreground rounded-md hover:bg-foreground/90 transition-colors">
                        Sign Up
                      </button>
                    </SignUpButton>
                  </div>
                </SignedOut>
                <SignedIn>
                  <UserButton />
                </SignedIn>
              </nav>
            </div>
          </header>
          <Navigation />
          {children}
          <ChatDock />
        </body>
      </html>
    </ClerkProvider>
  );
}
