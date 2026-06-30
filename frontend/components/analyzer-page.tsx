"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Camera, ScanLine, AlertTriangle, CheckCircle, XCircle, Info, X, SwitchCamera, Upload, ImagePlus, PencilLine, Sparkles as SparklesIcon, History, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { analyzeImageWithBackend, analyzeManualWithBackend } from "@/lib/backend-api"
import { createClient } from "@/lib/supabase/client"
import AnalyzingSpinner from "@/components/ui/analyzing-spinner"
// ─── Types ────────────────────────────────────────────────────────────────────

interface NutritionData {
  productName: string
  calories: number
  protein: number
  carbs: number
  totalFat: number
  sugar: number
  sodium: number
}

interface AnalysisResult {
  score: number
  sugarLevel: "safe" | "moderate" | "danger"
  sodiumLevel: "safe" | "moderate" | "danger"
  calorieLevel: "safe" | "moderate" | "danger"
  summary: string
  warnings: string[]
  tips: string[]
}

// ─── Analysis Logic ───────────────────────────────────────────────────────────

const EMPTY: NutritionData = { productName: "", calories: 0, protein: 0, carbs: 0, totalFat: 0, sugar: 0, sodium: 0 }

function classifyLevel(value: number, mod: number, danger: number): "safe" | "moderate" | "danger" {
  if (value >= danger) return "danger"
  if (value >= mod) return "moderate"
  return "safe"
}

function mapBackendResult(data: { score: number; status: string; warnings: string[]; advice: string }, nutrition: NutritionData): AnalysisResult {
  const sugarLevel = classifyLevel(nutrition.sugar, 8, 15)
  const sodiumLevel = classifyLevel(nutrition.sodium, 500, 900)
  const calorieLevel = classifyLevel(nutrition.calories, 300, 600)
  const summary = data.status === "safe"
    ? "ผลิตภัณฑ์ปลอดภัย"
    : data.status === "moderate"
      ? "ควรบริโภคในปริมาณพอดี"
      : "ควรหลีกเลี่ยงหรือบริโภคน้อยมาก"

  return {
    score: data.score,
    sugarLevel,
    sodiumLevel,
    calorieLevel,
    summary,
    warnings: data.warnings || [],
    tips: data.advice ? [data.advice] : [summary],
  }
}

const LEVEL_CONFIG = {
  safe:     { label: "ปลอดภัย",         color: "text-primary",     bg: "bg-[--nutri-green-light]",  icon: CheckCircle },
  moderate: { label: "ควรระวัง",         color: "text-secondary",   bg: "bg-[--nutri-orange-light]", icon: AlertTriangle },
  danger:   { label: "ควรหลีกเลี่ยง",   color: "text-destructive", bg: "bg-[--nutri-red-light]",    icon: XCircle },
}

// ─── Mock data removed — now using real AI via /api/analyze-image ────────────

// ─── Camera Scanner Component ─────────────────────────────────────────────────

function CameraScanner({
  onCapture,
  onClose,
}: {
  onCapture: (imageDataUrl: string) => void
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment")
  const [cameraReady, setCameraReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startCamera = useCallback(async (facing: "environment" | "user") => {
    // Stop existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
    }
    setCameraReady(false)
    setError(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play()
          setCameraReady(true)
        }
      }
    } catch (err) {
      console.error("Camera error:", err)
      setError("ไม่สามารถเข้าถึงกล้องได้ กรุณาอนุญาตการเข้าถึงกล้องในเบราว์เซอร์")
    }
  }, [])

  useEffect(() => {
    startCamera(facingMode)
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSwitchCamera = () => {
    const newFacing = facingMode === "environment" ? "user" : "environment"
    setFacingMode(newFacing)
    startCamera(newFacing)
  }

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85)
    onCapture(dataUrl)
  }

  return (
    <div className="fixed inset-0 z-100 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur-sm z-10">
        <button onClick={onClose} className="text-white p-2 -m-2">
          <X className="w-6 h-6" />
        </button>
        <span className="text-white font-semibold text-sm">สแกนฉลากโภชนาการ</span>
        <button onClick={handleSwitchCamera} className="text-white p-2 -m-2">
          <SwitchCamera className="w-5 h-5" />
        </button>
      </div>

      {/* Video feed */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        {error ? (
          <div className="text-center p-8">
            <Camera className="w-16 h-16 text-white/30 mx-auto mb-4" />
            <p className="text-white/70 text-sm max-w-xs">{error}</p>
            <button
              onClick={() => startCamera(facingMode)}
              className="mt-4 px-6 py-2 bg-white/20 text-white rounded-full text-sm"
            >
              ลองอีกครั้ง
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
            />

            {/* Scan guide overlay */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Dark edges */}
              <div className="absolute inset-0 bg-black/40" />
              {/* Clear center window */}
              <div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{
                  width: "min(85vw, 340px)",
                  height: "min(55vw, 220px)",
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.4)",
                  borderRadius: 16,
                }}
              >
                {/* Corner brackets */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-3 border-l-3 border-white rounded-tl-xl" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-3 border-r-3 border-white rounded-tr-xl" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-3 border-l-3 border-white rounded-bl-xl" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-3 border-r-3 border-white rounded-br-xl" />

                {/* Scan line animation */}
                <div
                  className="absolute left-4 right-4 h-0.5 bg-linear-to-r from-transparent via-primary to-transparent animate-pulse"
                  style={{ top: "50%", opacity: 0.8 }}
                />
              </div>

              {/* Guide text */}
              <div className="absolute bottom-32 left-0 right-0 text-center">
                <p className="text-white/90 text-sm font-medium">
                  📋 วางฉลากโภชนาการให้อยู่ในกรอบ
                </p>
                <p className="text-white/60 text-xs mt-1">
                  ถ่ายรูปให้ชัด เพื่อผลการอ่านที่แม่นยำ
                </p>
              </div>
            </div>
          </>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Capture button */}
      <div className="flex items-center justify-center py-6 bg-black/80 backdrop-blur-sm">
        <button
          onClick={handleCapture}
          disabled={!cameraReady}
          className={cn(
            "w-18 h-18 rounded-full border-4 border-white flex items-center justify-center transition-all",
            cameraReady
              ? "bg-white/20 hover:bg-white/30 active:scale-90"
              : "bg-white/5 opacity-50 cursor-not-allowed"
          )}
          style={{ width: 72, height: 72 }}
        >
          <div className="w-14 h-14 rounded-full bg-white" style={{ width: 56, height: 56 }} />
        </button>
      </div>
    </div>
  )
}

// ─── Preview Captured Image ───────────────────────────────────────────────────

function CapturedPreview({
  imageUrl,
  scanning,
  onRetake,
  onConfirm,
}: {
  imageUrl: string
  scanning: boolean
  onRetake: () => void
  onConfirm: () => void
}) {
  return (
    <div className="space-y-3">
      {/* Image preview — สลับเป็นแผงสปินเนอร์เต็มพื้นที่ตอนกำลังวิเคราะห์ (รูปเดิมเล็กเกินจะใส่สปินเนอร์ซ้อนได้สวย) */}
      {scanning ? (
        <div className="rounded-xl border border-border bg-white py-6 flex items-center justify-center">
          <AnalyzingSpinner subtitle="AI กำลังวิเคราะห์ฉลากโภชนาการ" />
        </div>
      ) : (
        <div className="relative rounded-xl overflow-hidden border border-border">
          <img src={imageUrl} alt="ฉลากที่ถ่าย" className="w-full h-auto max-h-48 object-cover" />
        </div>
      )}

      {!scanning && (
        <div className="flex gap-2">
          <button
            onClick={onRetake}
            className="flex-1 h-10 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors flex items-center justify-center gap-2"
          >
            <Camera className="w-4 h-4" />
            ถ่ายใหม่
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 h-10 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <ScanLine className="w-4 h-4" />
            อ่านข้อมูล
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main AnalyzerPage ────────────────────────────────────────────────────────

import { useAppStore } from "@/lib/store"
import { useRouter } from "next/navigation"

const HOW_IT_WORKS = [
  { icon: ImagePlus, title: "ถ่ายรูปหรือเลือกฉลาก", desc: "ถ่ายรูปอาหารหรือฉลากโภชนาการ หรือกรอกข้อมูลด้วยตัวเอง" },
  { icon: SparklesIcon, title: "AI วิเคราะห์ให้ทันที", desc: "ระบบอ่านค่าพลังงาน น้ำตาล โซเดียม และประเมินคะแนนความปลอดภัย" },
  { icon: PencilLine, title: "ดูผลและบันทึกลงไดอารี่", desc: "ตรวจสอบคำเตือน/คำแนะนำ แล้วบันทึกผลลงประวัติได้ในคลิกเดียว" },
]

export default function AnalyzerPage() {
  const { addScanLocal, scanHistory } = useAppStore()
  const router = useRouter()
  const [form, setForm] = useState<NutritionData>(EMPTY)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // true เมื่อค่าในฟอร์มมาจากการสแกนรูป (ยังไม่ถูกแก้ไขมือ) — /api/analyze/image auto-save ไปแล้ว
  // รอบหนึ่งแล้ว ตอนกดวิเคราะห์จะส่ง save=false ไปที่ /manual กันไม่ให้ insert ซ้ำเป็นสแกนที่สอง
  const [cameFromOcr, setCameFromOcr] = useState(false)

  const set = (k: keyof NutritionData, v: string) => {
    setCameFromOcr(false)
    setForm((prev) => ({ ...prev, [k]: k === "productName" ? v : parseFloat(v) || 0 }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // ถ้าข้อมูลมาจากสแกนรูป (cameFromOcr) แปลว่า /api/analyze/image auto-save ไปแล้วรอบหนึ่ง
      // ขั้นนี้ส่ง save=false กันไม่ให้บันทึกซ้ำเป็นสแกนที่สองของรูปเดียวกัน
      const willSave = !cameFromOcr
      const data = await analyzeManualWithBackend({
        productName: form.productName,
        calories: form.calories,
        protein: form.protein,
        carbs: form.carbs,
        totalFat: form.totalFat,
        sugar: form.sugar,
        sodium: form.sodium,
      }, willSave)
      const mapped = mapBackendResult(data, form)
      setResult(mapped)

      // บันทึกไปแล้วโดย backend อัตโนมัติ (ทั้งสองกรณี — ที่นี่หรือที่ /image ไปก่อนแล้ว) — sync local
      // state ทันทีให้ "ประวัติการสแกน" โชว์ผลให้เห็นเลย ไม่ต้องรอผู้ใช้กดปุ่ม "บันทึก" ซ้ำอีกขั้น
      addScanLocal({
        productName: form.productName || "ไม่ระบุชื่อ",
        calories: form.calories,
        protein: form.protein,
        carbs: form.carbs,
        totalFat: form.totalFat,
        sugar: form.sugar,
        sodium: form.sodium,
        score: mapped.score,
        status: mapped.score >= 80 ? "safe" : mapped.score >= 50 ? "moderate" : "danger",
      })
      setCameFromOcr(false)
    } catch (err: any) {
      console.error(err)
      const isQuota = typeof err?.message === "string" && err.message.includes("โควตา")
      alert(isQuota ? err.message : "เกิดข้อผิดพลาดในการวิเคราะห์ กรุณาลองใหม่อีกครั้ง")
    } finally {
      setLoading(false)
    }
  }

  // Handle camera capture
  const handleCameraCapture = (imageDataUrl: string) => {
    setShowCamera(false)
    setCapturedImage(imageDataUrl)
  }

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setCapturedImage(ev.target?.result as string)
    }
    reader.readAsDataURL(file)
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  // Real AI OCR scanning using backend MedGemma + Thai RDI + RAG
  const handleOcrScan = async () => {
    if (!capturedImage) return
    setScanning(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const data = await analyzeImageWithBackend(capturedImage, session?.user?.id)
      setForm({
        productName: data.productName || "",
        calories: data.calories || 0,
        protein: data.protein || 0,
        carbs: data.carbs || 0,
        totalFat: data.totalFat || 0,
        sugar: data.sugar || 0,
        sodium: data.sodium || 0,
      })
      // ⚠️ นำค่ามาใส่ในฟอร์มเท่านั้น เพื่อให้ผู้ใช้ตรวจสอบความถูกต้องก่อนกดปุ่มวิเคราะห์เอง
      // /api/analyze/image auto-save สแกนนี้ไปแล้วในตัว — ตั้ง cameFromOcr ไว้กันไม่ให้ขั้นวิเคราะห์
      // ถัดไปบันทึกซ้ำเป็นสแกนที่สองของรูปเดียวกัน (ถ้าผู้ใช้แก้ไขค่าเอง flag นี้จะถูกล้างใน set())
      setCameFromOcr(true)
      setCapturedImage(null)
    } catch (err: any) {
      console.error(err)
      // โควตาสแกนรูปเต็ม (429) บอก error.detail จริงจาก backend ตรงๆ ไม่งั้นจะดูเหมือนแค่สแกนพัง
      // ทั้งที่จริงต้องรอวันถัดไปถึงจะสแกนได้ใหม่
      const isQuota = typeof err?.message === "string" && err.message.includes("โควตา")
      alert(isQuota ? err.message : "ไม่สามารถอ่านข้อมูลจากภาพได้ กรุณาลองใหม่")
    } finally {
      setScanning(false)
    }
  }

  const scoreColor = result
    ? result.score >= 80 ? "text-primary" : result.score >= 50 ? "text-secondary" : "text-destructive"
    : "text-foreground"

  return (
    <>
      {/* Camera fullscreen overlay */}
      {showCamera && (
        <CameraScanner
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
        />
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />

      <div className="p-4 space-y-4 lg:space-y-6 pb-24 max-w-2xl lg:max-w-6xl mx-auto">
        <div className="pt-2 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <Search size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">วิเคราะห์อาหารและฉลาก</h1>
            <p className="text-sm text-muted-foreground">AI สแกนและประเมินคุณค่าทางโภชนาการ</p>
          </div>
        </div>

        {/* Mobile: stacked. Desktop: side-by-side */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-6">
          {/* Form */}
          <div className="xl:col-span-1">
            <div className="bg-card rounded-3xl shadow-sm border border-border p-4 space-y-4">
              <h2 className="font-bold text-base text-foreground">กรอกข้อมูลสารอาหารจากบรรจุภัณฑ์</h2>

              {/* Camera / Upload buttons */}
              {!capturedImage ? (
                <div className="space-y-2">
                  <button
                    onClick={() => setShowCamera(true)}
                    className="w-full h-12 rounded-xl bg-primary text-white font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 active:scale-[0.98] transition-all text-sm"
                  >
                    <Camera className="w-4 h-4" />
                    ถ่ายรูปอาหาร หรือ สแกนฉลากโภชนาการ
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-10 rounded-xl border border-border text-muted-foreground font-medium flex items-center justify-center gap-2 hover:bg-muted/50 active:scale-[0.98] transition-all text-sm"
                  >
                    <Upload className="w-4 h-4" />
                    เลือกรูปจากคลัง
                  </button>
                </div>
              ) : (
                <CapturedPreview
                  imageUrl={capturedImage}
                  scanning={scanning}
                  onRetake={() => { setCapturedImage(null); setShowCamera(true) }}
                  onConfirm={handleOcrScan}
                />
              )}

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground font-medium">หรือ กรอกเอง</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">ชื่อผลิตภัณฑ์ / ชื่ออาหาร</Label>
                  <Input
                    placeholder="เช่น นมจืดพาสเจอร์ไรส์ ตราเด็กดี"
                    value={form.productName}
                    onChange={(e) => set("productName", e.target.value)}
                    className="h-11"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(
                    [
                      { key: "calories",  label: "พลังงาน (KCAL)" },
                      { key: "protein",   label: "โปรตีน (กรัม)" },
                      { key: "carbs",     label: "คาร์โบไฮเดรต (กรัม)" },
                      { key: "totalFat",  label: "ไขมันทั้งหมด (กรัม)" },
                      { key: "sugar",     label: "น้ำตาล (กรัม)" },
                      { key: "sodium",    label: "โซเดียม (มิลลิกรัม)" },
                    ] as { key: keyof NutritionData; label: string }[]
                  ).map(({ key, label }) => (
                    <div key={key} className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="any"
                        value={form[key] === 0 ? "" : String(form[key])}
                        onChange={(e) => set(key, e.target.value)}
                        className="h-11"
                      />
                    </div>
                  ))}
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 bg-primary hover:bg-primary/90 active:scale-[0.98] text-white font-semibold text-sm"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <ScanLine className="w-4 h-4 animate-pulse" />
                      กำลังวิเคราะห์...
                    </span>
                  ) : (
                    "เริ่มการวิเคราะห์ผลิตภัณฑ์"
                  )}
                </Button>
              </form>
            </div>
          </div>

          {/* Results — below form on mobile, right panel on desktop */}
          <div className="xl:col-span-2 space-y-4">
            <div className="bg-card rounded-3xl shadow-sm border border-border p-4 flex flex-col">
              {!result ? (
                /* Empty state — replaced bare placeholder with a real "how it works" guide */
                <div className="py-2">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-9 h-9 rounded-xl bg-green-50 text-primary flex items-center justify-center border border-green-100/50 shrink-0">
                      <ScanLine className="w-4 h-4" />
                    </div>
                    <p className="font-semibold text-sm text-foreground">วิเคราะห์ผลิตภัณฑ์เพื่อสุขภาพที่ดียิ่งขึ้น</p>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4 ml-11">ผลคะแนนความปลอดภัย คำเตือน และคำแนะนำจะแสดงที่นี่</p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {HOW_IT_WORKS.map((step, i) => {
                      const StepIcon = step.icon
                      return (
                        <div key={step.title} className="bg-muted/40 border border-border/60 rounded-2xl p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                            <StepIcon className="w-4 h-4 text-primary" />
                          </div>
                          <p className="text-xs font-semibold text-foreground mb-1">{step.title}</p>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">{step.desc}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Score */}
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-2xl bg-muted flex flex-col items-center justify-center shrink-0">
                      <span className={`text-3xl font-extrabold ${scoreColor}`}>{result.score}</span>
                      <span className="text-[10px] text-muted-foreground font-medium">/100</span>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">ผลการวิเคราะห์</p>
                      <p className={`text-xl font-extrabold ${scoreColor}`}>{result.summary}</p>
                      {form.productName && <p className="text-sm text-muted-foreground mt-1">{form.productName}</p>}
                    </div>
                  </div>

                  {/* Level indicators */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {(
                      [
                        { label: "น้ำตาล", level: result.sugarLevel, val: `${form.sugar}g` },
                        { label: "โซเดียม", level: result.sodiumLevel, val: `${form.sodium}mg` },
                        { label: "แคลอรี", level: result.calorieLevel, val: `${form.calories}kcal` },
                      ]
                    ).map(({ label, level, val }) => {
                      const cfg = LEVEL_CONFIG[level]
                      const Icon = cfg.icon
                      return (
                        <div key={label} className={cn("rounded-xl p-2 sm:p-3 flex flex-col gap-1 text-center sm:text-left items-center sm:items-start", cfg.bg)}>
                          <Icon className={cn("w-4 h-4", cfg.color)} />
                          <p className="text-[10px] sm:text-xs font-semibold text-foreground">{label}</p>
                          <p className="text-xs sm:text-sm font-bold text-foreground">{val}</p>
                          <p className={cn("text-[9px] sm:text-[10px] font-semibold", cfg.color)}>{cfg.label}</p>
                        </div>
                      )
                    })}
                  </div>

                  {/* Warnings */}
                  {result.warnings.length > 0 && (
                    <div className="bg-[--nutri-red-light] rounded-xl p-4 space-y-2">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="w-4 h-4 text-destructive" />
                        <p className="text-sm font-bold text-destructive">คำเตือน</p>
                      </div>
                      {result.warnings.map((w) => (
                        <p key={w} className="text-xs text-foreground flex gap-2">
                          <span className="text-destructive mt-0.5">•</span>
                          {w}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Tips */}
                  <div className="bg-[--nutri-green-light] rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                      <Info className="w-4 h-4 text-primary" />
                      <p className="text-sm font-bold text-primary">คำแนะนำ</p>
                    </div>
                    {result.tips.map((t) => (
                      <p key={t} className="text-xs text-foreground flex gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        {t}
                      </p>
                    ))}
                  </div>

                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    * การวิเคราะห์นี้อ้างอิงตามเกณฑ์ Thai RDI ของกระทรวงสาธารณสุข และไม่ใช่คำแนะนำทางการแพทย์
                  </p>

                  {/* บันทึกลงประวัติให้อัตโนมัติไปแล้วตอนวิเคราะห์ — ไม่ต้องกดอะไรเพิ่ม แค่บอกให้รู้ว่าบันทึกแล้ว */}
                  <div className="w-full h-11 rounded-xl bg-muted flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    บันทึกลงประวัติแล้ว
                  </div>
                </div>
              )}
            </div>

            {/* Recent scans — keeps the panel useful even before/after an analysis */}
            {scanHistory.length > 0 && (
              <div className="bg-card rounded-3xl shadow-sm border border-border p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-xl bg-blue-50 flex items-center justify-center">
                    <History size={14} className="text-blue-500" />
                  </span>
                  สแกนล่าสุด
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {scanHistory.slice(0, 4).map(scan => (
                    <div key={scan.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-muted/40 border border-border/50">
                      <p className="text-xs font-medium text-foreground truncate">{scan.productName}</p>
                      <span className="text-xs font-semibold text-primary tabular-nums shrink-0">{scan.calories} kcal</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
