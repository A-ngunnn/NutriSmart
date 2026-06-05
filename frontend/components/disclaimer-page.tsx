"use client"

import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Globe,
  Heart,
  Info,
  Shield,
  Wifi,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export function DisclaimerPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      {/* Medical Disclaimer */}
      <Card className="border-orange-200 bg-orange-50/40">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-3 text-base">
            <div className="w-9 h-9 rounded-xl bg-orange-100 border border-orange-200 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
            </div>
            Medical Disclaimer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-white rounded-xl border border-orange-100 p-4">
            <p className="text-sm text-foreground leading-relaxed">
              <span className="font-semibold">NutriSmart</span> is an AI screening tool based on the standard{" "}
              <span className="font-semibold text-orange-600">Thai Recommended Daily Intake (RDI)</span> guidelines for
              healthy individuals. It does <span className="font-semibold text-red-500">NOT</span> replace professional
              medical diagnosis or personalized dietary advice for individuals with chronic diseases, specific health
              conditions, or special nutritional requirements.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                icon: Heart,
                title: "Not a Medical Device",
                body: "NutriSmart is informational only. Always consult a qualified healthcare provider.",
              },
              {
                icon: Shield,
                title: "RDI Basis",
                body: "Analysis uses Thai FDA standard RDI values for average healthy adults aged 18–60.",
              },
              {
                icon: BookOpen,
                title: "Educational Purpose",
                body: "Results are intended to increase nutritional awareness, not diagnose or treat conditions.",
              },
              {
                icon: Globe,
                title: "General Population",
                body: "Recommended limits may vary for pregnant women, athletes, children, or elderly individuals.",
              },
            ].map((item) => {
              const Icon = item.icon
              return (
                <div key={item.title} className="flex gap-3 bg-white rounded-xl border border-orange-100 p-3">
                  <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="w-4 h-4 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{item.body}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* System Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-3 text-base">
            <div className="w-9 h-9 rounded-xl bg-green-50 border border-green-200 flex items-center justify-center">
              <Wifi className="w-5 h-5 text-primary" />
            </div>
            System Status &amp; API Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            {
              label: "AI Engine",
              value: "MedGemma via Cloud-based API",
              status: "online",
            },
            {
              label: "RDI Standard",
              value: "Thai FDA – Recommended Daily Intake 2024",
              status: "active",
            },
            {
              label: "Data Privacy",
              value: "All analysis runs server-side. No nutrition data is stored without consent.",
              status: "secure",
            },
            {
              label: "Last Updated",
              value: "June 2025 – Nutrient database & AI model",
              status: "current",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-start justify-between gap-4 py-3 border-b last:border-0"
            >
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.value}</p>
                </div>
              </div>
              <Badge
                variant="outline"
                className={`text-xs shrink-0 ${
                  item.status === "online" || item.status === "active" || item.status === "secure" || item.status === "current"
                    ? "border-green-200 text-green-700 bg-green-50"
                    : "border-muted text-muted-foreground"
                }`}
              >
                <CheckCircle2 className="w-3 h-3 mr-1" />
                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Thai RDI Reference */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Thai RDI Reference Values</CardTitle>
          <p className="text-sm text-muted-foreground">
            Benchmark values used by NutriSmart for all analyses (healthy adults, 2000 kcal diet).
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nutrient</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">RDI Value</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</th>
              </tr>
            </thead>
            <tbody>
              {[
                { nutrient: "Energy", value: "2,000 kcal", note: "Average adult daily energy requirement" },
                { nutrient: "Sugar (Total)", value: "24 g", note: "WHO recommends &lt;10% of total energy" },
                { nutrient: "Sodium", value: "2,000 mg", note: "Equivalent to ~5 g table salt per day" },
                { nutrient: "Total Fat", value: "65 g", note: "~30% of total daily energy from fat" },
                { nutrient: "Saturated Fat", value: "20 g", note: "Should be &lt;10% of total energy" },
                { nutrient: "Dietary Fibre", value: "25 g", note: "Minimum daily fibre for gut health" },
              ].map((row, i) => (
                <tr key={row.nutrient} className={`border-b hover:bg-muted/30 ${i % 2 !== 0 ? "bg-muted/10" : ""}`}>
                  <td className="px-4 py-3 font-medium">{row.nutrient}</td>
                  <td className="px-4 py-3 text-right font-semibold text-primary">{row.value}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground"
                    dangerouslySetInnerHTML={{ __html: row.note }}
                  />
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Footer note */}
      <div className="text-center text-xs text-muted-foreground pb-4">
        &copy; 2025 NutriSmart. Built for educational and informational purposes only.
        Not affiliated with the Thai Food and Drug Administration (Thai FDA).
      </div>
    </div>
  )
}
