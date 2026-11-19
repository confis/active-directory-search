import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "סדר הופעה",
  description: "הוספת שירים לפי לינק, חילוץ מילים ופזמונים, וסידור ההופעה בגרירה",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
