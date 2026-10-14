import "./globals.css";
import Header from "@/components/Header";

export const metadata = {
  title: "pr1gramm",
  description: "Die besten Bilder und Videos aus dem Netz",
};

export const viewport = { themeColor: "#ee4d2e" };

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
