'use client'

import { NutriSmartWordmark } from './nutrismart-wordmark'

interface LoadingScreenProps {
  label?: string
}

const VEGGIES = ['🥦', '🍊', '🍅', '🥕', '🍋']

export default function LoadingScreen({ label = 'Smart Choices, Better You' }: LoadingScreenProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white select-none animate-fade-in">
      <div className="flex flex-col items-center justify-center gap-4 px-8 py-12">

        {/* ผักผลไม้ลอยดึ๋งๆ */}
        <div className="flex items-center gap-2.5">
          {VEGGIES.map((emoji, i) => (
            <span
              key={emoji}
              className="block text-3xl animate-float-veg"
              style={{ animationDelay: `${i * 0.3}s` }}
            >
              {emoji}
            </span>
          ))}
        </div>

        <NutriSmartWordmark className="text-4xl tracking-tight" />

        {/* สปินเนอร์สองสี เขียว/ส้ม ตามแบรนด์ */}
        <div className="w-11 h-11 my-1 rounded-full border-[3.5px] border-[#E8F5E9] border-t-[#2E7D32] border-r-[#F57C00] animate-spin-duo" />

        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#9E9E9E]">
          {label}
        </p>
      </div>
    </div>
  )
}
