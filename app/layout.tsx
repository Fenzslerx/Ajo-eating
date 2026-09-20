import type { Metadata } from "next";
import "./globals.css";
import { PwaProvider } from "@/components/pwa-provider";

export const metadata: Metadata = {
  title: "DogMeal",
  description: "บันทึกมื้ออาหารน้องหมา",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "DogMeal", statusBarStyle: "default" }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="th"><body>{children}<PwaProvider /></body></html>;
}
