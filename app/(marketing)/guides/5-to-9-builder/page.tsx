import { GuideLayout } from "../_shared/GuideLayout";
import { buildGuideMetadata } from "../_shared/seo";
import { GuideClose, GuideLessons, GuideOpening } from "./_sections";
import { guideCopy } from "./guideCopy";
import { guideSpec } from "./guide.spec";
import { guideLiveIdeaCount } from "./ideaCount";

export const metadata = buildGuideMetadata(guideSpec);

export default function FiveToNineBuilderGuidePage() {
  const ideaCount = guideLiveIdeaCount();
  return (
    <GuideLayout
      spec={guideSpec}
      deck={guideCopy}
      ideaCount={ideaCount}
      opening={<GuideOpening />}
      lessons={<GuideLessons ideaCount={ideaCount} />}
      close={<GuideClose ideaCount={ideaCount} />}
    />
  );
}
