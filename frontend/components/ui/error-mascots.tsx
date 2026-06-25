'use client'

// ── ผัก/ผลไม้มาสคอตสำหรับหน้า error/empty ต่างๆ — 404, 500, 503, offline, slow, empty ──

export function BroccoliMascot() {
  return (
    <svg width="160" height="180" viewBox="0 0 160 180" className="animate-err-float" style={{ overflow: 'visible' }}>
      <ellipse cx="80" cy="172" rx="36" ry="7" fill="#e5e7eb" />
      <rect x="72" y="126" width="16" height="32" rx="8" fill="#388E3C" />
      <circle cx="80" cy="96" r="56" fill="#66BB6A" />
      <circle cx="48" cy="62" r="22" fill="#81C784" />
      <circle cx="80" cy="50" r="26" fill="#81C784" />
      <circle cx="112" cy="62" r="22" fill="#81C784" />
      <circle cx="60" cy="54" r="17" fill="#A5D6A7" />
      <circle cx="100" cy="54" r="17" fill="#A5D6A7" />
      <circle cx="80" cy="46" r="15" fill="#C8E6C9" />
      <ellipse cx="48" cy="110" rx="14" ry="10" fill="#EF9A9A" opacity=".45" />
      <ellipse cx="112" cy="110" rx="14" ry="10" fill="#EF9A9A" opacity=".45" />
      <ellipse cx="60" cy="98" rx="15" ry="17" fill="white" className="animate-err-blink" style={{ transformOrigin: '60px 98px' }} />
      <ellipse cx="100" cy="98" rx="15" ry="17" fill="white" className="animate-err-blink" style={{ transformOrigin: '100px 98px', animationDelay: '.1s' }} />
      <circle cx="60" cy="100" r="10" fill="#1B5E20" />
      <circle cx="100" cy="100" r="10" fill="#1B5E20" />
      <circle cx="54" cy="93" r="4.5" fill="white" />
      <circle cx="94" cy="93" r="4.5" fill="white" />
      <circle cx="62" cy="105" r="1.8" fill="white" opacity=".6" />
      <circle cx="102" cy="105" r="1.8" fill="white" opacity=".6" />
      <path d="M46 80 Q60 72 74 80" stroke="#2E7D32" strokeWidth="2.8" fill="none" strokeLinecap="round" />
      <path d="M86 80 Q100 72 114 80" stroke="#2E7D32" strokeWidth="2.8" fill="none" strokeLinecap="round" />
      <ellipse cx="80" cy="120" rx="7" ry="6" fill="#1B5E20" />
      <ellipse cx="80" cy="118" rx="7" ry="3.5" fill="#66BB6A" />
      <text x="14" y="70" fontSize="18" fill="#FDD835" className="animate-err-pop">✦</text>
      <text x="130" y="64" fontSize="13" fill="#FDD835" className="animate-err-pop" style={{ animationDelay: '.5s' }}>✦</text>
      <text x="18" y="108" fontSize="10" fill="#FDD835" opacity=".7" className="animate-err-pop" style={{ animationDelay: '1s' }}>✦</text>
      <text x="136" y="96" fontSize="9" fill="#FDD835" opacity=".6" className="animate-err-pop" style={{ animationDelay: '1.4s' }}>✦</text>
      <text x="124" y="94" fontSize="24" fontWeight="700" fill="#F57C00" className="animate-err-wiggle">?</text>
    </svg>
  )
}

export function TomatoMascot() {
  return (
    <svg width="160" height="180" viewBox="0 0 160 180" className="animate-err-shake" style={{ overflow: 'visible' }}>
      <ellipse cx="80" cy="172" rx="36" ry="7" fill="#e5e7eb" />
      <circle cx="80" cy="104" r="56" fill="#EF5350" />
      <ellipse cx="62" cy="76" rx="16" ry="11" fill="#EF9A9A" opacity=".3" />
      <path d="M58 52 Q64 32 74 48 Q80 30 86 48 Q96 32 102 52 Q88 44 80 56 Q72 44 58 52Z" fill="#43A047" />
      <line x1="80" y1="52" x2="80" y2="64" stroke="#388E3C" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="46" cy="116" rx="14" ry="10" fill="#FFCDD2" opacity=".5" />
      <ellipse cx="114" cy="116" rx="14" ry="10" fill="#FFCDD2" opacity=".5" />
      <circle cx="60" cy="98" r="15" fill="white" />
      <circle cx="100" cy="98" r="15" fill="white" />
      <g className="animate-err-spin-swirl" style={{ transformOrigin: '60px 98px' }}>
        <path d="M54 92 Q60 86 66 92 Q60 98 54 92" fill="none" stroke="#C62828" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="60" cy="98" r="4.5" fill="#C62828" />
      </g>
      <g className="animate-err-spin-swirl" style={{ transformOrigin: '100px 98px' }}>
        <path d="M94 92 Q100 86 106 92 Q100 98 94 92" fill="none" stroke="#C62828" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="100" cy="98" r="4.5" fill="#C62828" />
      </g>
      <circle cx="55" cy="92" r="3.5" fill="white" />
      <circle cx="95" cy="92" r="3.5" fill="white" />
      <text x="72" y="80" fontSize="15" fontWeight="700" fill="#B71C1C" opacity=".7">✕</text>
      <path d="M58 124 Q68 132 80 124 Q92 116 102 124" stroke="#B71C1C" strokeWidth="2.8" fill="none" strokeLinecap="round" />
      <text x="114" y="72" fontSize="20" fill="#FDD835" className="animate-err-pop">✸</text>
      <text x="18" y="80" fontSize="15" fill="#FDD835" className="animate-err-pop" style={{ animationDelay: '.3s' }}>✸</text>
      <text x="120" y="104" fontSize="11" fill="#FDD835" className="animate-err-pop" style={{ animationDelay: '.6s' }}>✸</text>
      <circle cx="22" cy="104" r="5" fill="#EF5350" opacity=".6" className="animate-err-pop" style={{ animationDelay: '.4s' }} />
      <circle cx="138" cy="88" r="4" fill="#EF5350" opacity=".5" className="animate-err-pop" style={{ animationDelay: '.7s' }} />
    </svg>
  )
}

export function LemonMascot() {
  return (
    <svg width="160" height="190" viewBox="0 0 160 190" className="animate-err-wiggle" style={{ overflow: 'visible', animationDuration: '3.5s' }}>
      <ellipse cx="80" cy="182" rx="36" ry="7" fill="#e5e7eb" />
      <ellipse cx="80" cy="112" rx="50" ry="52" fill="#FDD835" />
      <ellipse cx="62" cy="84" rx="13" ry="9" fill="#FFF176" opacity=".5" />
      <ellipse cx="32" cy="110" rx="13" ry="9" fill="#FFEE58" transform="rotate(-20 32 110)" />
      <ellipse cx="128" cy="114" rx="13" ry="9" fill="#FFEE58" transform="rotate(20 128 114)" />
      <path d="M36 88 Q50 22 80 16 Q110 22 124 88 Z" fill="#5C6BC0" />
      <rect x="30" y="83" width="100" height="14" rx="7" fill="#7986CB" />
      <circle cx="80" cy="14" r="8" fill="#EF5350" />
      <circle cx="77" cy="11" r="2.5" fill="#FFCDD2" opacity=".7" />
      <ellipse cx="44" cy="122" rx="14" ry="10" fill="#FFCA28" opacity=".45" />
      <ellipse cx="116" cy="122" rx="14" ry="10" fill="#FFCA28" opacity=".45" />
      <path d="M54 106 Q64 98 74 106" stroke="#F9A825" strokeWidth="3.2" fill="none" strokeLinecap="round" />
      <path d="M86 106 Q96 98 106 106" stroke="#F9A825" strokeWidth="3.2" fill="none" strokeLinecap="round" />
      <line x1="56" y1="106" x2="53" y2="111" stroke="#F9A825" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="63" y1="102" x2="62" y2="107" stroke="#F9A825" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="71" y1="106" x2="73" y2="111" stroke="#F9A825" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="88" y1="106" x2="85" y2="111" stroke="#F9A825" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="96" y1="102" x2="95" y2="107" stroke="#F9A825" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="104" y1="106" x2="106" y2="111" stroke="#F9A825" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M60 130 Q80 140 100 130" stroke="#F9A825" strokeWidth="2.8" fill="none" strokeLinecap="round" />
      <text x="118" y="76" fontSize="22" fontWeight="700" fill="#5C6BC0" className="animate-err-zzz">z</text>
      <text x="130" y="56" fontSize="17" fontWeight="700" fill="#5C6BC0" className="animate-err-zzz" style={{ animationDelay: '.7s', opacity: 0 }}>z</text>
      <text x="140" y="38" fontSize="12" fontWeight="700" fill="#5C6BC0" className="animate-err-zzz" style={{ animationDelay: '1.4s', opacity: 0 }}>z</text>
      <text x="14" y="74" fontSize="18" fill="#FDD835" opacity=".8">☽</text>
      <text x="22" y="50" fontSize="10" fill="#FDD835" opacity=".6">✦</text>
      <text x="10" y="100" fontSize="8" fill="#FDD835" opacity=".4">✦</text>
    </svg>
  )
}

export function AvocadoMascot() {
  return (
    <svg width="160" height="210" viewBox="0 0 160 210" className="animate-err-float" style={{ overflow: 'visible' }}>
      <ellipse cx="80" cy="202" rx="36" ry="7" fill="#e5e7eb" />
      <circle cx="56" cy="40" r="18" fill="#90A4AE" />
      <circle cx="74" cy="30" r="23" fill="#90A4AE" />
      <circle cx="96" cy="34" r="20" fill="#90A4AE" />
      <circle cx="112" cy="44" r="15" fill="#90A4AE" />
      <rect x="42" y="44" width="78" height="20" fill="#90A4AE" />
      <g transform="translate(60,20)" className="animate-err-shake">
        <circle cx="20" cy="20" r="15" fill="#FFEBEE" />
        <path d="M8 14 Q20 6 32 14" stroke="#E53935" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <path d="M12 18 Q20 12 28 18" stroke="#E53935" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <circle cx="20" cy="23" r="2.5" fill="#E53935" />
        <line x1="10" y1="8" x2="30" y2="28" stroke="#E53935" strokeWidth="2" strokeLinecap="round" />
      </g>
      <ellipse cx="56" cy="76" rx="3" ry="6" fill="#64B5F6" opacity=".8" className="animate-err-drop" />
      <ellipse cx="72" cy="70" rx="3" ry="6" fill="#64B5F6" opacity=".8" className="animate-err-drop" style={{ animationDelay: '.2s' }} />
      <ellipse cx="88" cy="78" rx="3" ry="6" fill="#64B5F6" opacity=".8" className="animate-err-drop" style={{ animationDelay: '.4s' }} />
      <ellipse cx="104" cy="70" rx="3" ry="6" fill="#64B5F6" opacity=".8" className="animate-err-drop" style={{ animationDelay: '.6s' }} />
      <path d="M80 84 Q116 84 120 128 Q120 172 80 184 Q40 172 40 128 Q40 84 80 84Z" fill="#558B2F" />
      <path d="M80 96 Q108 96 110 130 Q110 162 80 172 Q50 162 50 130 Q50 96 80 96Z" fill="#CDDC39" />
      <circle cx="80" cy="138" r="20" fill="#8D6E63" />
      <ellipse cx="74" cy="130" rx="6" ry="8" fill="#A1887F" opacity=".35" />
      <path d="M58 114 Q66 108 74 114" stroke="#33691E" strokeWidth="2.8" fill="none" strokeLinecap="round" />
      <path d="M86 114 Q94 108 102 114" stroke="#33691E" strokeWidth="2.8" fill="none" strokeLinecap="round" />
      <ellipse cx="66" cy="118" rx="3" ry="4" fill="#33691E" />
      <ellipse cx="94" cy="118" rx="3" ry="4" fill="#33691E" />
      <ellipse cx="48" cy="122" rx="12" ry="9" fill="#CE93D8" opacity=".35" />
      <ellipse cx="112" cy="122" rx="12" ry="9" fill="#CE93D8" opacity=".35" />
      <path d="M62 152 Q80 144 98 152" stroke="#33691E" strokeWidth="2.8" fill="none" strokeLinecap="round" />
      <ellipse cx="52" cy="126" rx="3.5" ry="6" fill="#64B5F6" className="animate-err-drop" style={{ animationDuration: '2s' }} />
      <ellipse cx="108" cy="126" rx="3.5" ry="6" fill="#64B5F6" className="animate-err-drop" style={{ animationDuration: '2s', animationDelay: '.6s' }} />
    </svg>
  )
}

export function OrangeMascot() {
  return (
    <svg width="160" height="180" viewBox="0 0 160 180" className="animate-err-wiggle" style={{ overflow: 'visible', animationDuration: '1.8s' }}>
      <ellipse cx="80" cy="172" rx="36" ry="7" fill="#e5e7eb" />
      <circle cx="80" cy="104" r="54" fill="#FB8C00" />
      <circle cx="60" cy="88" r="3" fill="#F57C00" opacity=".3" />
      <circle cx="96" cy="94" r="2.5" fill="#F57C00" opacity=".28" />
      <circle cx="70" cy="78" r="2.5" fill="#F57C00" opacity=".28" />
      <ellipse cx="62" cy="80" rx="14" ry="9" fill="#FFCC80" opacity=".3" />
      <path d="M70 50 Q76 34 82 50 Q76 44 70 50Z" fill="#43A047" />
      <line x1="76" y1="50" x2="76" y2="60" stroke="#388E3C" strokeWidth="2.5" strokeLinecap="round" />
      <ellipse cx="44" cy="114" rx="15" ry="10" fill="#FFCA28" opacity=".38" />
      <ellipse cx="116" cy="114" rx="15" ry="10" fill="#FFCA28" opacity=".38" />
      <ellipse cx="60" cy="98" rx="14" ry="15" fill="white" />
      <ellipse cx="100" cy="98" rx="14" ry="15" fill="white" />
      <path d="M46 91 Q60 84 74 91 L74 98 Q60 91 46 98Z" fill="#FB8C00" />
      <path d="M86 91 Q100 84 114 91 L114 98 Q100 91 86 98Z" fill="#FB8C00" />
      <circle cx="60" cy="104" r="8" fill="#E65100" />
      <circle cx="100" cy="104" r="8" fill="#E65100" />
      <circle cx="56" cy="100" r="3" fill="white" />
      <circle cx="96" cy="100" r="3" fill="white" />
      <path d="M58 126 Q80 138 102 126" stroke="#E65100" strokeWidth="2.8" fill="none" strokeLinecap="round" />
      <ellipse cx="22" cy="88" rx="5" ry="8" fill="#64B5F6" opacity=".88" className="animate-err-drop" />
      <ellipse cx="138" cy="82" rx="4" ry="7" fill="#64B5F6" opacity=".82" className="animate-err-drop" style={{ animationDelay: '.4s' }} />
      <ellipse cx="28" cy="112" rx="3" ry="5" fill="#64B5F6" opacity=".65" className="animate-err-drop" style={{ animationDelay: '.8s' }} />
      <ellipse cx="132" cy="108" rx="3" ry="5" fill="#64B5F6" opacity=".6" className="animate-err-drop" style={{ animationDelay: '1.1s' }} />
      <text x="114" y="64" fontSize="16" className="animate-err-pop" style={{ animationDuration: '1s' }}>💦</text>
    </svg>
  )
}

export function CarrotMascot() {
  return (
    <svg width="160" height="200" viewBox="0 0 160 200" className="animate-err-bounce" style={{ overflow: 'visible' }}>
      <ellipse cx="80" cy="192" rx="36" ry="7" fill="#e5e7eb" />
      <path d="M36 66 Q80 58 124 66 L104 170 Q80 182 56 170 Z" fill="#FF7043" />
      <path d="M46 86 Q80 80 114 86" stroke="#F4511E" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity=".5" />
      <path d="M44 106 Q80 100 116 106" stroke="#F4511E" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity=".5" />
      <path d="M46 126 Q80 120 114 126" stroke="#F4511E" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity=".45" />
      <ellipse cx="58" cy="82" rx="13" ry="9" fill="#FFAB91" opacity=".3" />
      <path d="M56 66 Q40 38 50 20 Q62 44 64 64" fill="#43A047" />
      <path d="M72 62 Q70 30 80 16 Q90 30 88 62" fill="#66BB6A" />
      <path d="M96 64 Q106 38 110 20 Q118 44 104 66" fill="#43A047" />
      <path d="M64 64 Q54 36 62 18 Q70 40 70 64" fill="#81C784" />
      <path d="M90 64 Q102 36 96 18 Q88 40 88 64" fill="#81C784" />
      <ellipse cx="46" cy="104" rx="15" ry="10" fill="#FFAB91" opacity=".45" />
      <ellipse cx="114" cy="104" rx="15" ry="10" fill="#FFAB91" opacity=".45" />
      <path d="M46 90 Q52 82 58 90 Q64 82 70 90 Q64 100 58 106 Q52 100 46 90Z" fill="#E53935" />
      <path d="M90 90 Q96 82 102 90 Q108 82 114 90 Q108 100 102 106 Q96 100 90 90Z" fill="#E53935" />
      <circle cx="53" cy="91" r="2.5" fill="white" opacity=".75" />
      <circle cx="97" cy="91" r="2.5" fill="white" opacity=".75" />
      <path d="M52 132 Q80 146 108 132" stroke="#BF360C" strokeWidth="2.8" fill="none" strokeLinecap="round" />
      <path d="M81 144 Q86 152 81 162 Q76 152 81 144Z" fill="#FF7043" opacity=".65" className="animate-err-drop" style={{ animationDuration: '2.2s' }} />
      <text x="16" y="86" fontSize="15" fill="#FDD835" className="animate-err-pop" />
      <text x="130" y="80" fontSize="11" fill="#FDD835" className="animate-err-pop" style={{ animationDelay: '.6s' }}>✦</text>
      <text x="20" y="112" fontSize="9" fill="#FDD835" opacity=".6" className="animate-err-pop" style={{ animationDelay: '1.2s' }}>✦</text>
    </svg>
  )
}

// ── Wrapper layout (badge + title + subtitle + action buttons) ──

type ButtonVariant = 'primary' | 'orange' | 'violet' | 'secondary'

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'bg-[#2E7D32] text-white hover:opacity-85',
  orange: 'bg-[#F57C00] text-white hover:opacity-85',
  violet: 'bg-[#7986CB] text-white hover:opacity-85',
  secondary: 'bg-gray-100 text-gray-700 hover:opacity-85',
}

interface ErrorScreenAction {
  label: string
  onClick?: () => void
  variant: ButtonVariant
}

interface ErrorScreenProps {
  mascot: React.ReactNode
  badgeText: string
  badgeBg: string
  badgeColor: string
  title: string
  subtitle: string
  actions: ErrorScreenAction[]
  fullScreen?: boolean
}

export function ErrorScreen({ mascot, badgeText, badgeBg, badgeColor, title, subtitle, actions, fullScreen = true }: ErrorScreenProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center gap-0 p-8 ${fullScreen ? 'min-h-screen' : 'min-h-100'} bg-background`}>
      <div className="mb-5">{mascot}</div>
      <span
        className="text-[11px] font-medium tracking-wide px-3.5 py-1 rounded-full mb-4 inline-block"
        style={{ background: badgeBg, color: badgeColor }}
      >
        {badgeText}
      </span>
      <p className="text-lg font-semibold text-foreground mb-2.5">{title}</p>
      <p className="text-sm text-muted-foreground leading-relaxed max-w-65 mb-7">{subtitle}</p>
      <div className="flex gap-3 justify-center flex-wrap">
        {actions.map((a) => (
          <button
            key={a.label}
            onClick={a.onClick}
            className={`inline-flex items-center gap-1.5 px-5.5 h-10.5 rounded-full text-sm font-medium transition-opacity ${VARIANT_CLASS[a.variant]}`}
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  )
}
