import { BrandMark } from './Icons'

interface NavbarProps {
  onLogoClick?: () => void
}

export default function Navbar({ onLogoClick }: NavbarProps) {
  const brandContent = (
    <div className="flex items-center gap-3">
      <BrandMark className="text-ink shrink-0" />
      <div>
        <span className="block font-serif text-[1.5rem] font-semibold leading-tight tracking-[-0.01em] text-ink">
          SecondSight
        </span>
        <p className="text-[0.875rem] leading-snug text-ink-2">
          Pause the payment. Not the person.
        </p>
      </div>
    </div>
  )

  return (
    <header className="w-full border-b border-line bg-paper">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4 lg:px-12">
        {onLogoClick ? (
          <button
            type="button"
            onClick={onLogoClick}
            aria-label="SecondSight Home"
            className="min-h-[48px] text-left cursor-pointer rounded-tag ui-transition hover:opacity-85"
          >
            {brandContent}
          </button>
        ) : (
          <div>{brandContent}</div>
        )}

        <p className="text-[0.875rem] leading-normal text-ink-2">
          Signed in as Margaret Davis
        </p>
      </div>
    </header>
  )
}
