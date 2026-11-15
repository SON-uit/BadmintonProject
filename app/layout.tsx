import type { Metadata, Viewport } from "next";
import { Baloo_2, Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";

const beVietnam = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-be-vietnam",
});

// font tiêu đề tròn trịa, vui mắt
const baloo = Baloo_2({
  subsets: ["latin", "vietnamese"],
  weight: ["600", "700", "800"],
  variable: "--font-baloo",
});

export const metadata: Metadata = {
  title: "Badminton Mate – Xếp sân cầu lông",
  description: "Xếp sân đánh đôi cầu lông dạng game 3D: điểm danh, sảnh chờ, kéo thả, xếp ngẫu nhiên, tính tiền.",
  applicationName: "Badminton Mate",
  // "Thêm vào màn hình chính" trên iPhone: mở toàn màn hình như app
  appleWebApp: { capable: true, title: "Badminton Mate", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // phủ cả vùng tai thỏ / thanh home; các thanh HUD tự chừa env(safe-area-inset-*)
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
    { media: "(prefers-color-scheme: light)", color: "#0f172a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${beVietnam.variable} ${baloo.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
