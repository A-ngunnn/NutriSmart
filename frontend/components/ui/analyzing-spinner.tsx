'use client'

import { NutriSmartWordmark } from './nutrismart-wordmark'

interface AnalyzingSpinnerProps {
  title?: string
  subtitle?: string
}

const OUTER_DOTS_MAIN = [
  [92, 2], [120.5, 5.8], [146.5, 17.2], [166.5, 35.8], [178.8, 60], [182, 87],
  [176.5, 114], [163, 138.5], [143, 157.5], [118, 169.5], [91, 173], [64, 169.5],
  [39, 157.5], [19, 138.5], [5.5, 114], [0, 87], [3.2, 60], [15.5, 35.8],
  [35.5, 17.2], [61.5, 5.8],
]
const OUTER_DOTS_FAINT = [
  [106, 2.8], [133.5, 10.5], [157, 26], [173.5, 47], [181.5, 73.5], [180.5, 101],
  [170.5, 127], [152.5, 149], [130, 164], [104.5, 172], [77.5, 172], [52, 164],
  [29.5, 149], [11.5, 127], [1.5, 101], [0.5, 73.5], [8.5, 47], [25, 26],
  [48.5, 10.5], [76, 2.8],
]
const INNER_DOTS = [
  [76, 4], [104, 9.5], [128, 26], [144, 50], [148, 76], [143, 102], [128, 126],
  [104, 142.5], [76, 148], [48, 142.5], [24, 126], [9, 102], [4, 76], [8, 50],
  [24, 26], [48, 9.5],
]
const LEAF_POSITIONS: [number, number][] = [
  [90, 6], [136, 38], [147, 90], [118, 136], [62, 6], [16, 38], [6, 90], [32, 136],
]

export default function AnalyzingSpinner({
  title = 'กำลังวิเคราะห์โภชนาการ',
  subtitle = 'โปรดรอสักครู่…',
}: AnalyzingSpinnerProps) {
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative w-50 h-50 flex items-center justify-center">
        {/* วงแหวนทึบรอบนอก */}
        <div className="absolute inset-0 rounded-full border-[3px] border-[#2E7D32]" />

        {/* วงแหวนจุด หมุนตามเข็ม */}
        <div className="absolute inset-2 rounded-full animate-spin-cw">
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 184 184">
            <g fill="#2E7D32" opacity={0.9}>
              {OUTER_DOTS_MAIN.map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r={3} />)}
            </g>
            <g fill="#2E7D32" opacity={0.22}>
              {OUTER_DOTS_FAINT.map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r={2} />)}
            </g>
          </svg>
        </div>

        {/* วงแหวนใบไม้ หมุนทวนเข็ม */}
        <div className="absolute inset-6 rounded-full animate-spin-ccw">
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 152 152">
            <g fill="#81C784" opacity={0.55}>
              {INNER_DOTS.map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r={2.5} />)}
            </g>
            <g fontSize={11} textAnchor="middle" dominantBaseline="middle">
              {LEAF_POSITIONS.map(([x, y], i) => <text key={i} x={x} y={y}>🌿</text>)}
            </g>
          </svg>
        </div>

        {/* แกนกลาง: แครอท + ชิป AI + บรอกโคลี */}
        <div className="absolute flex items-center gap-2 animate-float-center">
          <svg width="36" height="48" viewBox="0 0 36 48" className="shrink-0 animate-float-center" style={{ animationDelay: '0.3s' }}>
            <path d="M8 14 Q18 12 28 14 L22 44 Q18 48 14 44 Z" fill="#FF7043" />
            <path d="M12 20 Q18 18 24 20" stroke="#F4511E" strokeWidth="1.2" fill="none" opacity={0.5} strokeLinecap="round" />
            <path d="M11 28 Q18 26 25 28" stroke="#F4511E" strokeWidth="1.2" fill="none" opacity={0.5} strokeLinecap="round" />
            <path d="M14 14 Q8 4 12 0 Q16 8 16 13" fill="#43A047" />
            <path d="M18 12 Q18 2 20 0 Q22 6 20 13" fill="#66BB6A" />
            <path d="M22 14 Q28 4 24 0 Q20 8 20 13" fill="#43A047" />
            <ellipse cx="13" cy="22" rx="2.5" ry="2" fill="#FFAB91" opacity={0.5} />
            <ellipse cx="23" cy="22" rx="2.5" ry="2" fill="#FFAB91" opacity={0.5} />
            <path d="M11 19 Q14 16 17 19" stroke="#BF360C" strokeWidth="1.2" fill="none" strokeLinecap="round" />
            <path d="M19 19 Q22 16 25 19" stroke="#BF360C" strokeWidth="1.2" fill="none" strokeLinecap="round" />
            <ellipse cx="12" cy="22" rx="2" ry="2.2" fill="#BF360C" />
            <ellipse cx="22" cy="22" rx="2" ry="2.2" fill="#BF360C" />
            <circle cx="11" cy="21" r="0.8" fill="white" />
            <circle cx="21" cy="21" r="0.8" fill="white" />
            <path d="M13 30 Q18 33 23 30" stroke="#BF360C" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          </svg>

          <div className="relative w-11 h-11 rounded-lg border-2 border-[#2E7D32] bg-white flex items-center justify-center animate-pulse-chip">
            {[
              { cls: 'w-1 h-1.5 -top-1.75', x: -8 }, { cls: 'w-1 h-1.5 -top-1.75', x: 4 },
              { cls: 'w-1 h-1.5 -bottom-1.75', x: -8 }, { cls: 'w-1 h-1.5 -bottom-1.75', x: 4 },
            ].map((p, i) => (
              <div key={i} className={`absolute bg-[#2E7D32] rounded-[1px] ${p.cls} left-1/2`} style={{ marginLeft: p.x }} />
            ))}
            {[
              { cls: 'w-1.5 h-1 -left-1.75', y: -8 }, { cls: 'w-1.5 h-1 -left-1.75', y: 4 },
              { cls: 'w-1.5 h-1 -right-1.75', y: -8 }, { cls: 'w-1.5 h-1 -right-1.75', y: 4 },
            ].map((p, i) => (
              <div key={i} className={`absolute bg-[#2E7D32] rounded-[1px] ${p.cls} top-1/2`} style={{ marginTop: p.y }} />
            ))}
            <span className="text-sm font-bold text-[#2E7D32] tracking-tight">AI</span>
          </div>

          <svg width="38" height="48" viewBox="0 0 38 48" className="shrink-0 animate-float-center" style={{ animationDelay: '0.7s' }}>
            <rect x="14" y="32" width="10" height="14" rx="5" fill="#2E7D32" />
            <ellipse cx="16" cy="36" rx="8" ry="6" fill="#388E3C" />
            <circle cx="19" cy="20" r="14" fill="#66BB6A" />
            <circle cx="9" cy="14" r="9" fill="#81C784" />
            <circle cx="19" cy="10" r="10" fill="#81C784" />
            <circle cx="29" cy="14" r="9" fill="#81C784" />
            <circle cx="13" cy="11" r="7" fill="#A5D6A7" />
            <circle cx="25" cy="11" r="7" fill="#A5D6A7" />
            <circle cx="19" cy="8" r="6" fill="#C8E6C9" />
            <ellipse cx="10" cy="24" rx="4" ry="3" fill="#EF9A9A" opacity={0.4} />
            <ellipse cx="28" cy="24" rx="4" ry="3" fill="#EF9A9A" opacity={0.4} />
            <ellipse cx="13" cy="22" rx="3.5" ry="4" fill="white" />
            <ellipse cx="25" cy="22" rx="3.5" ry="4" fill="white" />
            <circle cx="13" cy="23" r="2.2" fill="#1B5E20" />
            <circle cx="25" cy="23" r="2.2" fill="#1B5E20" />
            <circle cx="12" cy="21.5" r="0.9" fill="white" />
            <circle cx="24" cy="21.5" r="0.9" fill="white" />
            <path d="M14 30 Q19 33 24 30" stroke="#2E7D32" strokeWidth="1.4" fill="none" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      <div className="text-center">
        <NutriSmartWordmark className="text-base" />
        <p className="text-xs text-[#9E9E9E] mt-1 leading-relaxed">
          {title}<br />{subtitle}
        </p>
      </div>
    </div>
  )
}
