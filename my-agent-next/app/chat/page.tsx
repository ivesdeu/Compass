"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"
import "@21st-sdk/react/styles.css"

const SANDBOX_STORAGE_KEY = "idm-21st-chat-sandbox"

const ChatSessionDynamic = dynamic(
  () =>
    import("./chat-session").then((m) => ({
      default: m.ChatSession,
    })),
  { ssr: false },
)

function PreparingShell() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 text-sm text-zinc-500">
      Preparing chat…
    </div>
  )
}

export default function ChatPage() {
  const [mounted, setMounted] = useState(false)
  const [sandboxId, setSandboxId] = useState<string | null>(null)

  // Start downloading the chat chunk as soon as the page mounts (during the shell).
  useEffect(() => {
    void import("./chat-session")
  }, [])

  useEffect(() => {
    let id = localStorage.getItem(SANDBOX_STORAGE_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(SANDBOX_STORAGE_KEY, id)
    }
    setSandboxId(id)
    setMounted(true)
  }, [])

  if (!mounted || !sandboxId) {
    return <PreparingShell />
  }

  return <ChatSessionDynamic sandboxId={sandboxId} />
}
