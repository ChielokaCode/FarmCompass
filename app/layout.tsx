import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import PwaRegister from "@/components/PwaRegister";

export const metadata: Metadata = {
  title: { default: "FarmCompass", template: "%s | FarmCompass" },
  description: "AI-assisted personalised agricultural decision support for smallholder and new farmers in Nigeria.",
  applicationName: "FarmCompass",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "FarmCompass" },
  formatDetection: { telephone: false }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0f6b3d"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><PwaRegister/><Nav/>{children}</body></html>;
}
