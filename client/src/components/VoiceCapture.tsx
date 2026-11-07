import { useState, useRef, useCallback } from 'react'

// ─── Local Speech API type declarations ───────────────────────────────────────

interface ISpeechRecognition extends EventTarget {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}

interface ISpeechRecognitionConstructor {
  new (): ISpeechRecognition
}

declare global {
  interface Window {
    SpeechRecognition: ISpeechRecognitionConstructor | undefined
    webkitSpeechRecognition: ISpeechRecognitionConstructor | undefined
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getSpeechAPI(): ISpeechRecognitionConstructor | null {
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

const PERMISSION_DENIED: ReadonlySet<SpeechRecognitionErrorCode> = new Set([
  'not-allowed',
  'service-not-allowed',
])

// ─── Props / State ────────────────────────────────────────────────────────────

interface VoiceCaptureProps {
  onTranscript: (text: string) => void
  disabled?: boolean
}

type RecognitionState = 'idle' | 'listening' | 'unsupported'

export default function VoiceCapture({ onTranscript, disabled = false }: VoiceCaptureProps) {
  const [state, setState] = useState<RecognitionState>(() =>
    getSpeechAPI() ? 'idle' : 'unsupported'
  )
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const recognitionRef = useRef<ISpeechRecognition | null>(null)

  const startListening = useCallback(() => {
    const SpeechAPI = getSpeechAPI()
    if (!SpeechAPI) return

    setErrorMsg(null)

    const recognition = new SpeechAPI()
    recognition.lang = 'en-IN'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0]?.[0]?.transcript ?? ''
      if (transcript) onTranscript(transcript)
      setState('idle')
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setState('idle')
      if (PERMISSION_DENIED.has(event.error)) {
        setErrorMsg(
          'Microphone permission denied. Enable it in your browser settings to speak.'
        )
      } else if (event.error === 'no-speech') {
        setErrorMsg('No speech detected. Please speak clearly into your mic.')
      } else if (event.error === 'network') {
        setErrorMsg(
          'Voice network error. Check connection or type manually.'
        )
      } else {
        setErrorMsg('Voice input paused. You can continue typing.')
      }
    }

    recognition.onend = () => setState('idle')

    recognitionRef.current = recognition
    recognition.start()
    setState('listening')
  }, [onTranscript])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setState('idle')
  }, [])

  if (state === 'unsupported') {
    return (
      <div className="flex flex-col items-center">
        <span
          role="img"
          aria-label="Voice input unsupported"
          title="Voice input is not supported in this browser"
          className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
        >
          <MicOffIcon />
        </span>
      </div>
    )
  }

  const isListening = state === 'listening'

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={isListening ? stopListening : startListening}
        disabled={disabled}
        aria-label={
          isListening
            ? 'Stop voice recording'
            : 'Start voice input — speak payment reason'
        }
        title={isListening ? 'Click to stop listening' : 'Click to speak reason'}
        className={[
          'group relative inline-flex h-12 w-12 items-center justify-center rounded-xl border transition-all duration-200',
          'focus:outline-none focus-visible:ring-4 focus-visible:ring-offset-2',
          isListening
            ? 'border-rose-500 bg-rose-50 text-rose-600 animate-pulse focus-visible:ring-rose-200 shadow-sm'
            : 'border-[#009F91]/30 bg-[#F0FBF7] text-[#009F91] hover:border-[#009F91] hover:bg-[#DDF7F0] focus-visible:ring-[#009F91]/20 shadow-2xs',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95',
        ].join(' ')}
      >
        {isListening ? (
          <>
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500"></span>
            </span>
            <StopIcon />
          </>
        ) : (
          <MicIcon />
        )}
      </button>

      {isListening && (
        <span
          aria-live="polite"
          className="text-[11px] font-semibold text-rose-600 animate-pulse tracking-wide"
        >
          Listening…
        </span>
      )}

      {errorMsg !== null && !isListening && (
        <p
          role="alert"
          className="mt-1 text-[11px] text-rose-600 leading-tight text-center max-w-[8rem]"
        >
          {errorMsg}
        </p>
      )}
    </div>
  )
}

function MicIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 transition-transform group-hover:scale-110"
      aria-hidden="true"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  )
}

function StopIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  )
}

function MicOffIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <line x1="2" x2="22" y1="2" y2="22" />
      <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
      <path d="M5 10v2a7 7 0 0 0 12 5" />
      <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  )
}
