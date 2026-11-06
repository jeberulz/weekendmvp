/**
 * WP74-S4: disposable email domains, refused when the wizard creates a business
 * (D3, `02` §13 "static list in the repo").
 *
 * A curated starter list of well-known throwaway inbox providers, written by
 * hand (no download). Importing the full CC0 `disposable-email-domains` list,
 * with its source and date pinned here, needs the owner's OK (open item in
 * `docs/wp/wp74-progress.md`).
 *
 * Matching: the part after the last `@`, look-alike full stops mapped to `.`,
 * trimmed, lowercased (NFKC), with one trailing dot removed. A domain matches
 * when it, or any parent domain above the top level, is on the list, so
 * `a.mailinator.com` matches `mailinator.com` and `gmail.tm` does not match
 * `mail.tm`.
 *
 * Pure: no Convex imports, no I/O.
 */
export const DISPOSABLE_EMAIL_DOMAINS: ReadonlySet<string> = new Set([
  "0-mail.com",
  "0815.ru",
  "10mail.org",
  "10minutemail.co.uk",
  "10minutemail.com",
  "10minutemail.net",
  "1secmail.com",
  "1secmail.net",
  "1secmail.org",
  "20minutemail.com",
  "anonbox.net",
  "burnermail.io",
  "crazymailing.com",
  "deadaddress.com",
  "despam.it",
  "devnullmail.com",
  "discard.email",
  "discardmail.com",
  "discardmail.de",
  "dispostable.com",
  "dropmail.me",
  "e4ward.com",
  "emailfake.com",
  "emailondeck.com",
  "emltmp.com",
  "eyepaste.com",
  "fakeinbox.com",
  "fakemail.net",
  "fakemailgenerator.com",
  "filzmail.com",
  "generator.email",
  "getairmail.com",
  "getnada.com",
  "gishpuppy.com",
  "grr.la",
  "guerrillamail.biz",
  "guerrillamail.com",
  "guerrillamail.de",
  "guerrillamail.info",
  "guerrillamail.net",
  "guerrillamail.org",
  "guerrillamailblock.com",
  "haltospam.com",
  "harakirimail.com",
  "inboxbear.com",
  "inboxkitten.com",
  "incognitomail.org",
  "kurzepost.de",
  "linshiyouxiang.net",
  "mail.tm",
  "mailcatch.com",
  "maildrop.cc",
  "mailexpire.com",
  "mailforspam.com",
  "mailin8r.com",
  "mailinater.com",
  "mailinator.com",
  "mailinator.net",
  "mailinator2.com",
  "mailmoat.com",
  "mailnesia.com",
  "mailnull.com",
  "mailpoof.com",
  "mailsac.com",
  "mailtothis.com",
  "meltmail.com",
  "minuteinbox.com",
  "mintemail.com",
  "moakt.com",
  "mohmal.com",
  "mytemp.email",
  "nada.email",
  "nowmymail.com",
  "objectmail.com",
  "onewaymail.com",
  "pokemail.net",
  "pookmail.com",
  "proxymail.eu",
  "rcpt.at",
  "safetymail.info",
  "sharklasers.com",
  "sneakemail.com",
  "sofort-mail.de",
  "spam4.me",
  "spamavert.com",
  "spambog.com",
  "spambox.us",
  "spamdecoy.net",
  "spamex.com",
  "spamfree24.org",
  "spamgourmet.com",
  "spamhole.com",
  "spaml.com",
  "spammotel.com",
  "spamspot.com",
  "tempail.com",
  "tempemail.net",
  "tempinbox.com",
  "tempm.com",
  "tempmail.net",
  "tempmailaddress.com",
  "tempmailo.com",
  "temp-mail.io",
  "temp-mail.org",
  "temporary-mail.net",
  "tempomail.fr",
  "tempr.email",
  "throwam.com",
  "throwawaymail.com",
  "tmpmail.net",
  "tmpmail.org",
  "trash-mail.com",
  "trashmail.com",
  "trashmail.de",
  "trashmail.me",
  "trashmail.net",
  "wegwerfmail.de",
  "wegwerfmail.net",
  "wh4f.org",
  "yopmail.com",
  "yopmail.fr",
  "yopmail.net",
]);

/** Full stops other scripts use for `.`: ideographic (U+3002), full-width (U+FF0E) and half-width ideographic (U+FF61). */
const DOT_LOOKALIKES = /[\u3002\uFF0E\uFF61]/g;

/**
 * The normalised domain of an email address or bare domain, or null when it
 * cannot be parsed. Look-alike full stops become `.`, then the domain is
 * trimmed, NFKC-normalised and lowercased, and one trailing dot is removed.
 * Null when there are fewer than two labels, any label is empty (a leading dot,
 * `..`, or a second trailing dot) or there is whitespace.
 */
export function emailDomain(emailOrDomain: string): string | null {
  const at = emailOrDomain.lastIndexOf("@");
  const raw = (at === -1 ? emailOrDomain : emailOrDomain.slice(at + 1))
    .replace(DOT_LOOKALIKES, ".")
    .trim()
    .normalize("NFKC")
    .toLowerCase();
  const domain = raw.endsWith(".") ? raw.slice(0, -1) : raw;
  if (/\s/.test(domain)) return null;
  const labels = domain.split(".");
  if (labels.length < 2 || labels.some((label) => label.length === 0)) return null;
  return domain;
}

/** The domain of an email address (an `@` is required), or null when there is none or it cannot be parsed. */
export function emailAddressDomain(email: string): string | null {
  return email.includes("@") ? emailDomain(email) : null;
}

/**
 * True when the domain, or a parent domain above the top level, is a known
 * disposable provider. An unparseable domain is not "disposable": callers that
 * gate on the address must refuse a null `emailAddressDomain` themselves.
 */
export function isDisposableEmailDomain(emailOrDomain: string): boolean {
  const domain = emailDomain(emailOrDomain);
  if (domain === null) return false;
  const labels = domain.split(".");
  for (let start = 0; start < labels.length - 1; start += 1) {
    if (DISPOSABLE_EMAIL_DOMAINS.has(labels.slice(start).join("."))) return true;
  }
  return false;
}
