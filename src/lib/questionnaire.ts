/**
 * SnowFox AI Readiness Assessment — questionnaire source of truth.
 *
 * This file mirrors `AI_Readiness_Questionnaire.xlsx` and is the canonical
 * definition consumed by both the UI and the scoring engine. When the spec
 * changes, update this file and the .xlsx in lockstep.
 */

export type CategoryCode =
  | "STR" // Strategy & Leadership
  | "DAT" // Data Readiness
  | "TECH" // Technology Infrastructure
  | "TAL" // Talent & Skills
  | "PRO" // Process Maturity
  | "USE" // Use Cases & ROI
  | "ETH" // Ethics & Governance
  | "FIN"; // Financial Capacity

export interface Category {
  code: CategoryCode;
  name: string;
  weight: number; // 0-1, sums to 1.0 across all categories
  description: string;
}

export interface AnswerOption {
  /** Stable id within a question, e.g. "a" | "b" | "c" | "d" | "e" */
  id: string;
  label: string;
  points: number;
}

export interface Question {
  id: string; // Q1..Q23
  category: CategoryCode;
  text: string;
  options: AnswerOption[];
  /** Optional note describing which follow-up this question triggers. */
  branchNote?: string;
}

export interface ContextQuestion {
  id: string; // C1..C3
  text: string;
  options: string[];
}

/**
 * Follow-up triggers evaluate against the answers map and return the follow-up
 * that should fire (or null). Kept as plain predicates so they are easy to unit
 * test and reason about.
 */
export interface FollowUpQuestion {
  id: string; // F1..F7
  triggerLabel: string;
  shouldAsk: (ctx: FollowUpContext) => boolean;
  question: string;
  options: AnswerOption[];
  /** Whether answers alter the score. False = informational only. */
  scored: boolean;
  /** Category that receives the bonus (only meaningful if scored=true). */
  targetCategory?: CategoryCode;
  multiSelect: boolean;
  /**
   * For scored follow-ups, bonus = sum of selected option points, capped at
   * `maxBonus`. Category subtotal is capped at the category max so no category
   * ever exceeds 100%.
   */
  maxBonus?: number;
  notes: string;
}

export interface FollowUpContext {
  /** Points earned per core question, keyed by question id. */
  points: Record<string, number>;
}

export const CATEGORIES: Category[] = [
  {
    code: "STR",
    name: "Strategy & Leadership",
    weight: 0.15,
    description: "Executive buy-in, vision, and strategic alignment for AI.",
  },
  {
    code: "DAT",
    name: "Data Readiness",
    weight: 0.18,
    description: "Quality, accessibility, governance, and structure of business data.",
  },
  {
    code: "TECH",
    name: "Technology Infrastructure",
    weight: 0.14,
    description: "Cloud maturity, integration, and security posture.",
  },
  {
    code: "TAL",
    name: "Talent & Skills",
    weight: 0.12,
    description: "Internal capabilities, upskilling, and workforce readiness.",
  },
  {
    code: "PRO",
    name: "Process Maturity",
    weight: 0.12,
    description: "Documentation, automation, and performance measurement.",
  },
  {
    code: "USE",
    name: "Use Cases & ROI",
    weight: 0.14,
    description: "Clarity of AI opportunities, prioritization, and outcomes.",
  },
  {
    code: "ETH",
    name: "Ethics & Governance",
    weight: 0.08,
    description: "Responsible-use policies, risk, and compliance management.",
  },
  {
    code: "FIN",
    name: "Financial Capacity",
    weight: 0.07,
    description: "Budget commitment and investment evaluation for AI.",
  },
];

export const CONTEXT_QUESTIONS: ContextQuestion[] = [
  {
    id: "C1",
    text: "What industry is your business in?",
    options: [
      "Financial Services",
      "Healthcare",
      "Retail / E-commerce",
      "Manufacturing",
      "Professional Services",
      "Technology / SaaS",
      "Education",
      "Government / Non-profit",
      "Energy / Utilities",
      "Transportation / Logistics",
      "Media / Entertainment",
      "Other",
    ],
  },
  {
    id: "C2",
    text: "How many employees does your organization have?",
    options: ["1-10", "11-50", "51-250", "251-1,000", "1,001-5,000", "5,000+"],
  },
  {
    id: "C3",
    text: "What is your organization's approximate annual revenue?",
    options: ["<$1M", "$1M-$10M", "$10M-$50M", "$50M-$250M", "$250M-$1B", ">$1B"],
  },
  {
    id: "C4",
    text: "Where does your business operate?",
    options: [
      "Physical locations only",
      "Online or digital only",
      "Both physical and online",
    ],
  },
];

/**
 * Helper — builds the 5-option 0/1/2/3/4 scale used by every core question.
 */
const scale = (labels: [string, string, string, string, string]): AnswerOption[] =>
  labels.map((label, i) => ({ id: "abcde"[i], label, points: i }));

export const CORE_QUESTIONS: Question[] = [
  // --- Strategy & Leadership ---
  {
    id: "Q1",
    category: "STR",
    text: "Does your organization have a documented AI strategy?",
    options: scale([
      "No strategy exists",
      "Informal discussions only",
      "Draft strategy in development",
      "Formal strategy exists but not broadly communicated",
      "Formal strategy, communicated company-wide, and being executed",
    ]),
    branchNote: "If answer ≥ 3, trigger Follow-Up F2.",
  },
  {
    id: "Q2",
    category: "STR",
    text: "How engaged is your executive leadership with AI initiatives?",
    options: scale([
      "Not engaged or skeptical",
      "Aware but not actively involved",
      "Supportive but not directly involved",
      "Actively sponsoring AI initiatives",
      "A C-level executive owns AI/data as a primary mandate",
    ]),
  },
  {
    id: "Q3",
    category: "STR",
    text: "How is AI reflected in your business planning?",
    options: scale([
      "Not considered",
      "Occasionally discussed",
      "Included in some team/department plans",
      "Embedded in most department plans",
      "Core pillar of company-wide strategic plan",
    ]),
  },

  // --- Data Readiness ---
  {
    id: "Q4",
    category: "DAT",
    text: "How is your business data primarily stored today?",
    options: scale([
      "Paper or physical records",
      "Siloed spreadsheets and local files",
      "Mix of databases and spreadsheets, partially centralized",
      "Centralized databases or data warehouse for most data",
      "Fully integrated data lake/warehouse with active governance",
    ]),
    branchNote: "If answer ≤ 1, trigger Follow-Up F3.",
  },
  {
    id: "Q5",
    category: "DAT",
    text: "How would you rate the quality of your business data (accuracy, completeness, consistency)?",
    options: scale([
      "Unknown — never measured",
      "Known to have significant issues",
      "Variable depending on source",
      "Generally reliable with some gaps",
      "High quality with active quality monitoring",
    ]),
  },
  {
    id: "Q6",
    category: "DAT",
    text: "Do you have formal data governance (ownership, access, quality, retention)?",
    options: scale([
      "None",
      "Informal practices only",
      "Some documented policies in specific areas",
      "Formal policies with named data owners",
      "Mature governance with dedicated team and tooling",
    ]),
  },
  {
    id: "Q7",
    category: "DAT",
    text: "How easy is it for authorized staff to access data across departments?",
    options: scale([
      "Not possible without major effort",
      "Possible but slow; requires IT requests",
      "Some shared data via reports or shared drives",
      "Most data accessible via BI tools",
      "Self-service access with proper access controls",
    ]),
  },

  // --- Technology Infrastructure ---
  {
    id: "Q8",
    category: "TECH",
    text: "Where does most of your technology run?",
    options: scale([
      "On-premise legacy systems",
      "Mostly on-premise with some SaaS",
      "Hybrid of cloud and on-premise",
      "Mostly cloud-based",
      "Cloud-native with modern architecture (containers, microservices)",
    ]),
  },
  {
    id: "Q9",
    category: "TECH",
    text: "How do your core business systems integrate with each other?",
    options: scale([
      "Mostly manual transfers (email, copy-paste)",
      "A few brittle point-to-point integrations",
      "Some API-based integrations",
      "Most systems connected via APIs",
      "Fully integrated via modern APIs and/or event streaming",
    ]),
  },
  {
    id: "Q10",
    category: "TECH",
    text: "How mature is your cybersecurity posture?",
    options: scale([
      "Minimal or reactive",
      "Basic protections in place",
      "Standard industry security practices",
      "Proactive program with regular audits",
      "Enterprise-grade with dedicated team or SOC",
    ]),
  },

  // --- Talent & Skills ---
  {
    id: "Q11",
    category: "TAL",
    text: "Do you have staff with data or AI technical skills?",
    options: scale([
      "None",
      "One or two generalists who dabble",
      "Small team of analysts or data engineers",
      "Dedicated data and/or ML team",
      "Multi-disciplinary AI/ML organization",
    ]),
    branchNote: "If answer = 0, trigger Follow-Up F4. If answer ≥ 3, trigger Follow-Up F5.",
  },
  {
    id: "Q12",
    category: "TAL",
    text: "How do you develop AI and data skills internally?",
    options: scale([
      "No development activity",
      "Ad-hoc learning by individuals",
      "Occasional training programs offered",
      "Structured upskilling program",
      "Continuous learning culture with AI-literacy program",
    ]),
  },
  {
    id: "Q13",
    category: "TAL",
    text: "How do employees generally feel about AI at work?",
    options: scale([
      "Resistant or concerned",
      "Uncertain",
      "Mixed / neutral",
      "Supportive and curious",
      "Enthusiastic and actively experimenting",
    ]),
  },

  // --- Process Maturity ---
  {
    id: "Q14",
    category: "PRO",
    text: "How well-documented are your core business processes?",
    options: scale([
      "Not documented",
      "Tribal knowledge with minimal docs",
      "Some processes documented",
      "Most core processes documented",
      "All core processes documented and regularly reviewed",
    ]),
  },
  {
    id: "Q15",
    category: "PRO",
    text: "How much of your work is automated (workflow automation, RPA, scripts)?",
    options: scale([
      "Very little — mostly manual",
      "A few basic automations",
      "Department-specific automations",
      "Many processes automated across the company",
      "Enterprise-wide automation platform in use",
    ]),
  },
  {
    id: "Q16",
    category: "PRO",
    text: "How do you measure process and business performance?",
    options: scale([
      "Not measured",
      "Informal / anecdotal",
      "Some KPIs tracked manually",
      "KPIs in dashboards",
      "Real-time monitoring with predictive alerts",
    ]),
  },

  // --- Use Cases & ROI ---
  {
    id: "Q17",
    category: "USE",
    text: "Have you identified specific AI use cases for your business?",
    options: scale([
      "No",
      "Brainstormed ideas but nothing concrete",
      "A few use cases identified",
      "Prioritized portfolio of use cases",
      "Quantified ROI for each with a roadmap",
    ]),
  },
  {
    id: "Q18",
    category: "USE",
    text: "Have you implemented any AI or ML solutions?",
    options: scale([
      "None",
      "Exploring or piloting",
      "One or two in production",
      "Several in production",
      "AI embedded across multiple business functions",
    ]),
    branchNote: "If answer ≥ 2, trigger Follow-Up F1.",
  },
  {
    id: "Q19",
    category: "USE",
    text: "How well do you understand potential AI ROI for your industry?",
    options: scale([
      "Don't know",
      "Heard some stories",
      "Some internal analysis",
      "Detailed business case developed",
      "Measured ROI from existing AI initiatives",
    ]),
  },

  // --- Ethics & Governance ---
  {
    id: "Q20",
    category: "ETH",
    text: "Do you have AI or responsible-use policies?",
    options: scale([
      "None",
      "Informal awareness",
      "Draft policy or referenced in other docs",
      "Formal policy exists",
      "Formal policy plus review board or audit process",
    ]),
  },
  {
    id: "Q21",
    category: "ETH",
    text: "How do you manage regulatory and compliance risks for data and AI?",
    options: scale([
      "Not considered",
      "Basic awareness",
      "Compliance handled reactively when issues arise",
      "Proactive compliance program",
      "Dedicated compliance function with AI-specific controls",
    ]),
  },

  // --- Financial Capacity ---
  {
    id: "Q22",
    category: "FIN",
    text: "Do you have budget earmarked for AI or data initiatives?",
    options: scale([
      "None",
      "Ad-hoc / project-by-project basis",
      "Small dedicated annual budget",
      "Significant annual budget",
      "Multi-year committed investment",
    ]),
    branchNote: "If answer ≥ 2, trigger Follow-Up F6.",
  },
  {
    id: "Q23",
    category: "FIN",
    text: "How do you evaluate investment in AI?",
    options: scale([
      "No formal evaluation",
      "ROI estimated informally",
      "Business cases required for approval",
      "Structured portfolio management",
      "Outcomes-based funding with continuous reprioritization",
    ]),
  },
];

export const FOLLOW_UPS: FollowUpQuestion[] = [
  {
    id: "F1",
    triggerLabel: "Q18 ≥ 2 (AI in production)",
    shouldAsk: ({ points }) => (points["Q18"] ?? 0) >= 2,
    question: "Which types of AI have you deployed in production? (select all that apply)",
    options: [
      { id: "a", label: "Predictive analytics / forecasting", points: 1 },
      { id: "b", label: "Classification / decision support", points: 1 },
      { id: "c", label: "Generative AI (text, code, image)", points: 1 },
      { id: "d", label: "Computer vision", points: 1 },
      { id: "e", label: "Natural language processing / chatbots", points: 1 },
      { id: "f", label: "Recommendation systems", points: 1 },
    ],
    scored: true,
    targetCategory: "USE",
    multiSelect: true,
    maxBonus: 4,
    notes: "+1 per type deployed, capped at +4 to Use Cases & ROI subtotal.",
  },
  {
    id: "F2",
    triggerLabel: "Q1 ≥ 3 (formal AI strategy)",
    shouldAsk: ({ points }) => (points["Q1"] ?? 0) >= 3,
    question: "How often is your AI strategy formally reviewed and updated?",
    options: [
      { id: "a", label: "Never", points: 0 },
      { id: "b", label: "Ad-hoc", points: 1 },
      { id: "c", label: "Annually", points: 2 },
      { id: "d", label: "Semi-annually", points: 3 },
      { id: "e", label: "Quarterly or more often", points: 4 },
    ],
    scored: true,
    targetCategory: "STR",
    multiSelect: false,
    maxBonus: 2,
    notes: "Adds bonus to Strategy & Leadership subtotal (capped at +2).",
  },
  {
    id: "F3",
    triggerLabel: "Q4 ≤ 1 (low data maturity)",
    shouldAsk: ({ points }) => (points["Q4"] ?? 0) <= 1,
    question: "What is your plan to modernize your data environment in the next 12 months?",
    options: [
      { id: "a", label: "No plan", points: 0 },
      { id: "b", label: "Exploring options", points: 0 },
      { id: "c", label: "Plan drafted", points: 0 },
      { id: "d", label: "Plan approved and budgeted", points: 0 },
      { id: "e", label: "Modernization already underway", points: 0 },
    ],
    scored: false,
    multiSelect: false,
    notes: "Informational — shapes recommendations; does not change score.",
  },
  {
    id: "F4",
    triggerLabel: "Q11 = 0 (no data/AI staff)",
    shouldAsk: ({ points }) => (points["Q11"] ?? -1) === 0,
    question: "How do you plan to acquire AI/data capabilities?",
    options: [
      { id: "a", label: "No plan", points: 0 },
      { id: "b", label: "Hire new talent", points: 0 },
      { id: "c", label: "Train existing staff", points: 0 },
      { id: "d", label: "Partner with consultants / vendors", points: 0 },
      { id: "e", label: "Combination of the above", points: 0 },
    ],
    scored: false,
    multiSelect: false,
    notes: "Informational — shapes recommendations; does not change score.",
  },
  {
    id: "F5",
    triggerLabel: "Q11 ≥ 3 (dedicated team)",
    shouldAsk: ({ points }) => (points["Q11"] ?? 0) >= 3,
    question: "Does your data/AI team have an MLOps or AI platform capability?",
    options: [
      { id: "a", label: "No — models built ad-hoc", points: 0 },
      { id: "b", label: "Some tooling but not standardized", points: 1 },
      { id: "c", label: "Standardized MLOps pipeline in use", points: 2 },
      { id: "d", label: "Enterprise AI platform with monitoring and governance", points: 3 },
    ],
    scored: true,
    targetCategory: "TECH",
    multiSelect: false,
    maxBonus: 2,
    notes: "Adds bonus to Technology Infrastructure subtotal (capped at +2).",
  },
  {
    id: "F6",
    triggerLabel: "Q22 ≥ 2 (has AI budget)",
    shouldAsk: ({ points }) => (points["Q22"] ?? 0) >= 2,
    question: "What percentage of your annual technology budget is allocated to AI/data?",
    options: [
      { id: "a", label: "Less than 5%", points: 1 },
      { id: "b", label: "5% to 10%", points: 2 },
      { id: "c", label: "10% to 20%", points: 3 },
      { id: "d", label: "More than 20%", points: 4 },
    ],
    scored: true,
    targetCategory: "FIN",
    multiSelect: false,
    maxBonus: 2,
    notes: "Adds bonus to Financial Capacity subtotal (capped at +2).",
  },
  {
    id: "F7",
    triggerLabel: "Always asked at end",
    shouldAsk: () => true,
    question: "What is the #1 business outcome you hope AI will drive?",
    options: [
      { id: "a", label: "Cost reduction / efficiency", points: 0 },
      { id: "b", label: "Revenue growth / new products", points: 0 },
      { id: "c", label: "Customer experience improvement", points: 0 },
      { id: "d", label: "Risk reduction / compliance", points: 0 },
      { id: "e", label: "Employee productivity", points: 0 },
      { id: "f", label: "Competitive differentiation", points: 0 },
    ],
    scored: false,
    multiSelect: false,
    notes: "Informational — used to tailor recommendations.",
  },
];

export interface ScoreBand {
  min: number;
  max: number;
  label: "Foundational" | "Developing" | "Emerging" | "Proficient" | "Advanced";
  meaning: string;
  nextActions: string;
}

export const SCORE_BANDS: ScoreBand[] = [
  {
    min: 1,
    max: 20,
    label: "Foundational",
    meaning: "Not yet AI-ready. Focus first on data, process, and leadership fundamentals.",
    nextActions:
      "Build a written AI strategy; inventory data assets; digitize and document core processes.",
  },
  {
    min: 21,
    max: 40,
    label: "Developing",
    meaning: "Early-stage readiness with significant gaps. A few building blocks in place.",
    nextActions:
      "Prioritize 1–2 pilot use cases; begin data-quality work; assign an executive sponsor.",
  },
  {
    min: 41,
    max: 60,
    label: "Emerging",
    meaning: "Key building blocks in place; ready for targeted pilots.",
    nextActions:
      "Launch pilots tied to measurable KPIs; formalize governance; stand up a data/AI lead.",
  },
  {
    min: 61,
    max: 80,
    label: "Proficient",
    meaning: "Ready for scaled AI adoption across multiple functions.",
    nextActions:
      "Scale successful pilots; invest in MLOps; formalize responsible-AI policy.",
  },
  {
    min: 81,
    max: 100,
    label: "Advanced",
    meaning: "AI-mature organization positioned for transformation.",
    nextActions:
      "Continuously reprioritize portfolio; pursue competitive AI differentiators; share best practices.",
  },
];

/** Convenience lookups used throughout the app. */
export const CATEGORY_BY_CODE: Record<CategoryCode, Category> = Object.fromEntries(
  CATEGORIES.map((c) => [c.code, c])
) as Record<CategoryCode, Category>;

export const QUESTION_BY_ID: Record<string, Question> = Object.fromEntries(
  CORE_QUESTIONS.map((q) => [q.id, q])
);

export const FOLLOW_UP_BY_ID: Record<string, FollowUpQuestion> = Object.fromEntries(
  FOLLOW_UPS.map((f) => [f.id, f])
);
