/**
 * Resend-based transactional email.
 *
 * Two emails are sent per submission:
 *   1. Prospect email — branded results email to the customer (no CC).
 *   2. SnowFox internal email — to SNOWFOX_LEADS_EMAIL (jdivine@snowfoxsolutions.com)
 *      only, with the SnowFox-branded AI Strategy Plan PDF attached.
 *
 * Sending domain is snowfoxsolutions.ai (via SNOWFOX_FROM_EMAIL).
 */

import { Resend } from "resend";
import { CATEGORY_BY_CODE } from "./questionnaire";
import type { ScoreResult } from "./scoring";

function resend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set.");
  return new Resend(key);
}

export interface LeadPayload {
  sessionId: string;
  fullName: string;
  workEmail: string;
  company?: string;
  phone?: string;
  jobTitle?: string;
  notes?: string;
  context: Record<string, string>; // C1/C2/C3/C4 answers
  score: ScoreResult;
}

function categoryTableHtml(score: ScoreResult): string {
  const rows = score.categories
    .map(
      (c) => `
        <tr>
          <td style="padding:6px 10px;border-bottom:1px solid #E6EDF5;">${c.name}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #E6EDF5;text-align:right;">
            ${c.categoryPercent.toFixed(0)}%
          </td>
          <td style="padding:6px 10px;border-bottom:1px solid #E6EDF5;text-align:right;color:#475569;">
            ${c.rawPoints}${c.bonusPoints ? ` (+${c.bonusPoints})` : ""} / ${c.maxPoints}
          </td>
        </tr>`
    )
    .join("");
  return `
    <table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;">
      <thead>
        <tr style="background:#F5F8FC;">
          <th style="text-align:left;padding:8px 10px;">Category</th>
          <th style="text-align:right;padding:8px 10px;">%</th>
          <th style="text-align:right;padding:8px 10px;">Points</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

/**
 * Branded results email to the prospect with their own score + recommended next
 * steps. Replies route back to the SnowFox leads inbox so an advisor can pick up
 * the thread directly. SnowFox is no longer CC'd on this email — the SnowFox
 * leads inbox receives a separate internal email with the strategy PDF attached.
 */
export async function sendResultsToProspect(lead: LeadPayload): Promise<void> {
  const from = process.env.SNOWFOX_FROM_EMAIL;
  const replyTo = process.env.SNOWFOX_LEADS_EMAIL;
  if (!from) throw new Error("SNOWFOX_FROM_EMAIL must be set.");

  const subject = `Your SnowFox AI Readiness Score: ${lead.score.score} / 100 (${lead.score.band.label})`;

  const html = `
    <div style="font-family:Arial,sans-serif;color:#0B1726;max-width:640px;">
      <h2 style="color:#0F1218;">Your AI Readiness Score</h2>
      <p>Hi ${escapeFirstName(lead.fullName)},</p>
      <p>Thanks for taking the SnowFox AI Readiness Assessment. Here's your score:</p>

      <div style="background:#0F1218;color:#FFFFFF;border-radius:12px;padding:20px;margin:16px 0;text-align:center;">
        <div style="font-size:48px;font-weight:700;line-height:1;">${lead.score.score}</div>
        <div style="opacity:0.8;margin-top:6px;">out of 100</div>
        <div style="margin-top:10px;display:inline-block;background:#E63946;padding:4px 12px;border-radius:999px;font-size:14px;font-weight:600;">
          ${lead.score.band.label}
        </div>
      </div>

      <p><strong>What this means:</strong> ${lead.score.band.meaning}</p>
      <p><strong>Recommended next actions:</strong> ${lead.score.band.nextActions}</p>

      <h3 style="color:#0F1218;">Category breakdown</h3>
      ${categoryTableHtml(lead.score)}

      <p style="margin-top:24px;">
        Want a more rigorous review? SnowFox offers a paid
        <strong>AI Readiness Assessment</strong> (1–2 days on-site, fixed fee $5K–$10K) that
        adds hands-on data review, a prioritized use-case shortlist, and a governance plan.
      </p>
      <p>
        One of our senior business advisors will be in touch shortly to walk through your results.
      </p>

      <p style="margin-top:24px;color:#475569;font-size:12px;">
        SnowFox Solutions · Blue Ash, Ohio · snowfoxsolutions.com
      </p>
    </div>`;

  await resend().emails.send({
    from,
    to: lead.workEmail,
    replyTo, // prospect's reply lands in the SnowFox inbox
    subject,
    html,
  });
}

/**
 * Internal SnowFox notification email — sent only to SNOWFOX_LEADS_EMAIL with
 * the AI Strategy Plan PDF attached. Body is a quick scan-friendly briefing so
 * an advisor can prep before reaching out to the prospect.
 */
export async function sendInternalLeadNotification(
  lead: LeadPayload,
  pdf: Uint8Array,
  pdfFilename: string
): Promise<void> {
  const from = process.env.SNOWFOX_FROM_EMAIL;
  const to = process.env.SNOWFOX_LEADS_EMAIL;
  if (!from) throw new Error("SNOWFOX_FROM_EMAIL must be set.");
  if (!to) throw new Error("SNOWFOX_LEADS_EMAIL must be set.");

  const subject = `[New Lead] ${lead.fullName}${lead.company ? ` · ${lead.company}` : ""} — ${lead.score.score}/100 (${lead.score.band.label})`;

  const ctx = lead.context;
  const contextRows = [
    ["Industry", ctx.C1],
    ["Employees", ctx.C2],
    ["Revenue", ctx.C3],
    ["Operations", ctx.C4],
  ]
    .filter(([, v]) => !!v)
    .map(
      ([k, v]) => `
        <tr>
          <td style="padding:4px 10px;color:#475569;">${k}</td>
          <td style="padding:4px 10px;color:#0F1218;font-weight:600;">${escapeHtml(String(v))}</td>
        </tr>`
    )
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;color:#0B1726;max-width:640px;">
      <h2 style="color:#0F1218;margin-bottom:6px;">New AI Readiness lead</h2>
      <p style="color:#475569;margin-top:0;">A prospect just submitted the SnowFox AI Readiness Assessment.</p>

      <div style="background:#0F1218;color:#FFFFFF;border-radius:12px;padding:18px;margin:16px 0;">
        <div style="font-size:36px;font-weight:700;line-height:1;">${lead.score.score}<span style="font-size:18px;font-weight:400;opacity:.8;"> / 100</span></div>
        <div style="margin-top:8px;display:inline-block;background:#E63946;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;">
          ${lead.score.band.label}
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px;">
        <tbody>
          <tr><td style="padding:4px 10px;color:#475569;">Name</td><td style="padding:4px 10px;font-weight:600;">${escapeHtml(lead.fullName)}</td></tr>
          <tr><td style="padding:4px 10px;color:#475569;">Email</td><td style="padding:4px 10px;"><a href="mailto:${encodeURIComponent(lead.workEmail)}" style="color:#0F1218;">${escapeHtml(lead.workEmail)}</a></td></tr>
          ${lead.jobTitle ? `<tr><td style="padding:4px 10px;color:#475569;">Title</td><td style="padding:4px 10px;">${escapeHtml(lead.jobTitle)}</td></tr>` : ""}
          ${lead.company ? `<tr><td style="padding:4px 10px;color:#475569;">Company</td><td style="padding:4px 10px;">${escapeHtml(lead.company)}</td></tr>` : ""}
          ${lead.phone ? `<tr><td style="padding:4px 10px;color:#475569;">Phone</td><td style="padding:4px 10px;">${escapeHtml(lead.phone)}</td></tr>` : ""}
        </tbody>
      </table>

      <h3 style="color:#0F1218;font-size:14px;">Business context</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px;">
        <tbody>${contextRows}</tbody>
      </table>

      <h3 style="color:#0F1218;font-size:14px;">Category breakdown</h3>
      ${categoryTableHtml(lead.score)}

      ${lead.notes ? `<h3 style="color:#0F1218;font-size:14px;margin-top:16px;">Prospect notes</h3><p style="color:#0B1726;">${escapeHtml(lead.notes)}</p>` : ""}

      <p style="margin-top:24px;color:#475569;font-size:13px;">
        The full SnowFox-branded <strong>AI Strategy Plan</strong> is attached as a PDF.
      </p>

      <p style="margin-top:24px;color:#475569;font-size:12px;">
        SnowFox Solutions · Blue Ash, Ohio · snowfoxsolutions.com
      </p>
    </div>`;

  await resend().emails.send({
    from,
    to,
    subject,
    html,
    attachments: [
      {
        filename: pdfFilename,
        content: Buffer.from(pdf),
      },
    ],
  });
}

function escapeFirstName(full: string): string {
  const first = (full.split(/\s+/)[0] ?? "").trim();
  return escapeHtml(first || "there");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Side-effect-free re-export so consumers can type-check against category codes.
export { CATEGORY_BY_CODE };
