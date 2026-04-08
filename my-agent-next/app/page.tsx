import Link from "next/link"

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 px-4 text-center">
      <h1 className="text-xl font-semibold text-zinc-900">my-agent-next</h1>
      <p className="max-w-md text-sm text-zinc-600">
        The dashboard embeds{" "}
        <code className="rounded bg-zinc-200 px-1 py-0.5 text-xs">/chat</code>.
        Start the dev server, then open Chat in the main app sidebar.
      </p>
      <Link
        href="/chat"
        className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800"
      >
        Open chat UI
      </Link>
    </main>
  )
}
