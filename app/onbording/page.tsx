import type { Metadata } from "next";
import OnboardingForm from "./OnboardingForm";

export const metadata: Metadata = {
  title: "Complete Your Onboarding | socialX",
  description:
    "Provide your brand details and connect your HighLevel account to get started with socialX's automated, feature-targeted social media management.",
};

export default function OnbordingPage() {
  return <OnboardingForm />;
}
