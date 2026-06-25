const FRUITS = ['🍎', '🍊', '🍓', '🥦', '🍌']

interface LoadingFruitsProps {
  label?: string
  size?: 'sm' | 'md'
  /** ใช้บนพื้นหลังสีเข้ม (เช่น overlay บนรูปภาพ) — เปลี่ยนสีตัวหนังสือเป็นขาว */
  dark?: boolean
}

export function LoadingFruits({ label, size = 'md', dark = false }: LoadingFruitsProps) {
  const emojiSize = size === 'sm' ? 'text-xl' : 'text-3xl'
  const gap = size === 'sm' ? 'gap-1.5' : 'gap-2.5'
  const bounceClass = size === 'sm' ? 'animate-bounce-cute-sm' : 'animate-bounce-cute'

  return (
    <div className={`flex flex-col items-center justify-center ${size === 'sm' ? 'gap-2' : 'gap-4'}`}>
      <div className={`flex items-end ${gap}`}>
        {FRUITS.map((emoji, i) => (
          <span
            key={i}
            className={`${emojiSize} inline-block ${bounceClass} select-none`}
            style={{ animationDelay: `${i * 0.12}s` }}
          >
            {emoji}
          </span>
        ))}
      </div>
      {label && (
        <p className={`text-sm font-medium ${dark ? 'text-white/90' : 'text-muted-foreground'}`}>{label}</p>
      )}
    </div>
  )
}
