"use client"
import { useMemo } from "react"
import ProfileTab, { type ProfileInternal } from "@/components/profile-page"
import { useAppStore, type ProfileData } from "@/lib/store"

const ACTIVITY_TO_DAYS: Record<string, number> = {
  sedentary: 0, light: 2, moderate: 4, active: 6, very_active: 7,
}
const DAYS_TO_ACTIVITY: Record<number, string> = {
  0: 'sedentary', 2: 'light', 4: 'moderate', 6: 'active', 7: 'very_active',
}
const GOAL_TO_THAI: Record<string, string> = {
  lose: 'ลดน้ำหนัก', maintain: 'รักษาน้ำหนัก', gain: 'เพิ่มน้ำหนัก', muscle: 'เพิ่มกล้ามเนื้อ',
}
const THAI_TO_GOAL: Record<string, string> = {
  'ลดน้ำหนัก': 'lose', 'รักษาน้ำหนัก': 'maintain',
  'เพิ่มน้ำหนัก': 'gain', 'เพิ่มกล้ามเนื้อ': 'muscle',
}

export default function ProfileRoute() {
  const { profile, userName, setProfile, setAvatarUrl } = useAppStore()

  const fullName = profile.name || userName || ''
  const spaceIdx = fullName.indexOf(' ')
  const firstName = spaceIdx === -1 ? fullName : fullName.slice(0, spaceIdx)
  const lastName  = spaceIdx === -1 ? ''       : fullName.slice(spaceIdx + 1)

  const initialData = useMemo<Partial<ProfileInternal>>(() => ({
    firstName,
    lastName,
    age:          parseFloat(profile.age)    || 28,
    gender:       profile.gender === 'female' ? 'หญิง' : 'ชาย',
    weight:       parseFloat(profile.weight) || 65,
    height:       parseFloat(profile.height) || 170,
    goal:         GOAL_TO_THAI[profile.goal] ?? 'รักษาน้ำหนัก',
    activityDays: ACTIVITY_TO_DAYS[profile.activityLevel] ?? 4,
    avatarUrl:    profile.avatarUrl ?? '',
    email:        profile.email ?? '',
  }), [firstName, lastName, profile.age, profile.gender, profile.weight, profile.height, profile.goal, profile.activityLevel, profile.avatarUrl, profile.email])

  const handleSave = (data: ProfileInternal): void => {
    const updated: ProfileData = {
      name:          [data.firstName, data.lastName].filter(Boolean).join(' '),
      email:         data.email ?? profile.email ?? '',
      avatarUrl:     data.avatarUrl ?? profile.avatarUrl ?? '',
      age:           String(data.age),
      gender:        data.gender === 'หญิง' ? 'female' : 'male',
      weight:        String(data.weight),
      height:        String(data.height),
      goal:          THAI_TO_GOAL[data.goal]          ?? 'maintain',
      activityLevel: DAYS_TO_ACTIVITY[data.activityDays] ?? 'moderate',
    }
    setProfile(updated)
  }

  const handleAvatarChange = (newUrl: string): void => {
    setAvatarUrl(newUrl)
  }

  return <ProfileTab initialData={initialData} onSave={handleSave} onAvatarChange={handleAvatarChange} />
}
