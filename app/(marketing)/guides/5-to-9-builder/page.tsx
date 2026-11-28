import { readBuilderGuide } from "@/lib/landing/read-builder-guide";
import { GuideLayout } from "../_shared/GuideLayout";
import { buildGuideMetadata } from "../_shared/seo";
import { GuideGatedSections, GuideOpening } from "./_sections";
import { guideLiveIdeaCount } from "./ideaCount";

async function loadGuide() {
  "use cache";
  return readBuilderGuide();
}

export async function generateMetadata() {
  return buildGuideMetadata((await loadGuide()).spec);
}

export default async function FiveToNineBuilderGuidePage() {
  const guide = await loadGuide();
  const ideaCount = guideLiveIdeaCount();
  return (
    <GuideLayout
      spec={guide.spec}
      deck={guide.deck}
      ideaCount={ideaCount}
      opening={<GuideOpening guide={guide} />}
      lessons={<GuideGatedSections guide={guide} ideaCount={ideaCount} />}
      close={null}
    />
  );
}
