import { Email } from "@convex-dev/auth/providers/Email";
import { validatedSiteOrigin } from "./siteUrl";

export const EMAIL_MAGIC_LINK_MAX_AGE_SECONDS = 60 * 60;
export const MAGIC_LINK_DELIVERY_ERROR =
  "We could not send a sign-in link. Please try again.";

const RESEND_EMAILS_ENDPOINT = "https://api.resend.com/emails";

type DeliveryEnvironment = Record<string, string | undefined>;

type DeliveryDependencies = {
  env?: DeliveryEnvironment;
  fetch?: typeof fetch;
};

export type ResendEmailPayload = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
};

export function normalizeMagicLinkEmail(identifier: string) {
  const normalized = identifier.normalize("NFKC").trim().toLowerCase();
  if (
    normalized.length === 0 ||
    normalized.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalized)
  ) {
    throw new Error(MAGIC_LINK_DELIVERY_ERROR);
  }
  return normalized;
}

function safeDashboardReturn(value: string) {
  if (value.includes("\\")) return "/dashboard";
  try {
    const target = new URL(value, "https://platform.weekendmvp.invalid");
    if (
      target.origin === "https://platform.weekendmvp.invalid" &&
      (target.pathname === "/dashboard" ||
        target.pathname.startsWith("/dashboard/"))
    ) {
      return `${target.pathname}${target.search}${target.hash}`;
    }
  } catch {
    // Use the bounded default below.
  }
  return "/dashboard";
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function requireEnvironmentValue(
  env: DeliveryEnvironment,
  name: "AUTH_RESEND_KEY" | "AUTH_RESEND_FROM" | "SITE_URL",
) {
  const value = env[name]?.trim();
  if (!value) throw new Error(MAGIC_LINK_DELIVERY_ERROR);
  return value;
}

function requireExplicitSender(env: DeliveryEnvironment) {
  const from = requireEnvironmentValue(env, "AUTH_RESEND_FROM");
  if (/\r|\n/u.test(from)) throw new Error(MAGIC_LINK_DELIVERY_ERROR);
  const bracketed = from.match(/<([^<>]+)>$/u);
  const address = (bracketed?.[1] ?? from).normalize("NFKC").toLowerCase();
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(address) ||
    address.endsWith("@resend.dev")
  ) {
    throw new Error(MAGIC_LINK_DELIVERY_ERROR);
  }
  return from;
}

export function createResendMagicLinkEmail(args: {
  identifier: string;
  token: string;
  verificationUrl: string;
  siteUrl: string;
  from: string;
}): { link: string; payload: ResendEmailPayload } {
  const email = normalizeMagicLinkEmail(args.identifier);
  let siteOrigin: string;
  try {
    siteOrigin = validatedSiteOrigin(args.siteUrl);
  } catch {
    throw new Error(MAGIC_LINK_DELIVERY_ERROR);
  }
  const site = new URL(siteOrigin);
  const verification = new URL(args.verificationUrl);
  if (
    verification.username !== "" ||
    verification.password !== "" ||
    verification.origin !== siteOrigin
  ) {
    throw new Error(MAGIC_LINK_DELIVERY_ERROR);
  }

  verification.searchParams.delete("code");
  const returnTo = safeDashboardReturn(
    `${verification.pathname}${verification.search}${verification.hash}`,
  );
  const confirmation = new URL("/email-signin", site.origin);
  confirmation.searchParams.set("token", args.token);
  confirmation.searchParams.set("email", email);
  confirmation.searchParams.set("returnTo", returnTo);
  const link = confirmation.toString();
  const expiryMinutes = EMAIL_MAGIC_LINK_MAX_AGE_SECONDS / 60;

  return {
    link,
    payload: {
      from: args.from,
      to: email,
      subject: "Confirm your Weekend MVP sign in",
      text: [
        `Confirm sign in for ${email}:`,
        link,
        `This link expires in ${expiryMinutes} minutes and can be used once.`,
        "If you did not request it, you can ignore this email.",
      ].join("\n\n"),
      html: [
        "<p>Confirm sign in for <strong>",
        escapeHtml(email),
        "</strong>.</p>",
        '<p><a href="',
        escapeHtml(link),
        '">Review and sign in</a></p>',
        `<p>This link expires in ${expiryMinutes} minutes and can be used once.</p>`,
        "<p>If you did not request it, you can ignore this email.</p>",
      ].join(""),
    },
  };
}

export async function deliverResendMagicLink(
  args: { identifier: string; token: string; verificationUrl: string },
  dependencies: DeliveryDependencies = {},
) {
  try {
    const env = dependencies.env ?? process.env;
    const apiKey = requireEnvironmentValue(env, "AUTH_RESEND_KEY");
    const from = requireExplicitSender(env);
    const siteUrl = requireEnvironmentValue(env, "SITE_URL");
    const { payload } = createResendMagicLinkEmail({
      ...args,
      siteUrl,
      from,
    });
    const response = await (dependencies.fetch ?? fetch)(
      RESEND_EMAILS_ENDPOINT,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );
    if (!response.ok) throw new Error(MAGIC_LINK_DELIVERY_ERROR);
  } catch {
    // Never expose provider bodies, credentials, or recipient details.
    throw new Error(MAGIC_LINK_DELIVERY_ERROR);
  }
}

export const emailMagicLinkProvider = Email({
  id: "email",
  maxAge: EMAIL_MAGIC_LINK_MAX_AGE_SECONDS,
  normalizeIdentifier: normalizeMagicLinkEmail,
  async authorize(params, account) {
    if (
      typeof params.email !== "string" ||
      typeof account.providerAccountId !== "string" ||
      normalizeMagicLinkEmail(params.email) !==
        normalizeMagicLinkEmail(account.providerAccountId)
    ) {
      throw new Error("Unable to verify sign-in.");
    }
  },
  async sendVerificationRequest({ identifier, token, url }) {
    await deliverResendMagicLink({
      identifier,
      token,
      verificationUrl: url,
    });
  },
});
