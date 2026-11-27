import { GuideLayout } from "../_shared/GuideLayout";
import { buildGuideMetadata } from "../_shared/seo";
import { GuideClose, GuideLessons, GuideOpening } from "./_sections";
import { guideCopy } from "./guideCopy";
import { guideSpec } from "./guide.spec";

export const metadata = buildGuideMetadata(guideSpec);

export default function ClaudeCodeMasteryGuidePage() {
  // No section summary uses a live count, so the layout gets a zero it never reads.
  return <GuideLayout spec={guideSpec} deck={guideCopy} ideaCount={0} opening={<GuideOpening />} lessons={<GuideLessons />} close={<GuideClose />} />;
}
