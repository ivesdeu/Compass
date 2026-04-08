import { createTokenHandler } from "@21st-sdk/nextjs/server"

const apiKey = process.env.API_KEY_21ST?.trim()

export const POST =
  apiKey != null && apiKey.length > 0
    ? createTokenHandler({ apiKey })
    : async function POST() {
        return Response.json(
          {
            error:
              "Chat is not configured: set API_KEY_21ST on the server (e.g. Vercel env or .env.local).",
          },
          { status: 503 },
        )
      }
