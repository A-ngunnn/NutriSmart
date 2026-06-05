"use client"
import ProfilePage from "@/components/profile-page"
import { useAppStore } from "@/lib/store"

export default function ProfileRoute() {
  const { profile, userName, setProfile } = useAppStore()
  
  // Use userName as fallback if profile.name is empty (for backward compatibility)
  const initialProfile = {
    ...profile,
    name: profile.name || userName || ""
  }
  
  return <ProfilePage profile={initialProfile} onSave={setProfile} />
}
