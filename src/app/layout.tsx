import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Nunito_Sans } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

const nunito = Nunito_Sans({
  variable: "--font-nunito",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Pop Quiz", template: "%s · Pop Quiz" },
  description: "Live class quizzes: students join from their phones with a PIN.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Draw under notches and home bars; screens pad with env(safe-area-inset-*).
  viewportFit: "cover",
  themeColor: "#4B2BB5",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${bricolage.variable} ${nunito.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
