'use client'

import { useEffect, useState } from 'react'
import { Star, Loader2, CheckCircle2 } from 'lucide-react'
import SettingsBackHeader from '@/components/settings-back-header'
import { fetchMyReview, submitReview } from '@/lib/backend-api'
import { useAppStore } from '@/lib/store'

export default function ReviewPage() {
  const { profile } = useAppStore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const [name, setName] = useState('')
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [showAvatar, setShowAvatar] = useState(false)

  useEffect(() => {
    fetchMyReview()
      .then((review) => {
        if (review) {
          setName(review.name)
          setRating(review.rating)
          setComment(review.comment)
          setShowAvatar(!!review.avatar_url)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (rating === 0) {
      setError('เลือกจำนวนดาวก่อนนะ')
      return
    }
    if (!name.trim() || !comment.trim()) {
      setError('กรอกชื่อและความคิดเห็นให้ครบ')
      return
    }
    setError(null)
    setSaving(true)
    try {
      await submitReview({
        name: name.trim(),
        rating,
        comment: comment.trim(),
        avatarUrl: showAvatar ? profile.avatarUrl : null,
      })
      setSaved(true)
    } catch (err: any) {
      setError(err.message || 'ส่งรีวิวไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 max-w-2xl lg:max-w-3xl mx-auto flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-5 lg:space-y-6 pb-24 max-w-2xl lg:max-w-3xl mx-auto">
      <SettingsBackHeader title="ให้คะแนนแอป" subtitle="ความเห็นของคุณช่วยให้คนอื่นรู้จัก NutriSmart มากขึ้น" />

      <div className="bg-card rounded-3xl shadow-sm border border-border p-5">
        {saved ? (
          <div className="text-center py-6">
            <CheckCircle2 className="w-12 h-12 text-primary mx-auto mb-3" />
            <p className="font-semibold text-foreground mb-1">ขอบคุณสำหรับรีวิวนะ! 🎉</p>
            <p className="text-sm text-muted-foreground">
              {rating >= 4
                ? 'รีวิวของคุณอาจถูกนำไปแสดงในหน้าแรกของเว็บไซต์'
                : 'เราจะนำความเห็นนี้ไปปรับปรุงแอปให้ดีขึ้นครับ'}
            </p>
            <button
              onClick={() => setSaved(false)}
              className="mt-4 text-sm text-primary font-medium hover:underline"
            >
              แก้ไขรีวิวของฉัน
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl font-medium">
                {error}
              </div>
            )}

            <div>
              <label className="text-xs text-muted-foreground mb-2 block">ให้คะแนนการใช้งาน</label>
              <div className="flex gap-1.5 justify-center py-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    aria-label={`${star} ดาว`}
                  >
                    <Star
                      size={32}
                      className={
                        star <= (hoverRating || rating)
                          ? 'fill-amber-400 text-amber-400'
                          : 'fill-muted text-muted'
                      }
                    />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">ชื่อที่จะแสดงคู่รีวิว</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น สมชาย จ. หรือชื่อเล่น"
                maxLength={50}
                className="w-full border border-input rounded-xl px-3 py-2.5 text-sm bg-background outline-none focus:border-primary/50"
              />
              <p className="text-[11px] text-muted-foreground mt-1">ไม่บังคับใช้ชื่อจริง เพื่อความเป็นส่วนตัวของคุณ</p>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">ความคิดเห็น</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="บอกเราหน่อยว่าแอปช่วยอะไรคุณได้บ้าง..."
                maxLength={500}
                rows={4}
                className="w-full border border-input rounded-xl px-3 py-2.5 text-sm bg-background outline-none focus:border-primary/50 resize-none"
              />
            </div>

            {profile.avatarUrl && (
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showAvatar}
                  onChange={(e) => setShowAvatar(e.target.checked)}
                  className="w-4 h-4 rounded accent-primary"
                />
                <span className="text-xs text-foreground">แสดงรูปโปรไฟล์ของฉันคู่กับรีวิวด้วย</span>
              </label>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> กำลังส่ง...
                </>
              ) : (
                'ส่งรีวิว'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
