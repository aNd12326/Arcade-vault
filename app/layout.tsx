import type { Metadata } from "next";
import { Press_Start_2P, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { UserProvider } from "./_lib/user-context";
import Nav from "./_components/Nav";

const pressStart2P = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Arcade Vault",
  description: "Your retro game collection",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${pressStart2P.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <div className="av-bg" />
        <div className="av-noise" />
        <UserProvider>
          <div className="av-root">
            <Nav />
            <main className="av-main">{children}</main>
            <footer
              style={{
                padding: "24px 32px",
                borderTop: "1px solid var(--line)",
                textAlign: "center",
                fontFamily: "var(--pixel)",
                fontSize: "9px",
                color: "var(--ink-faint)",
                letterSpacing: "0.14em",
              }}
            >
              ARCADE VAULT &copy; 2026 &mdash; INSERT COIN TO CONTINUE
            </footer>
          </div>
        </UserProvider>
      </body>
    </html>
  );
}
