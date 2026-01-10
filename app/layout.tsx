import type { Metadata } from "next";
import { Courier_Prime } from "next/font/google";
import "./globals.css";

const courierPrime = Courier_Prime({
  weight: ['400', '700'],
  subsets: ["latin"],
  variable: "--font-courier-prime",
});

export const metadata: Metadata = {
  title: "Cluedo Note Assistant",
  description: "A Noir Detective Assistant for Cluedo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${courierPrime.variable} antialiased bg-slate-900 text-slate-200`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
