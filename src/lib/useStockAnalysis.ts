'use client'

// ============================================================
// src/lib/useStockAnalysis.ts
// React hook for consuming /api/analysis/stream SSE events.
// Connects to the named-event stream and surfaces:
//   - streaming: bool        — true while the stream is open
//   - text: string           — accumulates tokens in real time
//   - posture: ResearchPosture | null  — parsed when done
//   - toolCalls: string[]    — names of tools Claude called
//   - error: string | null
// ============================================================

import { useState, useCallback } from 'react'
import type { ResearchPosture } from './tools'

export function useStockAnalysis() {
  const [streaming, setStreaming] = useState(false)
  const [text, setText] = useState('')
  const [posture, setPosture] = useState<ResearchPosture | null>(null)
  const [toolCalls, setToolCalls] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const analyze = useCallback(async (ticker: string, query?: string) => {
    setStreaming(true)
    setText('')
    setPosture(null)
    setToolCalls([])
    setError(null)

    try {
      const response = await fetch('/api/analysis/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, query }),
      })

      if (!response.body) throw new Error('No response body')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // SSE messages are separated by double newlines
        const messages = buffer.split('\n\n')
        buffer = messages.pop() || ''

        for (const message of messages) {
          if (!message.trim()) continue
          const lines = message.split('\n')
          const eventLine = lines.find((l) => l.startsWith('event:'))
          const dataLine = lines.find((l) => l.startsWith('data:'))
          if (!eventLine || !dataLine) continue

          const eventName = eventLine.slice(7).trim()
          let data: Record<string, unknown>
          try {
            data = JSON.parse(dataLine.slice(6).trim())
          } catch {
            continue
          }

          switch (eventName) {
            case 'token':
              setText((prev) => prev + (data.text as string))
              break
            case 'tool_call':
              if (data.stage === 'calling') {
                setToolCalls((prev) => [...prev, data.name as string])
              }
              break
            case 'done':
              setStreaming(false)
              try {
                const raw = data.text as string
                const cleaned = raw
                  .replace(/^```json\s*/m, '')
                  .replace(/^```\s*/m, '')
                  .replace(/```\s*$/m, '')
                  .trim()
                const jsonStart = cleaned.indexOf('{')
                const jsonEnd = cleaned.lastIndexOf('}')
                if (jsonStart !== -1 && jsonEnd > jsonStart) {
                  setPosture(JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1)))
                }
              } catch { /* plain text response — posture stays null */ }
              break
            case 'error':
              setError(data.message as string)
              setStreaming(false)
              break
          }
        }
      }
    } catch (err) {
      setError(String(err))
      setStreaming(false)
    }
  }, [])

  return { streaming, text, posture, toolCalls, error, analyze }
}
