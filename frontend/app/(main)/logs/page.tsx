"use client"
import FoodLogPage from "@/components/food-log-page"
import { useAppStore } from "@/lib/store"

function calcTDEE(weight: number, height: number, age: number, gender: string, activityLevel: string, goal: string): number {
  if (!weight || !height || !age) return 0
  const bmr = gender === "female"
    ? 10 * weight + 6.25 * height - 5 * age - 161
    : 10 * weight + 6.25 * height - 5 * age + 5
  const factors: Record<string, number> = {
    sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9,
  }
  let tdee = bmr * (factors[activityLevel] ?? 1.2)
  if (goal === "lose") tdee -= 500
  if (goal === "gain") tdee += 500
  return Math.round(tdee)
}

export default function LogsRoute() {
  const { profile } = useAppStore()
  
  const tdee = calcTDEE(
    parseFloat(profile.weight),
    parseFloat(profile.height),
    parseFloat(profile.age),
    profile.gender,
    profile.activityLevel,
    profile.goal,
  )

  return <FoodLogPage tdee={tdee || 2000} />
}
