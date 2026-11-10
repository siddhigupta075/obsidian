import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    paypal?: any
  }
}

interface PayPalButtonProps {
  paymentId: string
  amount: number
  risk: 'LOW' | 'MEDIUM' | 'HIGH'
  onSuccess: (status: 'CAPTURED' | 'HELD', message: string) => void
  onError: (error: string) => void
}

export default function PayPalButton({
  paymentId,
  risk,
  onSuccess,
  onError,
}: PayPalButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [sdkReady, setSdkReady] = useState(false)
  const [clientId, setClientId] = useState<string>('')

  // 1. Fetch public PayPal Client ID from demo endpoint
  useEffect(() => {
    let active = true
    async function loadConfig() {
      try {
        const res = await fetch('/api/demo/users')
        if (res.ok) {
          const data = await res.json()
          if (active && data.paypalClientId) {
            setClientId(data.paypalClientId)
          }
        }
      } catch (e: any) {
        console.error('Failed to load PayPal client ID:', e)
      }
    }
    loadConfig()
    return () => {
      active = false
    }
  }, [])

  // 2. Dynamically inject PayPal JS SDK with intent=authorize
  useEffect(() => {
    if (!clientId) return

    const existingScript = document.getElementById('paypal-sdk-script')
    if (existingScript) {
      if (window.paypal) {
        setSdkReady(true)
        setLoading(false)
      } else {
        existingScript.addEventListener('load', () => {
          setSdkReady(true)
          setLoading(false)
        })
      }
      return
    }

    const script = document.createElement('script')
    script.id = 'paypal-sdk-script'
    // Hard Rule #4: Both SDK and server order payload must specify intent=authorize
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&intent=authorize&currency=USD`
    script.async = true
    script.onload = () => {
      setSdkReady(true)
      setLoading(false)
    }
    script.onerror = () => {
      setLoading(false)
      onError('Failed to load PayPal security gateway. Please check your internet connection.')
    }
    document.body.appendChild(script)
  }, [clientId, onError])

  // 3. Render PayPal Smart Buttons
  useEffect(() => {
    if (!sdkReady || !window.paypal || !containerRef.current) return

    containerRef.current.innerHTML = ''

    try {
      window.paypal
        .Buttons({
          style: {
            layout: 'vertical',
            color: 'gold',
            shape: 'rect',
            label: 'paypal',
            height: 48,
          },
          // Calls server to create order with intent AUTHORIZE from stored DB values
          createOrder: async () => {
            const res = await fetch('/api/orders', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ paymentId }),
            })

            if (!res.ok) {
              const err = await res.json()
              throw new Error(err.error || 'Failed to initialize payment with PayPal')
            }

            const data = await res.json()
            return data.orderId
          },
          // Buyer approved in popup — server authorizes payment
          onApprove: async (data: { orderID: string }) => {
            try {
              const res = await fetch(`/api/orders/${data.orderID}/authorize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
              })

              const result = await res.json()

              if (!res.ok) {
                throw new Error(result.error || 'Failed to authorize payment')
              }

              onSuccess(result.status, result.message)
            } catch (err: any) {
              onError(err?.message || 'Authorization failed')
            }
          },
          onError: (err: any) => {
            console.error('PayPal Button Error:', err)
            onError('PayPal popup error occurred or was cancelled.')
          },
        })
        .render(containerRef.current)
    } catch (err: any) {
      console.error('Failed to render PayPal buttons:', err)
      onError(err?.message || 'Could not display PayPal button')
    }
  }, [sdkReady, paymentId, onSuccess, onError])

  return (
    <div className="w-full flex flex-col items-center">
      {loading && (
        <div className="flex items-center gap-2 py-4 text-xs font-semibold text-slate-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#009F91] border-t-transparent" />
          <span>Connecting to PayPal Sandbox Gateway (Intent: AUTHORIZE)...</span>
        </div>
      )}

      <div
        ref={containerRef}
        id="paypal-button-container"
        className="w-full max-w-md min-h-[50px] my-2"
      />

      <p className="text-[11px] text-slate-500 mt-2 text-center">
        {risk === 'LOW'
          ? 'Safe transaction: Funds will be captured automatically upon PayPal confirmation.'
          : 'Zero-Risk Authorization: Funds are held in escrow. Zero money moves until family review.'}
      </p>
    </div>
  )
}
