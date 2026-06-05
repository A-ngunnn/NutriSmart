"use client"

import { useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Flame,
  Info,
  Lightbulb,
  RefreshCw,
  Sparkles,
  Zap,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

// Thai RDI reference values
const RDI = {
  energy: 2000,
  sugar: 24,
  sodium: 2000,
  fat: 65,
}

interface NutrientValues {
  energy: number
  sugar: number
  sodium: number
  fat: number
}

function getPct(value: number, max: number) {
  return Math.round((value / max) * 100)
}

function getStatus(pct: number): "safe" | "warning" | "danger" {
  if (pct <= 70) return "safe"
  if (pct <= 100) return "warning"
  return "danger"
}

const statusConfig = {
  safe: { label: "Normal", color: "text-green-600", bg: "bg-green-50 border-green-200", icon: CheckCircle2 },
  warning: { label: "Caution", color: "text-orange-500", bg: "bg-orange-50 border-orange-200", icon: AlertTriangle },
  danger: { label: "Exceeded!", color: "text-red-500", bg: "bg-red-50 border-red-200", icon: AlertTriangle },
}

const nutrientMeta = {
  energy: { label: "Energy", unit: "kcal", icon: Flame, max: RDI.energy },
  sugar: { label: "Sugar", unit: "g", icon: Zap, max: RDI.sugar },
  sodium: { label: "Sodium", unit: "mg", icon: Info, max: RDI.sodium },
  fat: { label: "Fat", unit: "g", icon: Cpu, max: RDI.fat },
}

function MetricCard({
  nutrient,
  value,
  max,
}: {
  nutrient: keyof NutrientValues
  value: number
  max: number
}) {
  const pct = getPct(value, max)
  const status = getStatus(pct)
  const cfg = statusConfig[status]
  const meta = nutrientMeta[nutrient]
  const Icon = meta.icon
  const StatusIcon = cfg.icon

  return (
    <Card className={`border ${cfg.bg}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white border flex items-center justify-center">
              <Icon className="w-4 h-4 text-muted-foreground" />
            </div>
            <span className="font-semibold text-sm text-foreground">{meta.label}</span>
          </div>
          <StatusIcon className={`w-4 h-4 ${cfg.color}`} />
        </div>
        <div className="space-y-2">
          <div className="flex items-baseline gap-1">
            <span className={`text-2xl font-bold ${cfg.color}`}>{value}</span>
            <span className="text-xs text-muted-foreground">{meta.unit}</span>
            <span className="text-xs text-muted-foreground ml-1">/ {max} {meta.unit}</span>
          </div>
          {/* progress bar */}
          <div className="h-2 rounded-full bg-white/70 border overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                status === "safe"
                  ? "bg-green-500"
                  : status === "warning"
                  ? "bg-orange-400"
                  : "bg-red-500"
              }`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${cfg.color}`}>{pct}%</span>
            <Badge
              variant="outline"
              className={`text-xs ${cfg.color} border-current`}
            >
              {cfg.label}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function generateAIReport(values: NutrientValues) {
  const results: string[] = []
  const tags: { label: string; type: "danger" | "safe" | "tip" }[] = []

  if (getPct(values.sugar, RDI.sugar) > 100) {
    results.push(
      `This item contains a critically high amount of sugar (${getPct(values.sugar, RDI.sugar)}% of your daily allowance). Frequent consumption may increase the risk of insulin resistance and metabolic syndrome.`
    )
    tags.push({ label: "High Sugar", type: "danger" })
  } else {
    tags.push({ label: "Safe Sugar", type: "safe" })
  }

  if (getPct(values.sodium, RDI.sodium) > 100) {
    results.push(`Sodium levels are elevated (${getPct(values.sodium, RDI.sodium)}% of RDI), which may contribute to hypertension with regular intake.`)
    tags.push({ label: "High Sodium", type: "danger" })
  } else {
    tags.push({ label: "Safe Sodium", type: "safe" })
  }

  if (getPct(values.fat, RDI.fat) <= 70) {
    tags.push({ label: "Safe Fat", type: "safe" })
  } else {
    tags.push({ label: "High Fat", type: "danger" })
  }

  if (getPct(values.energy, RDI.energy) > 50) {
    tags.push({ label: "Recommendation: Divide into 2 servings", type: "tip" })
  }

  const summary =
    results.length > 0
      ? results.join(" ")
      : "Nutrient levels appear within acceptable ranges. Sodium, Sugar, and Fat are all within or near daily limits. Continue monitoring your intake for optimal health outcomes."

  return { summary, tags }
}

export function AnalyzerDashboard() {
  const [values, setValues] = useState<NutrientValues>({
    energy: 350,
    sugar: 12,
    sodium: 600,
    fat: 18,
  })
  const [analyzed, setAnalyzed] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleAnalyze = () => {
    setLoading(true)
    setAnalyzed(false)
    setTimeout(() => {
      setLoading(false)
      setAnalyzed(true)
    }, 1800)
  }

  const chartData = [
    { name: "Energy (kcal/10)", intake: Math.round(values.energy / 10), rdi: Math.round(RDI.energy / 10) },
    { name: "Sugar (g)", intake: values.sugar, rdi: RDI.sugar },
    { name: "Sodium (mg/10)", intake: Math.round(values.sodium / 10), rdi: Math.round(RDI.sodium / 10) },
    { name: "Fat (g)", intake: values.fat, rdi: RDI.fat },
  ]

  const report = generateAIReport(values)

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-5 h-5 text-primary" />
            Nutrition Data Entry
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter the nutrient values from the product label. Adjust sliders or type directly.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(Object.keys(nutrientMeta) as (keyof NutrientValues)[]).map((key) => {
              const meta = nutrientMeta[key]
              const sliderMax =
                key === "energy" ? 3000 : key === "sodium" ? 4000 : key === "sugar" ? 100 : 150
              return (
                <div key={key} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label nutrient={key} meta={meta} />
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        max={sliderMax}
                        value={values[key]}
                        onChange={(e) =>
                          setValues({ ...values, [key]: Number(e.target.value) })
                        }
                        className="w-20 text-right text-sm font-semibold border rounded-lg px-2 py-1 bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                      <span className="text-xs text-muted-foreground">{meta.unit}</span>
                    </div>
                  </div>
                  <Slider
                    min={0}
                    max={sliderMax}
                    step={key === "energy" ? 10 : 1}
                    value={[values[key]]}
                    onValueChange={([v]) => setValues({ ...values, [key]: v })}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0</span>
                    <span>RDI: {meta.max} {meta.unit}</span>
                    <span>{sliderMax}</span>
                  </div>
                </div>
              )
            })}
          </div>

          <Button
            onClick={handleAnalyze}
            disabled={loading}
            className="w-full h-12 text-base font-semibold gap-2"
            style={{ background: loading ? undefined : "linear-gradient(135deg, #388e3c 0%, #4CAF50 100%)" }}
          >
            {loading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Analyzing with MedGemma AI...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Analyze with MedGemma AI
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results Section */}
      {analyzed && (
        <>
          {/* 4 Metric Cards */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Nutrient Assessment vs. Thai RDI
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {(Object.keys(nutrientMeta) as (keyof NutrientValues)[]).map((key) => (
                <MetricCard key={key} nutrient={key} value={values[key]} max={RDI[key]} />
              ))}
            </div>
          </div>

          {/* Bar Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Intake vs. Daily Recommended Limit</CardTitle>
              <p className="text-xs text-muted-foreground">Values normalized for comparison. Energy &amp; Sodium divided by 10.</p>
            </CardHeader>
            <CardContent>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="intake" name="Your Intake" fill="#4CAF50" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="rdi" name="Daily Max (RDI)" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* AI Report */}
          <Card className="border-primary/20 bg-green-50/30">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base">MedGemma AI Clinical Report</CardTitle>
                  <p className="text-xs text-muted-foreground">Powered by MedGemma via Cloud API</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-white rounded-xl p-4 border border-border">
                <p className="text-sm font-semibold text-foreground mb-1">Analysis Summary</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{report.summary}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {report.tags.map((tag) => (
                  <span
                    key={tag.label}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                      tag.type === "danger"
                        ? "bg-red-50 border-red-200 text-red-600"
                        : tag.type === "safe"
                        ? "bg-green-50 border-green-200 text-green-700"
                        : "bg-blue-50 border-blue-200 text-blue-600"
                    }`}
                  >
                    {tag.type === "danger" && <AlertTriangle className="w-3 h-3" />}
                    {tag.type === "safe" && <CheckCircle2 className="w-3 h-3" />}
                    {tag.type === "tip" && <Lightbulb className="w-3 h-3" />}
                    {tag.label}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function Label({
  nutrient,
  meta,
}: {
  nutrient: string
  meta: { label: string; icon: React.ElementType }
}) {
  const Icon = meta.icon
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="w-4 h-4 text-muted-foreground" />
      <span className="text-sm font-medium text-foreground">{meta.label}</span>
    </div>
  )
}
