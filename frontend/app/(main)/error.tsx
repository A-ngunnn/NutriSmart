"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log ข้อผิดพลาดเพื่อให้ทีมพัฒนาตรวจสอบได้
    console.error("[NutriSmart] Unhandled runtime error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8 text-center bg-background">
      <div className="flex flex-col items-center gap-4 max-w-md">
        <div className="text-6xl animate-bounce">⚠️</div>
        <h2 className="text-2xl font-bold text-foreground tracking-tight">
          เกิดข้อผิดพลาดบางอย่าง
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {error.message
            ? error.message
            : "ระบบเกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่หรือรีเฟรชหน้าจอ"}
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground/60 font-mono">
            Error ID: {error.digest}
          </p>
        )}
        <div className="flex gap-3 mt-2">
          <button
            onClick={reset}
            className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium
                       hover:opacity-90 active:scale-95 transition-all duration-150 shadow-md"
          >
            🔄 ลองใหม่อีกครั้ง
          </button>
          <button
            onClick={() => (window.location.href = "/dashboard")}
            className="px-6 py-2.5 rounded-xl border border-border text-sm font-medium
                       hover:bg-accent active:scale-95 transition-all duration-150"
          >
            🏠 กลับหน้าหลัก
          </button>
        </div>
      </div>
    </div>
  );
}
