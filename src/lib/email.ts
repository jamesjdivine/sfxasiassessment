/**
 * Resend-based transactional email.
 *
 * Single message: a branded results email goes to the prospect, with the SnowFox
 * leads inbox (jdivine@snowfoxsolutions.com) on CC so SnowFox sees exactly what
 * the prospect sees plus the score-and-context summary at the top. Sending
 * domain is snowfoxsolutions.ai (configured via SNOWFOX_FROM_EMAIL).
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
 * Branded email to the prospect with their own score + recommended next steps.
 * jdivine@snowfoxsolutions.com (or whatever SNOWFOX_LEADS_EMAIL points at) is
 * CC'd so SnowFox sees the same message and can follow up directly.
 */
export async function sendResultsToProspect(lead: LeadPayload): Promise<void> {
  const from = process.env.SNOWFOX_FROM_EMAIL;
  const cc = process.env.SNOWFOX_LEADS_EMAIL;
  if (!from) throw new Error("SNOWFOX_FROM_EMAIL must be set.");

  const subject = `Your AI Readiness Score: ${lead.score.score} / 100 (${lead.score.band.label})`;

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
        Reply to this email and we'll schedule a 30-minute conversation to walk through your results.
      </p>

      <p style="margin-top:24px;color:#475569;font-size:12px;">
        SnowFox Solutions · Blue Ash, Ohio · snowfoxsolutions.com
      </p>
    </div>`;

  await resend().emails.send({
    from,
    to: lead.workEmail,
    cc: cc ? [cc] : undefined,
    replyTo: cc, // so the prospect's reply lands in the SnowFox inbox
    subject,
    html,
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
