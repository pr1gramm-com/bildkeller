import "./globals.css";
import Header from "@/components/Header";

export const metadata = {
  title: "Bildkeller",
  description: "Self-hosted imageboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        <Header />
        <main>{children}</main>
      </body>
    </html>
  );
}
