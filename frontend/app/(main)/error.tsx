"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TomatoMascot, ErrorScreen } from "@/components/ui/error-mascots";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // Log ข้อผิดพลาดเพื่อให้ทีมพัฒนาตรวจสอบได้
    console.error("[NutriSmart] Unhandled runtime error:", error);
  }, [error]);

  return (
    <>
      <ErrorScreen
        mascot={<TomatoMascot />}
        badgeText="Error 500"
        badgeBg="#FFF3E0"
        badgeColor="#F57C00"
        title="หัวหมุนเลยอ่ะ~ 😵‍💫"
        subtitle={error.message || "มะเขือเทศวิงเวียนหัวมาก ทีมงานรีบมาช่วยแล้วนะ!"}
        actions={[
          { label: "🔄 ลองใหม่นะ!", variant: "orange", onClick: reset },
          { label: "🏠 กลับหน้าหลัก", variant: "secondary", onClick: () => router.push("/dashboard") },
        ]}
      />
      {error.digest && (
        <p className="text-center text-xs text-muted-foreground/60 font-mono -mt-4 pb-4">
          Error ID: {error.digest}
        </p>
      )}
    </>
  );
}
