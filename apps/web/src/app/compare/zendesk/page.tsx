import ComparePageContent from "../ComparePageContent";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Helvino vs Zendesk | Compare",
  description: "A practical comparison of Helvino and Zendesk focused on fit, rollout, and operations.",
};

export default function CompareZendeskPage() {
  return <ComparePageContent competitorKey="zendesk" />;
}
