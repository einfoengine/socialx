import Header from "@/components/Header";
import Hero from "@/components/Hero";
import TrustStrip from "@/components/TrustStrip";
import Problem from "@/components/Problem";
import HowItWorks from "@/components/HowItWorks";
import Pricing from "@/components/Pricing";
import Comparison from "@/components/Comparison";
import WhySocialX from "@/components/WhySocialX";
import Includes from "@/components/Includes";
import Guarantees from "@/components/Guarantees";
import WhiteLabel from "@/components/WhiteLabel";
import FAQ from "@/components/FAQ";
import FinalCTA from "@/components/FinalCTA";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <TrustStrip />
        <Problem />
        <HowItWorks />
        <Pricing />
        <Comparison />
        <WhySocialX />
        <Includes />
        <Guarantees />
        <WhiteLabel />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
