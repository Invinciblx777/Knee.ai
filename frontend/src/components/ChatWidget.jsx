import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { getAnalysis, sendChatMessage } from '../lib/api'
import Icon from './Icon'

const GREETING =
  "Hi, I'm the Knee.AI assistant. Ask me about a measurement, KL grading, implant " +
  'sizing, or general knee OA questions.'

/** Best-effort record context: whatever study the user is currently looking at. */
function useCurrentRecord() {
  const { pathname, state } = useLocation()
  const [record, setRecord] = useState(state?.result ?? null)

  useEffect(() => {
    if (state?.result) {
      setRecord(state.result)
      return
    }
    const m = pathname.match(/^\/(oa|implant|results)\/([a-f0-9]+)/)
    if (!m) {
      setRecord(null)
      return
    }
    let cancelled = false
    getAnalysis(m[2]).then((r) => !cancelled && setRecord(r)).catch(() => {})
    return () => { cancelled = true }
  }, [pathname, state])

  return record
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const listRef = useRef(null)
  const record = useCurrentRecord()

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, sending, open])

  const send = async () => {
    const text = input.trim()
    if (!text || sending) return
    const next = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setError('')
    setSending(true)
    try {
      const { reply } = await sendChatMessage(next, record)
      setMessages([...next, { role: 'assistant', content: reply }])
    } catch (e) {
      setError(e.message)
    } finally {
      setSending(false)
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open && (
        <div
          className="w-[92vw] max-w-[380px] h-[70vh] max-h-[540px] flex flex-col
                     rounded-[16px] bg-surface animate-fade-up"
          style={{ border: '2px solid #2D2016', boxShadow: '4px 4px 0 #2D2016' }}
        >
          <div
            className="flex items-center justify-between gap-2 px-4 h-14 shrink-0"
            style={{ borderBottom: '2px solid #2D2016' }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="w-8 h-8 rounded-[8px] bg-accent text-white flex items-center justify-center shrink-0"
                style={{ border: '2px solid #2D2016' }}
              >
                <Icon name="chat" size={15} />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-display font-bold text-navy leading-tight truncate">
                  Knee.AI Assistant
                </p>
                {record && (
                  <p className="text-[10px] text-muted font-display truncate">
                    Viewing {record.patient?.name || 'current study'}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-7 h-7 rounded-[8px] flex items-center justify-center text-muted hover:bg-page transition-colors duration-150 shrink-0"
              aria-label="Close chat"
            >
              <Icon name="close" size={15} />
            </button>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && (
              <div
                className="rounded-[12px] bg-page px-3.5 py-3 text-[12.5px] text-muted font-display leading-relaxed"
                style={{ border: '2px solid #2D2016' }}
              >
                {GREETING}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-[12px] px-3.5 py-2.5 text-[13px] font-display leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user' ? 'bg-accent text-white' : 'bg-page text-navy'
                  }`}
                  style={{ border: '2px solid #2D2016' }}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div
                  className="rounded-[12px] bg-page px-3.5 py-2.5 text-[12px] text-muted font-display"
                  style={{ border: '2px solid #2D2016' }}
                >
                  Thinking…
                </div>
              </div>
            )}
            {error && (
              <div
                className="rounded-[10px] bg-danger-light px-3.5 py-2.5 text-[12px] text-danger font-display"
                style={{ border: '2px solid #2D2016' }}
              >
                {error}
              </div>
            )}
          </div>

          <div className="flex items-end gap-2 p-3 shrink-0" style={{ borderTop: '2px solid #2D2016' }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask something…"
              rows={1}
              className="input flex-1 h-10 py-2 text-[13px] resize-none"
              disabled={sending}
            />
            <button
              onClick={send}
              disabled={sending || !input.trim()}
              className="btn-primary w-10 h-10 px-0 shrink-0"
              aria-label="Send"
            >
              <Icon name="send" size={15} />
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="w-14 h-14 rounded-full bg-accent text-white flex items-center justify-center
                   transition-transform duration-150 hover:scale-105"
        style={{ border: '2px solid #2D2016', boxShadow: '3px 3px 0 #2D2016' }}
        aria-label={open ? 'Close chat' : 'Open chat'}
      >
        <Icon name={open ? 'close' : 'chat'} size={22} />
      </button>
    </div>
  )
}
