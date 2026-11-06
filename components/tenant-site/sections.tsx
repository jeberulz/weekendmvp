import type { ReactNode } from "react";
import {
  DIRECTION_LAYOUTS,
  SECTION_ANCHORS,
  isSafeHttpsUrl,
  type ArtDirection,
  type Cta,
  type ImageSpec,
  type LandingSectionKey,
  type LandingSpec,
  type SectionLayout,
} from "@/lib/workspace/contracts/artifacts";
import { TenantIcon, type TenantIconWeight } from "./icons";
import { PLATFORM_TEXT, copyrightLine } from "./platform-text";
import s from "./tenant-site.module.css";

export const cx = (...names: (string | false | undefined)[]): string => names.filter(Boolean).join(" ");

/** The layout the spec asked for when the direction allows it, else the direction's first allowed one. */
export function resolveLayout<S extends LandingSectionKey>(section: S, requested: unknown, direction: ArtDirection): SectionLayout<S> {
  const allowed: readonly SectionLayout<S>[] = DIRECTION_LAYOUTS[direction][section];
  return allowed.find((layout) => layout === requested) ?? allowed[0];
}

export const ICON_WEIGHTS: Readonly<Record<ArtDirection, TenantIconWeight>> = {
  editorial: "light",
  warm_utility: "regular",
  bold_geometric: "bold",
  quiet_technical: "regular",
  handmade: "duotone",
  dense_product: "regular",
};

const ANCHOR = /^#[a-z][a-z0-9-]*$/;

/** An in-page anchor to a section that is present, or a safe https URL; anything else is not a link. */
function safeTarget(target: unknown, anchors: ReadonlySet<string>): string | null {
  if (typeof target !== "string") return null;
  if (ANCHOR.test(target)) return anchors.has(target) ? target : null;
  return isSafeHttpsUrl(target) ? target : null;
}

function ExternalHint() {
  return <span className={s.srOnly}>{PLATFORM_TEXT.opensInNewTab}</span>;
}

export function CtaLink({ cta, className, anchors }: { cta: Cta; className?: string; anchors: ReadonlySet<string> }) {
  const href = safeTarget(cta.target, anchors);
  if (href === null) return <span>{cta.label}</span>;
  if (href.startsWith("#")) return <a className={className} href={href}>{cta.label}</a>;
  return (
    <a className={className} href={href} target="_blank" rel="noopener noreferrer">
      {cta.label}
      <ExternalHint />
    </a>
  );
}

/** Text whose `emphasis` is its closing words: underlined in the accent, never recoloured. */
export function Emphasised({ text, emphasis }: { text: string; emphasis?: string }) {
  if (!emphasis || !text.endsWith(emphasis)) return <>{text}</>;
  return (
    <>
      {text.slice(0, text.length - emphasis.length)}
      <em className={s.em}>{emphasis}</em>
    </>
  );
}

type Moment = { title: string; body: string; caption?: string };

/** Art for an image slot. The contract has no image URL yet, so the slot draws the direction's brand-coloured plate. */
function Plate({ image, moment, className }: { image: ImageSpec; moment?: Moment; className?: string }) {
  return (
    <div className={cx(s.plate, className)}>
      <div className={s.fill} role="img" aria-label={image.alt} />
      {moment ? (
        <div className={s.moment}>
          <strong>{moment.title}</strong>
          <span>{moment.body}</span>
          {moment.caption ? <small>{moment.caption}</small> : null}
        </div>
      ) : null}
    </div>
  );
}

type Anchored = { anchors: ReadonlySet<string> };

export function Nav({ nav, anchors }: { nav: LandingSpec["nav"] } & Anchored) {
  return (
    <header className={s.nav}>
      <div className={cx(s.wrap, s.navInner)}>
        <a className={s.brand} href={SECTION_ANCHORS.hero}>{nav.brandName}</a>
        {nav.links.length > 0 ? (
          <nav aria-label={PLATFORM_TEXT.navLabel}>
            <ul className={s.navLinks}>
              {nav.links.map((link, index) => (
                <li key={`${index}-${link.label}`}><CtaLink cta={link} anchors={anchors} /></li>
              ))}
            </ul>
          </nav>
        ) : null}
        <CtaLink cta={nav.cta} className={s.btn} anchors={anchors} />
      </div>
    </header>
  );
}

export function Hero({ hero, layout, anchors }: { hero: LandingSpec["hero"]; layout: SectionLayout<"hero"> } & Anchored) {
  const bleed = layout === "full_bleed_media";
  const moment = hero.productMoment;
  const media =
    layout === "type_led" || bleed ? null : layout === "product_frame" ? (
      <div className={s.frame}><Plate image={hero.image} moment={moment} /></div>
    ) : (
      <Plate image={hero.image} moment={moment} />
    );
  return (
    <section id={SECTION_ANCHORS.hero.slice(1)} className={s.hero} data-layout={layout} aria-labelledby="tsr-title">
      {bleed ? <Plate image={hero.image} moment={moment} /> : null}
      <div className={s.wrap}>
        <div className={s.heroGrid}>
          <div className={cx(s.heroCopy, bleed && s.inverse)}>
            <h1 id="tsr-title" className={s.h1}><Emphasised {...hero.headline} /></h1>
            <p className={s.lead}>{hero.subhead}</p>
            <div className={s.ctas}>
              <CtaLink cta={hero.primaryCta} className={s.btn} anchors={anchors} />
              {hero.secondaryCta ? <CtaLink cta={hero.secondaryCta} className={s.btnGhost} anchors={anchors} /> : null}
            </div>
            {hero.reassurance ? <p className={s.small}>{hero.reassurance}</p> : null}
          </div>
          {media}
        </div>
      </div>
    </section>
  );
}

export function Promises({ promises, layout, weight }: { promises: NonNullable<LandingSpec["promises"]>; layout: SectionLayout<"promises">; weight: TenantIconWeight }) {
  return (
    <section id={SECTION_ANCHORS.promises.slice(1)} className={cx(s.section, s.promises)} data-layout={layout} aria-labelledby="tsr-why">
      <div className={s.wrap}>
        <h2 id="tsr-why" className={s.srOnly}>{PLATFORM_TEXT.promisesHeading}</h2>
        <ul className={s.promiseList}>
          {promises.items.map((item, index) => (
            <li key={`${index}-${item.title}`} className={s.promise}>
              {item.icon ? <TenantIcon name={item.icon} weight={weight} className={s.icon} /> : <span aria-hidden="true" className={s.icon} />}
              <div>
                <h3 className={s.h3}>{item.title}</h3>
                <p>{item.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function HowItWorks({ how, layout }: { how: NonNullable<LandingSpec["how_it_works"]>; layout: SectionLayout<"how_it_works"> }) {
  return (
    <section id={SECTION_ANCHORS.how_it_works.slice(1)} className={cx(s.section, s.how)} data-layout={layout} aria-labelledby="tsr-how">
      <div className={s.wrap}>
        <h2 id="tsr-how" className={s.h2}>{how.heading}</h2>
        <ol className={s.steps}>
          {how.steps.map((step, index) => (
            <li key={`${index}-${step.title}`} className={s.step}>
              <h3 className={s.h3}>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function AppPreview({ app, layout, anchors }: { app: NonNullable<LandingSpec["app_preview"]>; layout: SectionLayout<"app_preview"> } & Anchored) {
  const screen = <Plate image={app.screen} />;
  return (
    <section id={SECTION_ANCHORS.app_preview.slice(1)} className={cx(s.section, s.app, s.surface)} data-layout={layout} aria-labelledby="tsr-app">
      <div className={s.wrap}>
        <div className={s.appGrid}>
          <div>
            <h2 id="tsr-app" className={s.h2}>{app.heading}</h2>
            <p className={s.body}>{app.body}</p>
            <CtaLink cta={app.cta} className={s.btn} anchors={anchors} />
          </div>
          {layout === "device_frame" ? <div className={s.device}>{screen}</div> : screen}
        </div>
      </div>
    </section>
  );
}

/** What S5b's form needs to match each direction; the form is a client component and only borrows these classes. */
export const waitlistClasses = { slot: s.slot, label: s.label, input: s.field, button: s.btn, status: s.status } as const;

/** Shown until S5b passes the real form: the same controls, disabled, in no `<form>`, so nothing can post. */
function WaitlistPlaceholder({ waitlist }: { waitlist: LandingSpec["waitlist"] }) {
  return (
    <div className={s.slot} data-waitlist-slot="placeholder">
      <label className={s.label} htmlFor="tsr-email">{waitlist.emailLabel}</label>
      <input id="tsr-email" className={s.field} type="email" autoComplete="email" disabled />
      <button type="button" className={s.btn} disabled>{waitlist.buttonLabel}</button>
      <p className={s.status}>{PLATFORM_TEXT.previewFormNote}</p>
    </div>
  );
}

export function WaitlistSection({ waitlist, layout, slot }: { waitlist: LandingSpec["waitlist"]; layout: SectionLayout<"waitlist">; slot?: ReactNode }) {
  const tone = layout === "split" ? s.inverse : layout === "inline_band" ? s.surface : undefined;
  return (
    <section id={SECTION_ANCHORS.waitlist.slice(1)} className={cx(s.section, s.waitlist, tone)} data-layout={layout} aria-labelledby="tsr-waitlist">
      <div className={s.wrap}>
        <div className={s.wlBox}>
          <div>
            <h2 id="tsr-waitlist" className={s.h2}>{waitlist.heading}</h2>
            <p className={s.body}>{waitlist.body}</p>
          </div>
          <div>
            {slot ?? <WaitlistPlaceholder waitlist={waitlist} />}
            <p className={s.privacy}>
              {PLATFORM_TEXT.waitlistPrivacy}{" "}
              <a href={PLATFORM_TEXT.waitlistPrivacyHref} target="_blank" rel="noopener noreferrer">
                {PLATFORM_TEXT.waitlistPrivacyLink}
                <ExternalHint />
              </a>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Footer({ footer, layout, year, anchors }: { footer: LandingSpec["footer"]; layout: SectionLayout<"footer">; year: number } & Anchored) {
  return (
    <footer id={SECTION_ANCHORS.footer.slice(1)} className={cx(s.footer, layout === "statement" && s.inverse)} data-layout={layout}>
      <div className={s.wrap}>
        <div className={s.footerInner}>
          <p className={s.closing}>{footer.closingLine}</p>
          <CtaLink cta={footer.cta} className={s.btn} anchors={anchors} />
          <p className={s.legal}>
            <span>{copyrightLine(year, footer.copyrightName)}</span>
            <a href={PLATFORM_TEXT.badgeHref} target="_blank" rel="noopener noreferrer">
              {PLATFORM_TEXT.badge}
              <ExternalHint />
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
