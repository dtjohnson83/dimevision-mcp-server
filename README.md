# DimeVision MCP Server

Give your AI assistant the ability to analyze welds, understand defect types, and get welding improvement tips.

## What This Does

When you ask an AI about welding, this MCP server gives it the tools to actually help:

- **Analyze a weld photo** and get a quality score (0-100)
- **Look up weld defects** (porosity, undercut, cracks, etc.)
- **Get bead building tips** for MIG, TIG, and Stick welding
- **Understand how scoring works** (AWS/ASME calibrated)

## Installation via Smithery

```bash
npx -y @smithery/cli@latest install dimevision-mcp-server
```

Or add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "dimevision": {
      "command": "npx",
      "args": ["-y", "dimevision-mcp-server"]
    }
  }
}
```

## Local Installation

```bash
npm install -g dimevision-mcp-server
```

Or clone and run:

```bash
git clone https://github.com/dtjohnson83/dimevision-mcp-server.git
cd dimevision-mcp-server
npm install
npm run build
npm start
```

## Configuration

No API key required. The server calls the DimeVision API directly at `https://dimevision-agent.vercel.app/api/analyze`.

## Tools Available

### `analyze_weld`

Upload a weld photo URL and get a full analysis.

**When AI calls this:**
- "Analyze my weld" / "Rate my weld"
- "Check this welding photo"
- "What score is this weld?"
- "Give me feedback on my technique"

**Input:**
```json
{
  "imageUrl": "https://example.com/my-weld.jpg",
  "process": "MIG",
  "material": "steel"
}
```

---

### `get_weld_defects`

Look up common weld defects, their causes, and severity.

**When AI calls this:**
- "What is porosity in welding?"
- "Common weld defects and how to fix them"
- "Why do my welds crack?"
- "What causes undercut?"

---

### `get_bead_builder_tips`

Get practical tips for improving weld bead quality by process.

**When AI calls this:**
- "How do I improve my MIG welds?"
- "Tips for better bead appearance"
- "What voltage should I use for MIG?"
- "Help with my TIG technique"

---

### `get_weld_quality_score`

Understand how DimeVision scores welds 0-100.

**When AI calls this:**
- "How does the score work?"
- "What score is professional quality?"
- "What's the pass threshold for welding certification?"
- "How is my weld rated?"

---

## Example Conversations

**User:** "Can you analyze this weld photo for me?"  
**AI:** (calls `analyze_weld` with the photo URL)  
**AI:** "That weld scores 78/100 — solid professional quality. I can see minor porosity in the center and the bead width is slightly inconsistent toward the end. Main tip: slow down your travel speed on your next run."

**User:** "I keep getting porosity in my MIG welds. What's wrong?"  
**AI:** (could call `get_weld_defects` for porosity details)  
**AI:** "Porosity is gas pockets trapped in the weld. Common causes are contamination on your metal, moisture in your wire, or your shielding gas getting blown away. Clean your metal with acetone before welding and check for drafts."

**User:** "What score do I need to pass my welding certification?"  
**AI:** (calls `get_weld_quality_score`)  
**AI:** "DimeVision partner schools use 70 as the pass threshold. Professional quality starts at 75, and 90+ is considered mastery level. Focus on consistent bead profile and eliminating undercut."

## Technical Details

- Built with the Model Context Protocol (MCP) TypeScript SDK
- Uses stdio transport for local process integration
- Calls DimeVision's x402-enabled API endpoint
- Equipment and process agnostic (works with any welding machine)

## For Developers

```bash
# Build
npm run build

# Run directly
npm run dev

# Package for npm
npm publish
```

## Related

- [DimeVision](https://dimevision.app) - AI welding analysis platform
- [MCP Documentation](https://modelcontextprotocol.io)
- [Smithery](https://smithery.ai) - MCP server registry
