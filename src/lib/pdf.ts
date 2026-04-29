/**
 * SnowFox-branded AI Strategy Plan — customer-facing PDF that can be sent to
 * the prospect either automatically (attached to the SnowFox internal lead
 * email) or manually from the admin dashboard as a follow-up. Built with
 * pdf-lib so it works in Netlify's Node serverless runtime without external
 * font files (uses standard Helvetica).
 *
 * The plan is structured as: cover, executive summary, business context,
 * category breakdown, prioritized recommendations driven by lowest-scoring
 * categories, the recipient's full answers, and recommended SnowFox engagement.
 */

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, type RGB } from "pdf-lib";
import {
  CATEGORIES,
  CATEGORY_BY_CODE,
  CONTEXT_QUESTIONS,
  CORE_QUESTIONS,
  FOLLOW_UPS,
  QUESTION_BY_ID,
  type CategoryCode,
} from "./questionnaire";
import type { ScoreResult, CategoryScore } from "./scoring";

/* ───────── SnowFox brand palette ───────── */
const NAVY: RGB = rgb(15 / 255, 18 / 255, 24 / 255);
const NAVY_900: RGB = rgb(11 / 255, 23 / 255, 38 / 255);
const FOX_RED: RGB = rgb(230 / 255, 57 / 255, 70 / 255);
const SNOW_50: RGB = rgb(248 / 255, 250 / 255, 252 / 255);
const SNOW_200: RGB = rgb(226 / 255, 232 / 255, 240 / 255);
const INK_700: RGB = rgb(51 / 255, 65 / 255, 85 / 255);
const INK_500: RGB = rgb(100 / 255, 116 / 255, 139 / 255);
const WHITE: RGB = rgb(1, 1, 1);

/* ───────── Page layout ───────── */
const PAGE_W = 612; // US Letter
const PAGE_H = 792;
const MARGIN_X = 54;
const TOP = 72;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

export interface StrategyPdfInput {
  fullName: string;
  workEmail: string;
  company?: string;
  phone?: string;
  jobTitle?: string;
  notes?: string;
  context: Record<string, string>; // C1..C4 (label values)
  /** QID -> chosen option id ("a".."e") */
  coreAnswers: Record<string, string>;
  /** Follow-up id -> option id or array of ids */
  followupAnswers: Record<string, string | string[]>;
  score: ScoreResult;
}

/**
 * Generate the SnowFox AI Strategy Plan PDF.
 * Returns a Uint8Array (Buffer-compatible) suitable for Resend attachments.
 */
export async function generateStrategyPlanPdf(input: StrategyPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`SnowFox AI Strategy Plan — ${input.company ?? input.fullName}`);
  doc.setAuthor("SnowFox Solutions");
  doc.setSubject("AI Readiness Assessment — Personalized Strategy Plan");
  doc.setCreator("SnowFox AI Readiness Assessment");
  doc.setProducer("SnowFox Solutions");
  doc.setCreationDate(new Date());

  const fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    oblique: await doc.embedFont(StandardFonts.HelveticaOblique),
  };

  const ctx: DrawCtx = {
    doc,
    page: doc.addPage([PAGE_W, PAGE_H]),
    fonts,
    y: PAGE_H - TOP,
    pageNumber: 1,
  };

  drawCoverPage(ctx, input);
  newPage(ctx);
  drawExecutiveSummary(ctx, input);
  drawBusinessContext(ctx, input);
  drawCategoryBreakdown(ctx, input);
  drawRecommendations(ctx, input);
  drawAnswersAppendix(ctx, input);
  drawFooter(ctx, input);

  // Page numbers and footer brand strip on every page (added last so we know page count).
  decorateAllPages(doc, fonts);

  return doc.save();
}

/* ───────── Drawing primitives ───────── */

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
  oblique: PDFFont;
}

interface DrawCtx {
  doc: PDFDocument;
  page: PDFPage;
  fonts: Fonts;
  /** Current pen y (top-of-cursor). When writing text we draw at y - lineHeight. */
  y: number;
  pageNumber: number;
}

function newPage(ctx: DrawCtx) {
  ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  ctx.y = PAGE_H - TOP;
  ctx.pageNumber += 1;
}

/** Ensure at least `needed` points of vertical space; otherwise start a new page. */
function ensureSpace(ctx: DrawCtx, needed: number) {
  if (ctx.y - needed < 80) newPage(ctx);
}

function drawText(
  ctx: DrawCtx,
  text: string,
  opts: { font?: PDFFont; size?: number; color?: RGB; x?: number; lineHeight?: number } = {}
) {
  const font = opts.font ?? ctx.fonts.regular;
  const size = opts.size ?? 10.5;
  const color = opts.color ?? INK_700;
  const lineHeight = opts.lineHeight ?? size * 1.35;
  const x = opts.x ?? MARGIN_X;
  const maxWidth = PAGE_W - MARGIN_X - x;

  const lines = wrapText(sanitize(text), font, size, maxWidth);
  for (const line of lines) {
    ensureSpace(ctx, lineHeight);
    ctx.page.drawText(line, { x, y: ctx.y - size, size, font, color });
    ctx.y -= lineHeight;
  }
}

/**
 * Map Unicode code points that the standard 14 PDF fonts (WinAnsi) cannot
 * encode to safe equivalents. WinAnsi supports em-dash, en-dash, smart quotes,
 * middle dot, etc., so we only need to swap a small set.
 */
function sanitize(text: string): string {
  if (!text) return "";
  return text
    .replace(/[→➜➔➞➝➤➡]/g, ">>")
    .replace(/[←]/g, "<<")
    .replace(/[●∙]/g, "·")
    .replace(/[★☆]/g, "*")
    .replace(/ /g, " "); // nbsp -> space
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  if (!text) return [""];
  const paragraphs = text.split("\n");
  const out: string[] = [];
  for (const para of paragraphs) {
    const words = para.split(/\s+/);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        if (line) out.push(line);
        // Hard-break super-long tokens.
        if (font.widthOfTextAtSize(word, size) > maxWidth) {
          let chunk = "";
          for (const ch of word) {
            if (font.widthOfTextAtSize(chunk + ch, size) > maxWidth) {
              out.push(chunk);
              chunk = ch;
            } else chunk += ch;
          }
          line = chunk;
        } else {
          line = word;
        }
      }
    }
    out.push(line);
  }
  return out;
}

function drawRule(ctx: DrawCtx, color: RGB = SNOW_200, gapTop = 6, gapBottom = 10) {
  ctx.y -= gapTop;
  ensureSpace(ctx, 1 + gapBottom);
  ctx.page.drawLine({
    start: { x: MARGIN_X, y: ctx.y },
    end: { x: PAGE_W - MARGIN_X, y: ctx.y },
    thickness: 0.6,
    color,
  });
  ctx.y -= gapBottom;
}

function drawHeading(ctx: DrawCtx, text: string, size = 16, color: RGB = NAVY_900) {
  ensureSpace(ctx, size + 14);
  ctx.y -= 6;
  drawText(ctx, text, { font: ctx.fonts.bold, size, color, lineHeight: size * 1.25 });
  ctx.y -= 6;
}

function drawSubheading(ctx: DrawCtx, text: string) {
  drawHeading(ctx, text, 12, NAVY_900);
}

function drawParagraph(ctx: DrawCtx, text: string, color: RGB = INK_700, size = 10.5) {
  drawText(ctx, text, { size, color });
  ctx.y -= 4;
}

/* ───────── Cover page ───────── */

function drawCoverPage(ctx: DrawCtx, input: StrategyPdfInput) {
  const { page, fonts } = ctx;

  // Top navy band
  page.drawRectangle({ x: 0, y: PAGE_H - 200, width: PAGE_W, height: 200, color: NAVY });

  // Brand mark
  page.drawText("SNOWFOX", {
    x: MARGIN_X,
    y: PAGE_H - 80,
    size: 22,
    font: fonts.bold,
    color: WHITE,
  });
  page.drawText("SOLUTIONS", {
    x: MARGIN_X + 110,
    y: PAGE_H - 80,
    size: 22,
    font: fonts.regular,
    color: SNOW_50,
  });
  // Fox-red accent rule
  page.drawRectangle({
    x: MARGIN_X,
    y: PAGE_H - 95,
    width: 60,
    height: 3,
    color: FOX_RED,
  });

  page.drawText("AI Strategy Plan", {
    x: MARGIN_X,
    y: PAGE_H - 140,
    size: 28,
    font: fonts.bold,
    color: WHITE,
  });
  page.drawText("AI Readiness Assessment — Your Personalized Strategy Plan", {
    x: MARGIN_X,
    y: PAGE_H - 168,
    size: 12,
    font: fonts.regular,
    color: SNOW_50,
  });

  // Score badge
  const badgeY = PAGE_H - 320;
  page.drawRectangle({
    x: MARGIN_X,
    y: badgeY,
    width: CONTENT_W,
    height: 84,
    color: NAVY_900,
  });
  page.drawText(`${input.score.score}`, {
    x: MARGIN_X + 24,
    y: badgeY + 24,
    size: 48,
    font: fonts.bold,
    color: WHITE,
  });
  page.drawText("/ 100", {
    x: MARGIN_X + 110,
    y: badgeY + 30,
    size: 18,
    font: fonts.regular,
    color: SNOW_50,
  });
  // Band pill
  const pillW = 120;
  page.drawRectangle({
    x: PAGE_W - MARGIN_X - pillW - 16,
    y: badgeY + 32,
    width: pillW,
    height: 24,
    color: FOX_RED,
  });
  page.drawText(input.score.band.label, {
    x: PAGE_W - MARGIN_X - pillW - 16 + 12,
    y: badgeY + 39,
    size: 11,
    font: fonts.bold,
    color: WHITE,
  });

  // Recipient block
  ctx.y = badgeY - 40;
  drawText(ctx, "Prepared for", { font: fonts.bold, size: 11, color: INK_500 });
  ctx.y -= 2;
  drawText(ctx, input.fullName, { font: fonts.bold, size: 16, color: NAVY_900 });
  if (input.jobTitle || input.company) {
    const role = [input.jobTitle, input.company].filter(Boolean).join(" · ");
    drawText(ctx, role, { size: 11, color: INK_500 });
  }
  drawText(ctx, input.workEmail, { size: 11, color: INK_700 });
  if (input.phone) drawText(ctx, input.phone, { size: 11, color: INK_700 });

  // Date line
  ctx.y -= 12;
  const dateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  drawText(ctx, `Generated ${dateStr}`, { size: 9.5, color: INK_500, font: fonts.oblique });

  // Tagline at bottom
  page.drawText("Prepared by SnowFox Solutions", {
    x: MARGIN_X,
    y: 64,
    size: 10,
    font: fonts.bold,
    color: NAVY_900,
  });
  page.drawText("snowfoxsolutions.com · Blue Ash, Ohio", {
    x: MARGIN_X,
    y: 50,
    size: 9,
    font: fonts.regular,
    color: INK_500,
  });
}

/* ───────── Executive summary ───────── */

function drawExecutiveSummary(ctx: DrawCtx, input: StrategyPdfInput) {
  drawHeading(ctx, "Executive Summary", 18);
  drawParagraph(
    ctx,
    `${firstName(input.fullName)}${input.company ? ` (${input.company})` : ""}, you scored ${input.score.score} of 100 on the SnowFox AI Readiness Assessment, which places you in the ${input.score.band.label} band.`
  );
  drawSubheading(ctx, "What this means");
  drawParagraph(ctx, input.score.band.meaning);
  drawSubheading(ctx, "Recommended next actions");
  drawParagraph(ctx, input.score.band.nextActions);
  drawRule(ctx);
}

/* ───────── Business context ───────── */

function drawBusinessContext(ctx: DrawCtx, input: StrategyPdfInput) {
  drawHeading(ctx, "Business Context", 14);

  const rows: { label: string; value: string }[] = [];
  for (const c of CONTEXT_QUESTIONS) {
    const val = input.context[c.id];
    if (val) rows.push({ label: stripQuestionMark(c.text), value: val });
  }
  if (input.notes) {
    rows.push({ label: "Notes you shared", value: input.notes });
  }

  drawTwoColumnList(ctx, rows);
  drawRule(ctx);
}

function drawTwoColumnList(ctx: DrawCtx, rows: { label: string; value: string }[]) {
  const labelW = 200;
  for (const r of rows) {
    const labelLines = wrapText(sanitize(r.label), ctx.fonts.bold, 10, labelW - 12);
    const valueLines = wrapText(sanitize(r.value), ctx.fonts.regular, 10.5, CONTENT_W - labelW);
    const rowHeight = Math.max(labelLines.length, valueLines.length) * 14 + 6;
    ensureSpace(ctx, rowHeight);

    const startY = ctx.y;
    for (let i = 0; i < labelLines.length; i++) {
      ctx.page.drawText(labelLines[i], {
        x: MARGIN_X,
        y: startY - 10 - i * 14,
        size: 10,
        font: ctx.fonts.bold,
        color: NAVY_900,
      });
    }
    for (let i = 0; i < valueLines.length; i++) {
      ctx.page.drawText(valueLines[i], {
        x: MARGIN_X + labelW,
        y: startY - 10 - i * 14,
        size: 10.5,
        font: ctx.fonts.regular,
        color: INK_700,
      });
    }
    ctx.y -= rowHeight;
  }
}

/* ───────── Category breakdown ───────── */

function drawCategoryBreakdown(ctx: DrawCtx, input: StrategyPdfInput) {
  drawHeading(ctx, "Category Breakdown", 14);

  // Header row
  const colCat = MARGIN_X;
  const colWeight = MARGIN_X + 220;
  const colPct = MARGIN_X + 290;
  const colBar = MARGIN_X + 340;
  const barW = 140;

  ensureSpace(ctx, 22);
  ctx.page.drawRectangle({
    x: MARGIN_X,
    y: ctx.y - 18,
    width: CONTENT_W,
    height: 20,
    color: SNOW_50,
  });
  ctx.page.drawText("Category", { x: colCat + 4, y: ctx.y - 13, size: 9.5, font: ctx.fonts.bold, color: NAVY_900 });
  ctx.page.drawText("Weight", { x: colWeight, y: ctx.y - 13, size: 9.5, font: ctx.fonts.bold, color: NAVY_900 });
  ctx.page.drawText("Score", { x: colPct, y: ctx.y - 13, size: 9.5, font: ctx.fonts.bold, color: NAVY_900 });
  ctx.y -= 22;

  for (const c of input.score.categories) {
    ensureSpace(ctx, 22);
    const rowY = ctx.y;
    ctx.page.drawText(c.name, { x: colCat + 4, y: rowY - 13, size: 10, font: ctx.fonts.regular, color: INK_700 });
    ctx.page.drawText(`${Math.round(c.weight * 100)}%`, {
      x: colWeight,
      y: rowY - 13,
      size: 10,
      font: ctx.fonts.regular,
      color: INK_500,
    });
    ctx.page.drawText(`${Math.round(c.categoryPercent)}%`, {
      x: colPct,
      y: rowY - 13,
      size: 10,
      font: ctx.fonts.bold,
      color: NAVY_900,
    });
    // Bar
    ctx.page.drawRectangle({ x: colBar, y: rowY - 14, width: barW, height: 6, color: SNOW_200 });
    const fillW = Math.max(2, (c.categoryPercent / 100) * barW);
    ctx.page.drawRectangle({
      x: colBar,
      y: rowY - 14,
      width: fillW,
      height: 6,
      color: barColorForPercent(c.categoryPercent),
    });
    // Bottom rule
    ctx.page.drawLine({
      start: { x: MARGIN_X, y: rowY - 22 },
      end: { x: PAGE_W - MARGIN_X, y: rowY - 22 },
      thickness: 0.4,
      color: SNOW_200,
    });
    ctx.y -= 24;
  }
  ctx.y -= 6;
  drawRule(ctx);
}

function barColorForPercent(pct: number): RGB {
  if (pct >= 75) return rgb(34 / 255, 139 / 255, 88 / 255); // green
  if (pct >= 50) return rgb(34 / 255, 119 / 255, 178 / 255); // blue
  if (pct >= 25) return rgb(232 / 255, 154 / 255, 25 / 255); // amber
  return FOX_RED;
}

/* ───────── Recommendations ───────── */

function drawRecommendations(ctx: DrawCtx, input: StrategyPdfInput) {
  drawHeading(ctx, "Strategy Recommendations", 16);
  drawParagraph(
    ctx,
    "Below are the three categories with the largest gap to mature performance, with a suggested first move for each.",
    INK_500,
    10
  );
  ctx.y -= 4;

  const focus = [...input.score.categories]
    .sort((a, b) => a.categoryPercent - b.categoryPercent)
    .slice(0, 3);

  for (let i = 0; i < focus.length; i++) {
    const c = focus[i];
    const rec = RECOMMENDATIONS[c.code];
    drawSubheading(ctx, `${i + 1}. ${c.name} — ${Math.round(c.categoryPercent)}% (weight ${Math.round(c.weight * 100)}%)`);
    drawText(ctx, "What:", { font: ctx.fonts.bold, size: 10, color: NAVY_900 });
    drawParagraph(ctx, rec.what);
    drawText(ctx, "Why:", { font: ctx.fonts.bold, size: 10, color: NAVY_900 });
    drawParagraph(ctx, rec.why);
    drawText(ctx, "Suggested first move:", { font: ctx.fonts.bold, size: 10, color: NAVY_900 });
    drawParagraph(ctx, rec.firstMove);
    ctx.y -= 4;
  }

  // F7 outcome — what they hope AI will drive
  const outcome = input.followupAnswers["F7"];
  if (typeof outcome === "string") {
    const f7 = FOLLOW_UPS.find((f) => f.id === "F7");
    const opt = f7?.options.find((o) => o.id === outcome);
    if (opt) {
      drawSubheading(ctx, "Your top business outcome");
      drawParagraph(ctx, `You identified "${opt.label}" as the #1 outcome you hope AI will drive. Every recommendation in this plan is meant to support that outcome.`);
    }
  }

  drawRule(ctx);
}

/* ───────── Answers appendix ───────── */

function drawAnswersAppendix(ctx: DrawCtx, input: StrategyPdfInput) {
  drawHeading(ctx, "Your Answers", 14);
  drawParagraph(
    ctx,
    "Verbatim answers you gave during the assessment, grouped by category.",
    INK_500,
    10
  );

  for (const cat of CATEGORIES) {
    const qs = CORE_QUESTIONS.filter((q) => q.category === cat.code);
    if (qs.length === 0) continue;
    drawSubheading(ctx, cat.name);
    for (const q of qs) {
      const ansId = input.coreAnswers[q.id];
      const opt = q.options.find((o) => o.id === ansId);
      drawText(ctx, `${q.id}. ${q.text}`, { font: ctx.fonts.bold, size: 9.5, color: NAVY_900 });
      drawText(
        ctx,
        opt ? `• ${opt.label}  (${opt.points} pts)` : "• (no answer)",
        { size: 9.5, color: INK_700 }
      );
      ctx.y -= 2;
    }
    ctx.y -= 4;
  }

  // Follow-ups
  const firedIds = input.score.firedFollowUpIds;
  if (firedIds.length > 0) {
    drawSubheading(ctx, "Follow-up answers");
    for (const fid of firedIds) {
      const f = FOLLOW_UPS.find((x) => x.id === fid);
      if (!f) continue;
      const ans = input.followupAnswers[fid];
      drawText(ctx, `${f.id}. ${f.question}`, { font: ctx.fonts.bold, size: 9.5, color: NAVY_900 });
      const labels = followupLabels(f.options, ans);
      drawText(ctx, labels ? `• ${labels}` : "• (no answer)", { size: 9.5, color: INK_700 });
      ctx.y -= 2;
    }
  }
}

function followupLabels(
  options: { id: string; label: string }[],
  answer: string | string[] | undefined
): string | null {
  if (answer == null) return null;
  if (Array.isArray(answer)) {
    const labels = answer.map((id) => options.find((o) => o.id === id)?.label).filter(Boolean) as string[];
    return labels.length ? labels.join("; ") : null;
  }
  return options.find((o) => o.id === answer)?.label ?? null;
}

/* ───────── Footer / next steps ───────── */

function drawFooter(ctx: DrawCtx, _input: StrategyPdfInput) {
  drawRule(ctx);
  drawHeading(ctx, "Working with SnowFox", 14);
  drawParagraph(
    ctx,
    "If you'd like a deeper, hands-on review, SnowFox offers a paid AI Readiness Assessment that adds a hands-on data review, a prioritized use-case shortlist, and a governance plan tailored to your industry and operations."
  );
  drawParagraph(
    ctx,
    "Reply to your results email — or reach out directly — and a senior business advisor will be in touch to walk through this plan with you."
  );
  ctx.y -= 4;
  drawText(ctx, "SnowFox Solutions", { font: ctx.fonts.bold, size: 11, color: NAVY_900 });
  drawText(ctx, "Blue Ash, Ohio · snowfoxsolutions.com", { size: 10, color: INK_500 });
}

/* ───────── Page-number stamp ───────── */

function decorateAllPages(doc: PDFDocument, fonts: Fonts) {
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    // Brand strip across the bottom
    p.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: 24, color: NAVY });
    p.drawRectangle({ x: 0, y: 24, width: PAGE_W, height: 2, color: FOX_RED });
    p.drawText("SnowFox AI Strategy Plan", {
      x: MARGIN_X,
      y: 8,
      size: 8.5,
      font: fonts.regular,
      color: SNOW_50,
    });
    const label = `${i + 1} / ${pages.length}`;
    const w = fonts.regular.widthOfTextAtSize(label, 8.5);
    p.drawText(label, {
      x: PAGE_W - MARGIN_X - w,
      y: 8,
      size: 8.5,
      font: fonts.regular,
      color: SNOW_50,
    });
  });
}

/* ───────── Per-category recommendation library ───────── */

interface Rec {
  what: string;
  why: string;
  firstMove: string;
}

const RECOMMENDATIONS: Record<CategoryCode, Rec> = {
  STR: {
    what: "Stand up a written, board-visible AI strategy with named owner, 12-month outcomes, and quarterly review cadence.",
    why: "Without an executive-owned strategy, AI work fragments into disconnected pilots that never compound — the single biggest predictor of stalled programs.",
    firstMove: "Schedule a 90-minute leadership working session with SnowFox to draft a one-page AI strategy aligned to the company's existing strategic plan.",
  },
  DAT: {
    what: "Inventory the data that matters, fix accuracy and accessibility for the top three sources, and assign data owners.",
    why: "AI built on inconsistent or siloed data produces unreliable results. Data readiness is the rate-limiter for every downstream use case.",
    firstMove: "Run a data-readiness diagnostic on the three highest-leverage data sources and produce a 90-day remediation plan. SnowFox can lead this engagement.",
  },
  TECH: {
    what: "Modernize integration and security to a baseline that supports event-driven AI workloads and least-privilege access.",
    why: "Most useful AI use cases require multi-system context. Brittle point-to-point integrations and weak security posture cap what you can safely deploy.",
    firstMove: "Map the three to five system integrations that an AI assistant would need to touch and identify the weakest link.",
  },
  TAL: {
    what: "Build AI literacy across all staff and stand up a small cross-functional pod with the right balance of build vs. buy.",
    why: "Without a baseline of AI literacy, business teams can't sponsor good use cases — and without a delivery pod, nothing gets built reliably.",
    firstMove: "Run a 2-hour AI Literacy workshop for the leadership team; pair it with a SnowFox-led talent gap assessment.",
  },
  PRO: {
    what: "Document and instrument the top five end-to-end processes so AI has a measurable target to improve.",
    why: "AI improves outcomes against a measurable baseline. Undocumented, unmeasured processes give nothing for AI to attach to.",
    firstMove: "Pick the most painful process today and run a one-day process diagnostic to turn it into an AI-ready candidate. SnowFox can facilitate this exercise.",
  },
  USE: {
    what: "Move from idea-list to a prioritized use-case portfolio with quantified ROI and a 90-day shipping pilot.",
    why: "Long lists of AI ideas with no ROI estimate or owner are how budgets get burned. A portfolio with one shipping pilot creates momentum.",
    firstMove: "Hold a use-case prioritization workshop and pick one pilot that can ship in 90 days. SnowFox can facilitate the workshop and help scope the pilot.",
  },
  ETH: {
    what: "Publish a one-page Responsible AI policy plus a lightweight intake review for any new AI use case.",
    why: "Even small AI deployments create regulatory, brand, and customer-trust exposure. A pragmatic policy unblocks delivery instead of slowing it.",
    firstMove: "Adopt a Responsible AI starter policy and customize it to your industry. SnowFox can share a template and help adapt it.",
  },
  FIN: {
    what: "Move from project-by-project funding to a small but committed annual AI budget with clear stage gates.",
    why: "Without a committed budget, every initiative starts from zero, ROI conversations are constant, and momentum is lost between fiscal years.",
    firstMove: "Build a 3-tier AI budget proposal (run / grow / transform) for the next fiscal-year cycle. SnowFox can help you structure and defend the proposal.",
  },
};

/* ───────── Misc helpers ───────── */

function firstName(full: string): string {
  return (full.split(/\s+/)[0] ?? "").trim() || full || "There";
}

function stripQuestionMark(s: string): string {
  return s.replace(/\s*\?\s*$/, "");
}

// Side-effect-free re-exports so consumers can type against category codes.
export { CATEGORY_BY_CODE };
export type { CategoryScore };
