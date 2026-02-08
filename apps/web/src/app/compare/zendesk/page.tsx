import ComparePageContent from "../ComparePageContent";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Helvion vs Zendesk | Compare",
  description: "A practical comparison of Helvion and Zendesk focused on fit, rollout, and operations.",
};

export default function CompareZendeskPage() {
  return <ComparePageContent competitorKey="zendesk" />;
}
