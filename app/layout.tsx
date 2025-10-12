import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "./components/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "bohlweg | Braunschweig",
  description: "Datenplattform für die OGs von bohlweg - Bürgerideen, Mängelmelder und weitere städtische Datenpunkte aus Braunschweig übersichtlich zusammengeführt.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className={inter.className}>
        <div className="min-h-screen">
          <Navbar />
          {children}
        </div>
      </body>
    </html>
  );
}
