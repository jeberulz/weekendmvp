#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BetaAnalyticsDataClient } from "@google-analytics/data";

import {
  FUNNEL_EVENTS,
  buildValidationReport,
  completeDateRanges,
  normalizeGaRows,
  renderValidationHtml,
  renderValidationMarkdown,
} from "../lib/validation-report.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const shouldEmail = args.includes("--email");
const shouldPrint = args.includes("--stdout");
const outputArgIndex = args.indexOf("--output");
const propertyId = process.env.GA4_PROPERTY_ID ?? "517826359";
const dataLagDays = Number(process.env.GA4_DATA_LAG_DAYS ?? "2");

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function analyticsClient() {
  const serialized = process.env.GA4_SERVICE_ACCOUNT_JSON;
  if (!serialized) return new BetaAnalyticsDataClient();

  let credentials;
  try {
    credentials = JSON.parse(serialized);
  } catch {
    throw new Error("GA4_SERVICE_ACCOUNT_JSON must contain valid JSON");
  }

  if (
    typeof credentials.client_email !== "string" ||
    typeof credentials.private_key !== "string"
  ) {
    throw new Error(
      "GA4_SERVICE_ACCOUNT_JSON must include client_email and private_key",
    );
  }

  return new BetaAnalyticsDataClient({
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key.replaceAll("\\n", "\n"),
    },
  });
}

async function readIdeas() {
  const raw = await fs.readFile(
    path.join(root, "ideas", "manifest.json"),
    "utf8",
  );
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.ideas)) {
    throw new Error("ideas/manifest.json does not contain an ideas array");
  }
  return parsed.ideas;
}

async function fetchPeriod(client, dateRange) {
  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [dateRange],
    dimensions: [{ name: "eventName" }, { name: "pagePath" }],
    metrics: [{ name: "eventCount" }],
    dimensionFilter: {
      filter: {
        fieldName: "eventName",
        inListFilter: {
          values: ["page_view", ...FUNNEL_EVENTS],
        },
      },
    },
    limit: 100_000,
  });

  return normalizeGaRows(response.rows ?? []);
}

async function sendEmail({ markdown, html, report }) {
  const apiKey = requiredEnv("RESEND_API_KEY");
  const from = requiredEnv("VALIDATION_REPORT_EMAIL_FROM");
  const recipients = requiredEnv("VALIDATION_REPORT_EMAIL_TO")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (recipients.length === 0) {
    throw new Error("VALIDATION_REPORT_EMAIL_TO has no valid recipients");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `weekendmvp-validation-${report.ranges.current.endDate}`,
    },
    body: JSON.stringify({
      from,
      to: recipients,
      subject: `Weekend MVP validation digest — ${report.ranges.current.endDate}`,
      text: markdown,
      html,
    }),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Resend rejected the digest (${response.status}): ${body}`);
  }
}

async function main() {
  if (!/^\d+$/.test(propertyId)) {
    throw new Error("GA4_PROPERTY_ID must be numeric");
  }
  if (!Number.isInteger(dataLagDays) || dataLagDays < 1 || dataLagDays > 7) {
    throw new Error("GA4_DATA_LAG_DAYS must be an integer from 1 through 7");
  }

  const ranges = completeDateRanges(new Date(), dataLagDays);
  const client = analyticsClient();
  const [ideas, currentRows, baselineRows] = await Promise.all([
    readIdeas(),
    fetchPeriod(client, ranges.current),
    fetchPeriod(client, ranges.baseline),
  ]);
  const report = buildValidationReport({
    currentRows,
    baselineRows,
    ideas,
    ranges,
  });
  const markdown = renderValidationMarkdown(report);
  const html = renderValidationHtml(report);
  const defaultOutput = path.join(
    root,
    "reports",
    "validation",
    `${ranges.current.endDate}.md`,
  );
  const outputPath =
    outputArgIndex >= 0
      ? path.resolve(root, requiredArg(args[outputArgIndex + 1], "--output"))
      : defaultOutput;

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, markdown, "utf8");

  if (shouldPrint) process.stdout.write(`${markdown}\n`);
  if (shouldEmail) await sendEmail({ markdown, html, report });

  console.log(
    `validation digest written to ${path.relative(root, outputPath)}${shouldEmail ? " and emailed" : ""}`,
  );
}

function requiredArg(value, flag) {
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

main().catch((error) => {
  console.error(
    `validation digest failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
