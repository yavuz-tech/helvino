import ComparePageContent from "../ComparePageContent";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Helvino vs Intercom | Compare",
  description: "A practical comparison of Helvino and Intercom focused on fit, rollout, and operations.",
};

export default function CompareIntercomPage() {
  return (
    <ComparePageContent competitorKey="intercom" />
  );
}
