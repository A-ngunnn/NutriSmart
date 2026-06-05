"use client";

import { useState, useRef, useEffect } from "react";
import { Search, MoreVertical, Paperclip, Send, Trash2 } from "lucide-react";
import { chatWithBackend } from "@/lib/backend-api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "assistant";
  content: string;
  time: string;
}

interface NutrientInfo {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTime(): string {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, "0")}:${d
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
}

/** Very simple heuristic – replace with a proper parser if needed */
function extractNutrients(text: string): NutrientInfo | null {
  const cal = text.match(/(\d{3,4})\s*(?:kcal|แคลอรี่)/i);
  const pro = text.match(/โปรตีน[^\d]*(\d+)/i);
  const car = text.match(/คาร์บ[^\d]*(\d+)/i);
  const fat = text.match(/ไขมัน[^\d]*(\d+)/i);
  if (!cal) return null;
  return {
    calories: parseInt(cal[1]),
    protein: pro ? parseInt(pro[1]) : 0,
    carbs: car ? parseInt(car[1]) : 0,
    fat: fat ? parseInt(fat[1]) : 0,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function BotAvatar({ size = 28 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--primary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg
        viewBox="0 0 28 28"
        fill="none"
        width={size * 0.75}
        height={size * 0.75}
      >
        <ellipse cx="14" cy="11" rx="4" ry="4.2" fill="var(--primary-foreground)" />
        <path
          d="M9 22c0-2.761 2.239-5 5-5s5 2.239 5 5"
          stroke="var(--primary-foreground)"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <path
          d="M11.5 7 Q12.5 5.5 14 6 Q15.5 6.5 16.5 7"
          stroke="var(--primary-foreground)"
          strokeWidth="1"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </div>
  );
}

function NutrientCard({ info }: { info: NutrientInfo }) {
  const items = [
    { label: "แคลอรี่", value: `${info.calories} kcal`, color: "var(--primary)" },
    { label: "โปรตีน", value: `${info.protein} g`, color: "#378ADD" },
    { label: "คาร์บ", value: `${info.carbs} g`, color: "#EF9F27" },
    { label: "ไขมัน", value: `${info.fat} g`, color: "#D85A30" },
  ];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 6,
        background: "var(--background)",
        border: "0.5px solid var(--primary)",
        borderRadius: 12,
        padding: "10px 12px",
        marginTop: 8,
      }}
    >
      {items.map((it) => (
        <div
          key={it.label}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: it.color,
              flexShrink: 0,
            }}
          />
          <span style={{ color: "var(--text-secondary)" }}>{it.label}</span>
          <span
            style={{
              fontWeight: 500,
              marginLeft: "auto",
              color: "var(--text-primary)",
            }}
          >
            {it.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 4, padding: "10px 14px" }}>
      {[0, 0.2, 0.4].map((delay, i) => (
        <span
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--primary)",
            display: "inline-block",
            animation: `nutri-bounce 1.2s ${delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function NutriChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "สวัสดีค่ะ! หนูชื่อ **น้อง Nutri** 🌿\nผู้ช่วยด้านโภชนาการส่วนตัวของคุณค่ะ\n\nวันนี้อยากให้หนูช่วยเรื่องอะไรคะ?",
      time: getTime(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const quickTags = [
    "🥗 วางแผนมื้ออาหาร",
    "📊 คำนวณแคลอรี่",
    "💪 อาหารเพิ่มกล้าม",
    "🥦 อาหารลดน้ำหนัก",
    "🩺 โรคประจำตัว",
  ];

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");

    const userMsg: Message = { role: "user", content: text, time: getTime() };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const history = [...messages, userMsg].map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      const reply = await chatWithBackend(text, history);

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: reply, time: getTime() },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "ขออภัยค่ะ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง 🙏",
          time: getTime(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function renderContent(content: string) {
    // Bold markdown **text**
    const parts = content.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((p, i) =>
      p.startsWith("**") ? (
        <strong key={i}>{p.slice(2, -2)}</strong>
      ) : (
        <span key={i}>{p}</span>
      )
    );
  }

  return (
    <>
      {/* Keyframe injection */}
      <style>{`
        @keyframes nutri-bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-5px); background: var(--primary); }
        }
        .nutri-tag:hover { background: var(--primary) !important; color: var(--primary-foreground) !important; border-color: var(--primary) !important; }
        .nutri-send:hover { opacity: 0.9 !important; }
        .nutri-send:active { transform: scale(0.93); }
        .nutri-input:focus { border-color: var(--primary) !important; outline: none; }
        .nutri-hbtn:hover { background: rgba(255,255,255,0.25) !important; }
      `}</style>

      <div
        style={{
          fontFamily: "'Sarabun', 'Prompt', sans-serif",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "var(--color-background-primary, #fff)",
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            background: "var(--primary)",
            color: "var(--primary-foreground)",
            padding: "1rem 1.25rem",
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div style={{ position: "relative" }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <BotAvatar size={36} />
            </div>
            <span
              style={{
                position: "absolute",
                bottom: 2,
                right: 2,
                width: 10,
                height: 10,
                background: "#4ade80",
                borderRadius: "50%",
                border: "2px solid var(--primary)",
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: "'Prompt', sans-serif",
                fontSize: 16,
                fontWeight: 600,
                color: "#fff",
                letterSpacing: 0.3,
              }}
            >
              น้อง Nutri 🌿
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 1 }}>
              ที่ปรึกษาโภชนาการ · ออนไลน์อยู่
            </div>
          </div>
          {/* ── Menu ── */}
          <div style={{ position: "relative" }}>
            <button
              className="nutri-hbtn"
              onClick={() => setShowMenu((prev) => !prev)}
              aria-label="ตัวเลือกเพิ่มเติม"
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: showMenu ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.15)",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                transition: "background 0.2s",
              }}
            >
              <MoreVertical style={{ width: 16, height: 16 }} aria-hidden />
            </button>

            {/* Dropdown */}
            {showMenu && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  marginTop: 8,
                  background: "var(--color-background-primary, #fff)",
                  borderRadius: 12,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  border: "1px solid var(--color-border-tertiary, #e2e2e2)",
                  overflow: "hidden",
                  zIndex: 10,
                  minWidth: 160,
                }}
              >
                <button
                  onClick={() => {
                    setMessages([{
                      role: "assistant",
                      content: "สวัสดีค่ะ! หนูชื่อ **น้อง Nutri** 🌿\nผู้ช่วยด้านโภชนาการส่วนตัวของคุณค่ะ\n\nวันนี้อยากให้หนูช่วยเรื่องอะไรคะ?",
                      time: getTime(),
                    }]);
                    setShowMenu(false);
                  }}
                  className="hover:bg-muted"
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    background: "transparent",
                    border: "none",
                    textAlign: "left",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--destructive, #ef4444)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Trash2 style={{ width: 14, height: 14 }} />
                  ล้างประวัติแชท
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Quick Tags ── */}
        <div
          style={{
            display: "flex",
            gap: 6,
            padding: "10px 14px",
            overflowX: "auto",
            scrollbarWidth: "none",
            background: "var(--color-background-secondary, #f7f7f5)",
            borderBottom: "0.5px solid var(--color-border-tertiary, #e2e2e2)",
            flexShrink: 0,
          }}
        >
          {quickTags.map((tag) => (
            <button
              key={tag}
              className="nutri-tag"
              onClick={() =>
                setInput(tag.replace(/^[^\s]+\s/, ""))
              }
              style={{
                whiteSpace: "nowrap",
                fontSize: 12,
                padding: "4px 12px",
                borderRadius: 20,
                background: "var(--color-background-primary, #fff)",
                border: "1px solid var(--primary)",
                color: "var(--primary)",
                cursor: "pointer",
                transition: "all 0.15s",
                fontFamily: "inherit",
              }}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* ── Messages ── */}
        <div
          ref={bodyRef}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "1rem",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            scrollbarWidth: "thin",
          }}
        >
          {messages.map((msg, idx) => {
            const isUser = msg.role === "user";
            const nutrients =
              !isUser ? extractNutrients(msg.content) : null;
            return (
              <div
                key={idx}
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "flex-end",
                  flexDirection: isUser ? "row-reverse" : "row",
                }}
              >
                {isUser ? (
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: "var(--color-background-info, #dbeafe)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 500,
                      color: "var(--color-text-info, #1d4ed8)",
                      flexShrink: 0,
                    }}
                  >
                    คุณ
                  </div>
                ) : (
                  <BotAvatar />
                )}
                <div>
                  <div
                    style={{
                      maxWidth: "72%",
                      padding: "10px 14px",
                      borderRadius: 18,
                      fontSize: 14,
                      lineHeight: 1.55,
                      whiteSpace: "pre-wrap",
                      ...(isUser
                        ? {
                            background: "var(--primary)",
                            color: "var(--primary-foreground)",
                            borderBottomRightRadius: 4,
                          }
                        : {
                            background:
                              "var(--color-background-secondary, #f7f7f5)",
                            border:
                              "0.5px solid var(--color-border-tertiary, #e2e2e2)",
                            color: "var(--color-text-primary, #1a1a1a)",
                            borderBottomLeftRadius: 4,
                          }),
                    }}
                  >
                    {renderContent(msg.content)}
                    {nutrients && <NutrientCard info={nutrients} />}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--color-text-tertiary, #9ca3af)",
                      marginTop: 2,
                      paddingInline: 4,
                      textAlign: isUser ? "right" : "left",
                    }}
                  >
                    {msg.time}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Typing indicator */}
          {loading && (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <BotAvatar />
              <div
                style={{
                  background: "var(--color-background-secondary, #f7f7f5)",
                  border: "0.5px solid var(--color-border-tertiary, #e2e2e2)",
                  borderRadius: 18,
                  borderBottomLeftRadius: 4,
                }}
              >
                <TypingDots />
              </div>
            </div>
          )}
        </div>

        {/* ── Footer / Input ── */}
        <div
          style={{
            padding: "10px 12px",
            borderTop:
              "0.5px solid var(--color-border-tertiary, #e2e2e2)",
            flexShrink: 0,
            background: "var(--color-background-primary, #fff)",
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              aria-label="แนบไฟล์"
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: "var(--color-text-secondary, #6b7280)",
                fontSize: 20,
              }}
            >
              <Paperclip style={{ width: 20, height: 20 }} aria-hidden />
            </button>
            <input
              className="nutri-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="พิมพ์ข้อความถึงน้อง Nutri..."
              disabled={loading}
              style={{
                flex: 1,
                border:
                  "0.5px solid var(--color-border-secondary, #d1d5db)",
                borderRadius: 22,
                padding: "10px 16px",
                fontSize: 14,
                fontFamily: "inherit",
                background: "var(--color-background-secondary, #f7f7f5)",
                color: "var(--color-text-primary, #1a1a1a)",
                height: 42,
                transition: "border 0.2s",
              }}
            />
            <button
              className="nutri-send"
              onClick={send}
              disabled={loading || !input.trim()}
              aria-label="ส่ง"
              style={{
                width: 42,
                height: 42,
                borderRadius: "50%",
                background: loading || !input.trim() ? "var(--muted)" : "var(--primary)",
                border: "none",
                cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--primary-foreground)",
                transition: "background 0.15s, transform 0.1s",
                flexShrink: 0,
              }}
            >
              <Send style={{ width: 18, height: 18 }} aria-hidden />
            </button>
          </div>
          <p
            style={{
              textAlign: "center",
              fontSize: 10,
              color: "var(--color-text-tertiary, #9ca3af)",
              marginTop: 6,
            }}
          >
            น้อง Nutri{" "}
            <span style={{ color: "var(--primary)" }}>✦ Powered by Claude</span>{" "}
            · ข้อมูลเพื่อการอ้างอิงเท่านั้น
          </p>
        </div>
      </div>
    </>
  );
}
