import "./globals.css";
import "./design-app.css";
import AppNav from "@/components/AppNav";
import AppSidebar from "@/components/AppSidebar";
import DesignToggle from "@/components/DesignToggle";
import Footer from "@/components/Footer";
import Header from "@/components/Header";

export const metadata = {
  title: "pr1gramm",
  description: "Die besten Bilder und Videos aus dem Netz",
};

export const viewport = { themeColor: "#ee4d2e" };

/** Picks the design before the first paint so the page never flashes the wrong theme. */
const DESIGN_BOOTSTRAP =
  'try{var d=localStorage.getItem("pr1.design");document.documentElement.dataset.design=d==="app"?"app":"classic"}catch(e){}';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" data-design="classic" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: DESIGN_BOOTSTRAP }} />
        <div id="page">
          <Header />
          <AppNav />
          <AppSidebar />
          <main id="main-view">{children}</main>
          <Footer />
          <DesignToggle />
        </div>
      </body>
    </html>
  );
}
