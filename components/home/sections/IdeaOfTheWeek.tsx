import { GOAL_LABEL } from "@/lib/home/labels";
import type { SpotlightIdea } from "@/lib/home/types";
import { clamp } from "@/lib/home/text";
import { cn } from "@/lib/utils";
import { IdeaArt } from "../IdeaArt";
import { ButtonLink, CategoryTag, Container, Label, ScoreCell, StepList, TextLink, WeekendMeter } from "../ui";

/** 03 · Idea of the week, a new pick every Monday. */
export function IdeaOfTheWeek({ idea, weekLabel, total }: { idea: SpotlightIdea; weekLabel: string; total: number }) {
  const titleSize = idea.title.length <= 45 ? "lg:text-[72px]" : idea.title.length <= 62 ? "lg:text-[64px]" : "lg:text-[56px]";
  return (
    <section aria-labelledby="home-iotw-title" data-scene="spotlight" className="bg-home-ink pb-16 lg:pb-[120px]">
      <div data-m="stage" className="relative h-[clamp(300px,32.6vw,720px)] overflow-hidden">
        <div data-m="art" className="absolute inset-0">
          <IdeaArt src={idea.art} sizes="(min-width: 1024px) 125vw, 260vw" className="size-full" />
        </div>
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgba(26,24,20,0.1)_0%,rgba(26,24,20,0.3)_40%,rgba(26,24,20,0.96)_100%)]" />
        <Container className="relative flex h-full flex-col justify-between pb-5 pt-5 lg:pt-14">
          <p data-m="rise" className="inline-flex h-[30px] w-fit items-center gap-2 rounded-full bg-home-card px-3 font-mono text-[10.5px] tracking-[0.06em] text-home-ink lg:h-9 lg:px-4 lg:text-xs">
            <span aria-hidden className="size-1.5 rounded-full bg-home-orange lg:size-[7px]" />
            IDEA OF THE WEEK · {weekLabel.toUpperCase()}
          </p>
          <div className="flex flex-col gap-3 lg:gap-4">
            <div data-m="rise" className="flex flex-wrap items-center gap-2 lg:gap-2.5">
              <CategoryTag slug={idea.category} name={idea.categoryName} />
              <span className="font-mono text-[11px] tracking-[0.06em] text-home-d2 lg:text-xs">
                {idea.buildTime} HRS · {(GOAL_LABEL[idea.revenueGoal] ?? "").toUpperCase()} GOAL
              </span>
            </div>
            <h2
              id="home-iotw-title"
              data-m="lines"
              className={cn("max-w-[1100px] font-editorial text-[34px] font-normal leading-[1.04] tracking-[-0.02em] text-home-d1 lg:leading-none lg:tracking-[-0.025em]", titleSize)}
            >
              {idea.title}
            </h2>
          </div>
        </Container>
      </div>
      <Container m="cols" className="grid grid-cols-1 gap-6 pt-6 lg:grid-cols-[1.1fr_1fr_1fr] lg:gap-14 lg:pt-12">
        <div className="flex flex-col gap-5 lg:gap-6">
          <p className="max-w-[400px] text-base leading-[1.55] text-home-d2 lg:text-lg">{clamp(idea.description, 200)}</p>
          <ButtonLink href={`/ideas/${idea.slug}`} tone="dark" className="w-full lg:w-fit">
            Read the research
          </ButtonLink>
          <TextLink href="/startup-ideas" dark className="self-center lg:self-start">
            Browse all {total} ideas
          </TextLink>
        </div>
        <div className="flex flex-col gap-3 border-t border-home-dr pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <Label dark>How it works</Label>
          <StepList steps={idea.how} dark />
        </div>
        <div className="flex flex-col gap-4 border-t border-home-dr pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <Label dark>The numbers</Label>
          <WeekendMeter hours={idea.buildTime} dark />
          <div className="grid grid-cols-2 gap-2">
            <ScoreCell label="OPPORTUNITY" value={idea.scores.opportunity} dark />
            <ScoreCell label="PAIN" value={idea.scores.pain} dark />
            <ScoreCell label="TIMING" value={idea.scores.timing} dark />
            <ScoreCell label="BUILDABLE" value={idea.scores.builder_confidence} dark />
          </div>
          <p className="text-sm text-home-d2">{idea.sources} cited sources behind the research</p>
        </div>
      </Container>
    </section>
  );
}
