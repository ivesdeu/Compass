"use client"

import * as React from "react"
import { useState, useEffect, useRef } from "react"
import { Lightbulb, Mic, Globe, Paperclip, Send, Square } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { cn } from "@/lib/utils"

const PLACEHOLDERS = [
  "Summarize last month’s revenue vs expenses",
  "Which clients have the highest outstanding AR?",
  "Draft a follow-up email for a late invoice",
  "What should I focus on this week financially?",
  "Explain gross margin vs net profit in plain language",
  "Help me plan next quarter’s budget categories",
]

export type AIChatInputSubmitOptions = {
  think: boolean
  deepSearch: boolean
}

export type AIChatInputProps = {
  /** Called when the user sends a message (Enter / Send). */
  onSubmit: (text: string, options: AIChatInputSubmitOptions) => void
  /** Disables input while the agent is responding. */
  disabled?: boolean
  /** Show stop instead of send while the model is working. */
  showStopButton?: boolean
  onStop?: () => void
  className?: string
}

const AIChatInput = ({
  onSubmit,
  disabled = false,
  showStopButton = false,
  onStop,
  className,
}: AIChatInputProps) => {
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [showPlaceholder, setShowPlaceholder] = useState(true)
  const [isActive, setIsActive] = useState(false)
  const [thinkActive, setThinkActive] = useState(false)
  const [deepSearchActive, setDeepSearchActive] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isActive || inputValue || disabled) return

    const interval = setInterval(() => {
      setShowPlaceholder(false)
      setTimeout(() => {
        setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDERS.length)
        setShowPlaceholder(true)
      }, 400)
    }, 3000)

    return () => clearInterval(interval)
  }, [isActive, inputValue, disabled])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        if (!inputValue) setIsActive(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [inputValue])

  const handleActivate = () => {
    if (!disabled) setIsActive(true)
  }

  const handleSend = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (disabled) return
    const t = inputValue.trim()
    if (!t) return
    onSubmit(t, { think: thinkActive, deepSearch: deepSearchActive })
    setInputValue("")
    setIsActive(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (disabled || !inputValue.trim()) return
      onSubmit(inputValue.trim(), {
        think: thinkActive,
        deepSearch: deepSearchActive,
      })
      setInputValue("")
      setIsActive(false)
    }
  }

  const containerVariants = {
    collapsed: {
      height: 68,
      boxShadow: "0 2px 8px 0 rgba(0,0,0,0.08)",
      transition: { type: "spring", stiffness: 120, damping: 18 },
    },
    expanded: {
      height: 128,
      boxShadow: "0 8px 32px 0 rgba(0,0,0,0.16)",
      transition: { type: "spring", stiffness: 120, damping: 18 },
    },
  }

  const placeholderContainerVariants = {
    initial: {},
    animate: { transition: { staggerChildren: 0.025 } },
    exit: { transition: { staggerChildren: 0.015, staggerDirection: -1 } },
  }

  const letterVariants = {
    initial: {
      opacity: 0,
      filter: "blur(12px)",
      y: 10,
    },
    animate: {
      opacity: 1,
      filter: "blur(0px)",
      y: 0,
      transition: {
        opacity: { duration: 0.25 },
        filter: { duration: 0.4 },
        y: { type: "spring", stiffness: 80, damping: 20 },
      },
    },
    exit: {
      opacity: 0,
      filter: "blur(12px)",
      y: -10,
      transition: {
        opacity: { duration: 0.2 },
        filter: { duration: 0.3 },
        y: { type: "spring", stiffness: 80, damping: 20 },
      },
    },
  }

  const expanded = (isActive || !!inputValue) && !disabled

  return (
    <div className={cn("w-full text-zinc-900", className)}>
      <motion.div
        ref={wrapperRef}
        className="w-full max-w-3xl mx-auto"
        variants={containerVariants}
        animate={expanded ? "expanded" : "collapsed"}
        initial="collapsed"
        style={{ overflow: "hidden", borderRadius: 32, background: "#fff" }}
        onClick={handleActivate}
      >
        <div className="flex flex-col items-stretch w-full h-full">
          <div className="flex items-center gap-2 p-3 rounded-full bg-white max-w-3xl w-full">
            <button
              className="p-3 rounded-full hover:bg-zinc-100 transition disabled:opacity-40"
              title="Attach file"
              type="button"
              tabIndex={-1}
              disabled={disabled}
            >
              <Paperclip size={20} />
            </button>

            <div className="relative flex-1">
              <input
                type="text"
                value={inputValue}
                disabled={disabled}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 border-0 outline-none rounded-md py-2 text-base bg-transparent w-full font-normal disabled:opacity-50"
                style={{ position: "relative", zIndex: 1 }}
                onFocus={handleActivate}
              />
              <div className="absolute left-0 top-0 w-full h-full pointer-events-none flex items-center px-3 py-2">
                <AnimatePresence mode="wait">
                  {showPlaceholder && !isActive && !inputValue && !disabled && (
                    <motion.span
                      key={placeholderIndex}
                      className="absolute left-0 top-1/2 -translate-y-1/2 text-zinc-400 select-none pointer-events-none"
                      style={{
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        zIndex: 0,
                      }}
                      variants={placeholderContainerVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                    >
                      {PLACEHOLDERS[placeholderIndex]
                        .split("")
                        .map((char, i) => (
                          <motion.span
                            key={i}
                            variants={letterVariants}
                            style={{ display: "inline-block" }}
                          >
                            {char === " " ? "\u00A0" : char}
                          </motion.span>
                        ))}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <button
              className="p-3 rounded-full hover:bg-zinc-100 transition disabled:opacity-40"
              title="Voice input"
              type="button"
              tabIndex={-1}
              disabled={disabled}
            >
              <Mic size={20} />
            </button>
            {showStopButton && onStop ? (
              <button
                className="flex items-center gap-1 bg-zinc-800 hover:bg-zinc-700 text-white p-3 rounded-full font-medium justify-center"
                title="Stop"
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.stopPropagation()
                  onStop()
                }}
              >
                <Square size={18} className="fill-current" />
              </button>
            ) : (
              <button
                className="flex items-center gap-1 bg-black hover:bg-zinc-700 text-white p-3 rounded-full font-medium justify-center disabled:opacity-40"
                title="Send"
                type="button"
                tabIndex={-1}
                disabled={disabled || !inputValue.trim()}
                onClick={handleSend}
              >
                <Send size={18} />
              </button>
            )}
          </div>

          <motion.div
            className="w-full flex justify-start px-4 items-center text-sm"
            variants={{
              hidden: {
                opacity: 0,
                y: 20,
                pointerEvents: "none" as const,
                transition: { duration: 0.25 },
              },
              visible: {
                opacity: 1,
                y: 0,
                pointerEvents: "auto" as const,
                transition: { duration: 0.35, delay: 0.08 },
              },
            }}
            initial="hidden"
            animate={expanded ? "visible" : "hidden"}
            style={{ marginTop: 8 }}
          >
            <div className="flex gap-3 items-center">
              <button
                className={cn(
                  "flex items-center gap-1 px-4 py-2 rounded-full transition-all font-medium group disabled:opacity-40",
                  thinkActive
                    ? "bg-blue-600/10 outline outline-blue-600/60 text-blue-950"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
                )}
                title="Think"
                type="button"
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation()
                  setThinkActive((a) => !a)
                }}
              >
                <Lightbulb
                  className="group-hover:fill-yellow-300 transition-all"
                  size={18}
                />
                Think
              </button>

              <motion.button
                className={cn(
                  "flex items-center px-4 gap-1 py-2 rounded-full transition font-medium whitespace-nowrap overflow-hidden justify-start disabled:opacity-40",
                  deepSearchActive
                    ? "bg-blue-600/10 outline outline-blue-600/60 text-blue-950"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
                )}
                title="Deep Search"
                type="button"
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation()
                  setDeepSearchActive((a) => !a)
                }}
                initial={false}
                animate={{
                  width: deepSearchActive ? 125 : 36,
                  paddingLeft: deepSearchActive ? 8 : 9,
                }}
              >
                <div className="flex-1">
                  <Globe size={18} />
                </div>
                <motion.span
                  className="pb-[2px]"
                  initial={false}
                  animate={{
                    opacity: deepSearchActive ? 1 : 0,
                  }}
                >
                  Deep Search
                </motion.span>
              </motion.button>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}

export { AIChatInput }
