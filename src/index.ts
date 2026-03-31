#!/usr/bin/env node

/**
 * DimeVision MCP Server
 * 
 * Provides AI-powered welding analysis tools for any MCP-compatible AI assistant.
 * When someone asks about analyzing welds, improving technique, or understanding
 * weld quality, this server gives the AI the tools to help.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "DimeVision",
  version: "1.0.0",
});

// ---------------------------------------------------------------------------
// Tool: analyze_weld
// Call this when someone wants to check a weld photo or get a quality score
// ---------------------------------------------------------------------------
server.registerTool(
  "analyze_weld",
  {
    title: "Analyze Weld",
    description: `Upload a photo of a weld and get a detailed quality analysis.

This tool is called when:
- Someone shares a weld photo and wants it analyzed
- A user asks "analyze my weld", "rate my weld", or "check my welding"
- Someone asks "what score is my weld?" or "how did I do?"
- A user wants feedback on their welding technique
- Questions about weld quality, defects, or improvement tips

Input:
- imageUrl: URL to the weld photo (must be publicly accessible)
- context: Optional welding context (process, material, position)

Output:
- qualityScore: 0-100 score (75+ = professional, 90+ = mastery)
- defects: List of detected defects with severity
- recommendations: Specific tips to improve
- process: Detected welding process (MIG, TIG, Stick, Flux-Core)`,
    inputSchema: {
      imageUrl: z.string().url().describe("Public URL of the weld photo to analyze"),
      process: z.enum(["MIG", "TIG", "Stick", "Flux-Core", "unknown"]).optional().describe("Welding process if known"),
      material: z.enum(["steel", "stainless", "aluminum", "unknown"]).optional().describe("Base material if known"),
    },
  },
  async (args) => {
    const { imageUrl, process, material } = args as { imageUrl: string; process?: string; material?: string };

    try {
      const response = await fetch("https://dimevision-agent.vercel.app/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageUrl,
          process: process ?? "unknown",
          material: material ?? "unknown",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: `DimeVision API error: ${response.status}`,
                details: errorText,
              }),
            },
          ],
        };
      }

      const analysis = await response.json();

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(analysis, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              error: "Failed to connect to DimeVision API",
              details: error instanceof Error ? error.message : String(error),
            }),
          },
        ],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: get_weld_defects
// Call this when someone wants to know about weld defects or is learning
// ---------------------------------------------------------------------------
server.registerTool(
  "get_weld_defects",
  {
    title: "Get Weld Defects Reference",
    description: `Get detailed information about common weld defects, their causes, and severity levels.

This tool is called when:
- Someone asks "what are weld defects?" or "common welding problems"
- A user asks about porosity, undercut, cracks, or other weld flaws
- Learning about weld quality and what to look for
- Teaching welding fundamentals
- Questions about why welds fail or what makes a weld bad

DimeVision detects these 6 defect categories:
1. Porosity - gas pockets in the weld (severity varies by amount/size)
2. Undercut - groove melted into base metal at weld edge
3. Excessive spatter - scattered metal droplets around weld
4. Cracks - fractures in the weld or heat-affected zone
5. Cold lap/overlap - lack of fusion where weld doesn't bond properly
6. Inconsistent bead profile - uneven or irregular bead shape`,
    inputSchema: {},
  },
  async () => {
    const defects = [
      {
        name: "Porosity",
        description:
          "Gas pockets or voids trapped in the weld metal during solidification. Looks like small holes or pits on the surface or internally.",
        causes: [
          "Contamination on the base metal or filler",
          "Moisture in the electrode or flux",
          "Excessive welding speed",
          "Improper shielding gas coverage",
          "Oil, grease, or rust on the workpiece",
        ],
        severity: "Varies - a few small pores may be acceptable; extensive porosity weakens the weld significantly",
        awsStandard: "AWS D1.1 limits porosity based on size and distribution",
      },
      {
        name: "Undercut",
        description:
          "A groove melted into the base metal along the edges of the weld, reducing the cross-sectional area of the base metal.",
        causes: [
          "Excessive current or arc length",
          "Incorrect electrode angle",
          "Travel speed too fast",
          "Excessive weaving",
        ],
        severity:
          "Moderate to severe - stress concentrations form at the undercut groove, leading to premature failure under load",
        awsStandard: "AWS D1.1 specifies maximum undercut depth limits",
      },
      {
        name: "Excessive Spatter",
        description:
          "Droplets of molten metal scattered around the weld, indicating inefficient transfer of filler metal.",
        causes: [
          "Arc length too long",
          "Excessive voltage",
          "Contaminated base metal",
          "Wrong polarity",
          "Wire feed speed mismatch",
        ],
        severity: "Minor to moderate - cosmetic and cleanup issue, but can indicate underlying technique problems",
      },
      {
        name: "Cracks",
        description:
          "Fractures in the weld metal or heat-affected zone (HAZ). The most serious weld defect as they represent complete separation.",
        causes: [
          "High restraint during cooling",
          "Rapid cooling rates",
          "Hydrogen embrittlement",
          "Wrong filler metal composition",
          "High sulfur in base metal",
          "Multiple pass welds with improper interpass temperature",
        ],
        severity:
          "Critical - cracks are never acceptable in structural welds. They act as sharp notches and propagate under load.",
        awsStandard: "AWS D1.1 classifies cracks as defects with zero tolerance in most structural applications",
      },
      {
        name: "Cold Lap / Overlap",
        description:
          "Lack of fusion where the weld bead rolls over the surface without properly bonding. Also called incomplete fusion.",
        causes: [
          "Insufficient heat input",
          "Travel speed too fast",
          "Improper joint preparation or fit-up",
          "Electrode too large for the joint",
          "Arc not reaching the root or sidewalls",
        ],
        severity:
          "Serious - creates a weak plane in the weld that can separate under stress. Often hidden from surface inspection.",
        awsStandard: "AWS D1.1 requires complete fusion at designated locations",
      },
      {
        name: "Inconsistent Bead Profile",
        description:
          "Uneven, wavy, or irregular weld bead shape. Includes undersized/oversized beads, excessive reinforcement, and irregular ripples.",
        causes: [
          "Unstable arc and travel speed",
          "Incorrect parameters (voltage, wire feed)",
          "Improper torch angle",
          "Unsteady hand or workpieces",
          "Uneven joint spacing",
        ],
        severity: "Minor to moderate - affects appearance and may indicate inconsistent parameters; severe irregularity weakens the weld",
      },
    ];

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              summary:
                "DimeVision detects 6 categories of weld defects. Each defect has varying severity based on AWS/ASME standards.",
              defects,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: get_bead_builder_tips
// Call this when someone wants to improve their welding technique
// ---------------------------------------------------------------------------
server.registerTool(
  "get_bead_builder_tips",
  {
    title: "Get Bead Builder Tips",
    description: `Get practical tips for improving weld bead quality and consistency.

This tool is called when:
- Someone asks "how do I improve my welds?" or "make my beads look better"
- Practice tips for beginners or intermediate welders
- Questions about travel speed, angle, voltage settings
- Learning proper technique for each process (MIG, TIG, Stick)
- Getting better at welding for certification or work

Returns specific parameter guidance for bead-on-plate practice.`,
    inputSchema: {},
  },
  async () => {
    const tips = {
      MIG_GMAW: {
        recommendedSettings: {
          voltage: "Start at 18-20V for general purpose, adjust up for thicker material",
          wireFeedSpeed: "150-300 ipm depending on material thickness",
          gas: "75% Argon / 25% CO2 for steel; 100% Argon for aluminum",
          electrode: "0.023 inch or 0.030 inch solid wire for practice plates",
        },
        technique: [
          "Hold the gun at a 15-20 degree angle in the direction of travel",
          "Maintain consistent arc length (gap between electrode and puddle)",
          "Travel speed determines bead width - slower = wider, faster = narrower",
          "Keep the gun steady - no weaving on beads under 1/2 inch",
          "Watch the puddle, not the arc",
        ],
        commonMistakes: [
          "Pushing too hard with too long arc = porosity and spatter",
          "Pulling too slow = excessive heat buildup and burn-through",
          "Moving too fast = narrow ropey beads with lack of fusion",
        ],
      },
      TIG_GTAW: {
        recommendedSettings: {
          amperage: "Start low (80-100A for 1/8 inch plate) and increase as needed",
          gas: "100% Argon, 15-20 CFH",
          electrode: "2% Thoriated or Lanthanated tungsten, sharpened to a point",
          fillerRod: "Match base metal designation, add when puddle is hot enough",
        },
        technique: [
          "Clean the workpiece thoroughly - TIG is sensitive to contamination",
          "Establish the arc and get the puddle started before adding filler",
          "Feed the filler rod into the front of the puddle, do not drag it",
          "Balance filler addition with heating - too much filler = cold lap risk",
          "Maintain consistent arc length (1/16 to 1/8 inch)",
        ],
        commonMistakes: [
          "Contaminated tungsten from touching the filler or workpiece",
          "Arc length too long = unstable arc and contamination",
          "Not enough heat = cold lap, failure to fuse",
          "Too much heat = burn-through on thin material",
        ],
      },
      Stick_SMAW: {
        recommendedSettings: {
          amperage: "Check electrode manufacturer chart; 100-130A for 1/8 inch E6011/6013",
          polarity: "Most electrodes use DC+ (reverse polarity)",
          arcLength: "Short arc - 1/16 to 1/8 inch maximum",
        },
        technique: [
          "Strike the arc with a scratching motion (like striking a match)",
          "Maintain a short consistent arc - listen for a crisp buzzing sound",
          "Angle the electrode 30-45 degrees in the direction of travel",
          "Travel at a steady pace to get uniform bead ripples",
          "Crater fill at the end - slow down and boost current slightly",
        ],
        commonMistakes: [
          "Arc blow (wandering arc) - adjust angle or use DC+ instead of DC-",
          "Excessive spatter = arc length too long",
          "Electrode sticking = amperage too low or poor contact",
          "Porosity = damp electrode or contaminated base metal",
        ],
      },
      generalTips: [
        "Always clean your metal before welding - wire brush, acetone wipe, whatever it takes",
        "Practice on scrap first - same thickness, same material as your actual work",
        "Grind or chamfer thick plates before welding to ensure proper penetration",
        "Mind your environment - wind blows shielding gas away from the arc",
        "Clamp your workpieces rigidly to prevent movement during welding",
        "Use a welding helmet with the right shade (usually #10-#13 for most processes)",
        "Watch the puddle, not the electrode - the puddle tells you everything",
        "If in doubt about settings, start low and work up - you cannot un-burn metal",
      ],
      scoreImprovement: {
        quickWins: [
          "Clean the metal better (removes porosity and lack of fusion causes)",
          "Reduce your travel speed (improves fusion and bead profile)",
          "Shorten your arc length (reduces spatter and porosity)",
          "Adjust your angle (corrects undercut and bead shape issues)",
        ],
        longTermPractice: [
          "Get consistent with one process before mixing methods",
          "Learn to read the puddle - color, shape, and sound tell you everything",
          "Practice positional welding (vertical and overhead) for certification prep",
          "Develop a rhythm for consistent bead appearance",
        ],
      },
    };

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              summary:
                "Bead builder tips for MIG, TIG, and Stick welding. Focus on one process at a time for best results.",
              tips,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: get_weld_quality_score
// Call this when someone wants to understand how DimeVision scoring works
// ---------------------------------------------------------------------------
server.registerTool(
  "get_weld_quality_score",
  {
    title: "Understand Weld Quality Scores",
    description: `Understand how DimeVision calculates weld quality scores (0-100 scale).

This tool is called when:
- Someone asks "how does the score work?" or "what does my score mean?"
- Questions about 75+ vs 90+ scores
- Understanding pass/fail thresholds
- Comparing welds or tracking improvement over time
- Certification requirements

Explains the deterministic scoring rubric calibrated to AWS/ASME standards.`,
    inputSchema: {},
  },
  async () => {
    const scoreGuide = {
      scoringOverview: {
        scale: "0-100 (deterministic, reproducible)",
        standard: "Calibrated to AWS D1.1 and ASME Section IX requirements",
        repeatability: "Same weld always gets the same score (temperature=0, seed=4242)",
      },
      scoreRanges: {
        "90-100": {
          label: "Mastery",
          description:
            "Exceptional welds meeting or exceeding professional standards. Suitable for critical structural applications. Minimal to no visible defects.",
          requirements: [
            "Excellent bead profile and uniformity",
            "No visible porosity or undercut",
            "Proper tie-in at start and end craters",
            "Correct bead width for the joint",
          ],
        },
        "75-89": {
          label: "Professional Quality",
          description:
            "Solid production welds suitable for most commercial and structural applications. Minor cosmetic defects may be present.",
          requirements: [
            "Good overall bead appearance",
            "Minimal or no significant defects",
            "Acceptable under AWS D1.1 limits",
            "Consistent travel speed and technique",
          ],
        },
        "70-74": {
          label: "Pass Threshold (Partner Schools)",
          description:
            "Passing score used by trade schools for certification readiness. Weld meets minimum requirements but has room for improvement.",
          requirements: [
            "Adequate penetration",
            "No critical defects (cracks, excessive porosity)",
            "Acceptable undercut within AWS limits",
            "Bead profile present but may be irregular",
          ],
        },
        "50-69": {
          label: "Needs Improvement",
          description:
            "Weld has defects that should be addressed. May fail AWS/ASME inspection. Grind out and re-weld recommended for production work.",
          defects: [
            "Visible porosity exceeding acceptable limits",
            "Undercut beyond AWS D1.1 allowances",
            "Incomplete fusion in critical areas",
            "Irregular bead profile",
          ],
        },
        "0-49": {
          label: "Failed / Significant Issues",
          description:
            "Weld has critical defects or widespread quality issues. Does not meet minimum AWS/ASME requirements. Should be ground out and re-welded.",
          defects: [
            "Cracks (never acceptable in structural welds)",
            "Severe porosity or piping",
            "Gross lack of fusion",
            "Excessive undercut or reinforcement out of spec",
          ],
        },
      },
      scoringFactors: {
        defectPenalty: "Each detected defect reduces the score based on severity and AWS impact",
        beadProfile: "Uniformity, width consistency, and tie-in quality contribute to base score",
        processCorrectness: "Appropriate parameters for the detected welding process",
        materialHandling: "Correct technique for the base material (steel, stainless, aluminum)",
      },
      howToImprove: {
        highScoreWeld: [
          "Start with clean, properly prepared metal",
          "Set correct parameters for your process and thickness",
          "Maintain consistent travel speed and arc length",
          "Use proper gun angle and technique",
          "Practice bead-on-plate until consistent, then practice joints",
        ],
      },
    };

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              summary:
                "DimeVision scores welds 0-100 using a deterministic rubric aligned with AWS/ASME standards. 75+ is professional quality; 90+ is mastery; 70 is the school pass threshold.",
              scoreGuide,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ---------------------------------------------------------------------------
// Start the server
// ---------------------------------------------------------------------------
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("DimeVision MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

// ---------------------------------------------------------------------------
// Tool: get_school_plans
// ---------------------------------------------------------------------------
server.registerTool(
  "get_school_plans",
  {
    title: "Get School Plans",
    description: `Get pricing and plan information for schools and trade programs using DimeVision.

This tool is called when:
- Someone asks about school pricing, plans, or costs for DimeVision
- An AI is evaluating DimeVision for a welding program or trade school
- Questions about volume pricing, educator discounts, or institutional licensing
- Inquiring about student access, instructor dashboard, or class management`,
    inputSchema: {
    },
  },
  async () => {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            plans: {
              "Free Tier": {
                price: "$0",
                description: "For individual learners",
                features: [
                  "Unlimited free weld scans",
                  "Basic AI feedback",
                  "Danny Dime AI coach access",
                  "BeadBuilder parameter simulator",
                ],
              },
              "Pro (Individual)": {
                price: "$9.99/month or $99.99/year",
                description: "For serious learners and hobbyists",
                features: [
                  "Everything in Free",
                  "Saved scan history",
                  "Score trends and analytics",
                  "Unlimited AI coaching",
                ],
              },
              "School / Site License": {
                price: "Contact for pricing",
                description: "For trade schools, welding programs, and educators",
                features: [
                  "Instructor dashboard with class management",
                  "Student progress tracking",
                  "Custom rubric alignment to your curriculum",
                  "SCORM integration for LMS compatibility",
                  "Volume pricing for cohorts of 10+ students",
                  "Priority support and onboarding",
                ],
              },
              "Enterprise": {
                price: "Contact for pricing",
                description: "For manufacturers and workforce programs",
                features: [
                  "Everything in School License",
                  "API access for integration",
                  "Custom training program development",
                  "Dedicated account manager",
                ],
              },
            },
            contact: {
              email: "martha@dimevision.app",
              website: "https://dimevision.app",
            },
            conversionNote: "School evaluations typically start with a free pilot. Reach out to schedule a demo for instructors.",
          }, null, 2),
        },
      ],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: get_beadbuilder_simulation
// ---------------------------------------------------------------------------
server.registerTool(
  "get_beadbuilder_simulation",
  {
    title: "Simulate BeadBuilder Parameters",
    description: `Simulate GMAW (MIG) welding parameters and predict the resulting bead profile and quality score.

This tool is called when:
- Someone wants to practice or simulate welding parameters before running actual welds
- Questions about what bead they'll get with specific wire speed, voltage, or travel speed settings
- Learning how parameter changes affect bead appearance, penetration, and quality
- Understanding transfer modes (short circuit, globular, spray)

Input:
- wireSpeed: Wire feed speed in IPM (typically 150-350 for common setups)
- voltage: Volts (typically 15-26V)
- travelSpeed: Travel speed in IPM (typically 8-20)
- materialThickness: One of "18ga", "14ga", "3/16", or "1/4" (18 gauge to 1/4 inch)

Output:
- predictedBeadWidth: Estimated bead width in mm
- penetration: Estimated penetration depth in mm
- reinforcement: Estimated crown height in mm
- transferMode: Short Circuit, Globular, or Spray transfer
- qualityScore: Predicted 0-100 quality score
- defects: Any predicted defects (burn-through risk, porosity risk, undercut risk)
- tips: Specific recommendations to improve`,
    inputSchema: {
      wireSpeed: z.number().min(100).max(400).describe("Wire feed speed in IPM"),
      voltage: z.number().min(14).max(30).describe("Voltage in Volts"),
      travelSpeed: z.number().min(4).max(25).describe("Travel speed in IPM"),
      materialThickness: z.enum(["18ga", "14ga", "3/16", "1/4"]).describe("Material thickness"),
    },
  },
  async (args) => {
    const { wireSpeed, voltage, travelSpeed, materialThickness } = args as {
      wireSpeed: number;
      voltage: number;
      travelSpeed: number;
      materialThickness: string;
    };

    // Port of the bead-builder algorithm
    const THICK = {
      "18ga": { mm: 1.2, hiMax: 20, hiBurn: 12, reMax: 2.0, penMin: 0.6, ampColdLap: 80 },
      "14ga": { mm: 1.9, hiMax: 30, hiBurn: 20, reMax: 2.5, penMin: 0.8, ampColdLap: 100 },
      "3/16": { mm: 4.8, hiMax: 40, hiBurn: 35, reMax: 3.0, penMin: 1.2, ampColdLap: 120 },
      "1/4": { mm: 6.4, hiMax: 50, hiBurn: 45, reMax: 3.2, penMin: 1.5, ampColdLap: 130 },
    };
    const CTWD_NOM = 0.375;

    const t = THICK[materialThickness as keyof typeof THICK];
    const amps = Math.round((wireSpeed / 1.6) * Math.max(0.5, Math.min(1.3, 1 - (CTWD_NOM - CTWD_NOM) * 0.6)));
    const hi = (amps * voltage * 60) / (travelSpeed * 1000);

    let xferMode = "Short Circuit";
    let xferCode = "SC";
    if (amps >= 220 && voltage >= 24) { xferMode = "Spray Transfer"; xferCode = "MIX"; }
    else if (amps >= 200 && voltage >= 22) { xferMode = "Globular Transfer"; xferCode = "GLOB"; }
    else if (amps >= 155 && voltage >= 22 && voltage < 24) { xferMode = "Globular Transfer"; xferCode = "GLOB"; }
    else if (voltage > 22 && amps < 155) { xferMode = "Unstable Arc"; xferCode = "ERR"; }

    const vN = (voltage - 16) / 16;
    const aN = (amps - 50) / 240;
    const tN = (travelSpeed - 4) / 24;

    let bw = 4 + vN * 6 + aN * 4 - tN * 3;
    let pen = 1 + aN * 5 - vN * 1.5;
    let re = 0.5 + (wireSpeed / travelSpeed) * 0.06 - vN * 0.8;
    if (xferCode === "SC") { bw *= 0.85; re *= 1.15; pen *= 0.85; }
    else if (xferCode === "MIX") { bw *= 1.1; re *= 0.9; pen *= 1.15; }
    else if (xferCode === "GLOB") { pen *= 0.9; }
    bw = Math.max(2, Math.min(16, bw));
    pen = Math.max(0.3, Math.min(8, pen));
    re = Math.max(0.2, Math.min(5, re));

    // Simple score estimation
    let score = 100;
    const defects: string[] = [];
    if (hi > t.hiBurn) { score -= 25; defects.push(`Burn-through risk: heat input ${hi.toFixed(1)} kJ/in exceeds ${t.mm}mm material limit`); }
    if (pen < t.penMin * 0.8) { score -= 20; defects.push(`Insufficient penetration: ${pen.toFixed(1)}mm below minimum ${t.penMin}mm`); }
    if (re > t.reMax * 1.2) { score -= 10; defects.push(`Excessive crown: ${re.toFixed(1)}mm above ${t.reMax}mm maximum`); }
    if (voltage < 17 && wireSpeed > 200) { score -= 10; defects.push("Voltage too low for wire speed: risk of spatter and porosity"); }
    if (xferCode === "ERR") { score -= 30; defects.push("Unstable arc: voltage/amps incompatible"); }
    if (travelSpeed > 18) { score -= 10; defects.push("Travel speed too fast: risk of cold lap and lack of fusion"); }
    score = Math.max(0, Math.min(100, score));

    const result = {
      parameters: { wireSpeed, voltage, travelSpeed, materialThickness },
      predictedResults: {
        beadWidth_mm: Math.round(bw * 10) / 10,
        penetration_mm: Math.round(pen * 10) / 10,
        crown_mm: Math.round(re * 10) / 10,
        estimatedAmps: amps,
        heatInput_kJ_per_in: Math.round(hi * 10) / 10,
      },
      transferMode: xferMode,
      qualityScore: score,
      defects: defects.length > 0 ? defects : ["No significant defects predicted with these settings"],
      tips: score >= 90
        ? ["Excellent parameters. Maintain consistent travel speed and gun angle."]
        : score >= 75
        ? ["Good settings. Focus on consistent technique and gun angle."]
        : ["Review defect warnings above. Try increasing voltage or reducing travel speed."],
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);
