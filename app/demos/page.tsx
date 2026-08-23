import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FooterReveal from "@/components/FooterReveal";
import DemoGallery from "./DemoGallery";

export const metadata: Metadata = {
  title: "Demo posts | socialX",
  description:
    "See real feature-targeted posts socialX has produced for HighLevel SaaS brands, shown natively in Facebook, Instagram and LinkedIn feeds.",
};

export default function DemosPage() {
  return (
    <>
      <Header />
      <main>
        <DemoGallery />
      </main>
      <Footer />
      <FooterReveal />
    </>
  );
}
