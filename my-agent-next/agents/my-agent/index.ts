import { agent, tool } from "@21st-sdk/agent"
import { z } from "zod"

export default agent({
  // Haiku is much faster for short Q&A; switch to claude-sonnet-4-6 if you want higher quality.
  model: "claude-haiku-4-5",
  systemPrompt: `You are the AI assistant for the IDM Business Dashboard — a local-first business performance app (revenue, expenses, MRR, clients, projects, timesheets, invoices).

Help users interpret financial and operational concepts, plan how to use the dashboard, and work through general business or productivity questions. The live numbers live in their browser; you cannot read their database. When they need exact figures, tell them where to look in the app (e.g. Dashboard, Income, Customers) or suggest exporting data.

Be concise, accurate, and practical. Use the calculator tool when arithmetic helps.`,

  tools: {
    add: tool({
      description: "Add two numbers (quick arithmetic).",
      inputSchema: z.object({
        a: z.number(),
        b: z.number(),
      }),
      execute: async ({ a, b }) => ({
        content: [{ type: "text", text: String(a + b) }],
      }),
    }),
  },

  onFinish: async ({ cost, duration, turns }) => {
    if (process.env.NODE_ENV === "development") {
      console.log(
        `[my-agent] done: ${turns} turn(s), ${duration}ms, $${cost.toFixed(4)}`,
      )
    }
  },
})
