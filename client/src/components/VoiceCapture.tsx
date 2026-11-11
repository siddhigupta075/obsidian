import { useState, useRef, useCallback } from 'react'
import { AlertCircleIcon, MicIcon, MicOffIcon, SquareStopIcon } from './Icons'

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
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          disabled
          aria-label="Speak instead — voice input is not supported in this browser"
          className="relative min-h-[44px] after:content-[''] after:absolute after:-inset-y-[2px] after:inset-x-0 inline-flex items-center gap-2 rounded-control border-[1.5px] border-line bg-paper px-4 py-2 text-[0.9375rem] font-semibold text-ink-3 cursor-not-allowed"
        >
          <MicOffIcon />
          <span>Voice unavailable</span>
        </button>
      </div>
    )
  }

  const isListening = state === 'listening'

  return (
    <div className="mt-3 flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <div aria-live="polite" className="min-h-0">
          {isListening && (
            <span className="inline-flex items-center gap-1.5 rounded-tag border border-hold-border bg-hold-tint px-2.5 py-1 text-[0.875rem] font-semibold text-hold">
              <MicIcon />
              <span>Listening…</span>
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={isListening ? stopListening : startListening}
          disabled={disabled}
          aria-pressed={isListening}
          aria-label={
            isListening
              ? 'Stop voice recording'
              : 'Speak instead — dictate payment reason'
          }
          className={[
            "relative min-h-[44px] after:content-[''] after:absolute after:-inset-y-[2px] after:inset-x-0 inline-flex items-center gap-2 rounded-control border-[1.5px] px-4 py-2 text-[1rem] font-semibold ui-transition",
            isListening
              ? 'border-hold-border bg-hold-tint text-hold hover:bg-surface'
              : 'border-brand bg-surface text-brand hover:bg-brand-tint',
            disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
          ].join(' ')}
        >
          {isListening ? (
            <>
              <SquareStopIcon />
              <span>Stop listening</span>
            </>
          ) : (
            <>
              <MicIcon />
              <span>Speak instead</span>
            </>
          )}
        </button>
      </div>

      {errorMsg !== null && !isListening && (
        <p
          role="alert"
          className="flex items-start gap-2 text-[0.9375rem] leading-[1.5] font-semibold text-danger text-right"
        >
          <AlertCircleIcon className="mt-0.5" />
          <span>{errorMsg}</span>
        </p>
      )}
    </div>
  )
}
