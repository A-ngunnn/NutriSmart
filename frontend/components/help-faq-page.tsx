'use client'

import { Mail, MessageCircleQuestionMark } from 'lucide-react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import SettingsBackHeader from '@/components/settings-back-header'

const FAQS = [
  {
    q: 'NutriSmart วิเคราะห์แคลอรีจากรูปอาหารได้อย่างไร?',
    a: 'AI จะตรวจจับชนิดอาหารและประมาณขนาดเสิร์ฟจากรูปภาพ แล้วเทียบกับฐานข้อมูลโภชนาการเพื่อคำนวณแคลอรีและสารอาหาร ผลลัพธ์เป็นค่าประมาณ อาจมีความคลาดเคลื่อนได้ตามมุมกล้องและขนาดจาน',
  },
  {
    q: 'ผลวิเคราะห์ไม่ตรงกับความจริง แก้ไขได้ไหม?',
    a: 'ได้ครับ หลังบันทึกรายการอาหารแล้ว คุณสามารถแก้ไขปริมาณหรือชนิดอาหารได้ที่หน้า "บันทึก" โดยกดที่รายการนั้นแล้วเลือกแก้ไข',
  },
  {
    q: 'เป้าหมายแคลอรีและมาโครคำนวณจากอะไร?',
    a: 'คำนวณจาก TDEE (พลังงานที่ใช้ทั้งวัน) โดยอิงน้ำหนัก ส่วนสูง อายุ เพศ และระดับกิจกรรม แล้วปรับเพิ่ม/ลดตามเป้าหมาย เช่น ลดน้ำหนัก เพิ่มกล้ามเนื้อ ซึ่งสามารถแก้ไขได้ที่หน้าโปรไฟล์',
  },
  {
    q: 'คำแนะนำจาก AI สามารถใช้แทนคำแนะนำของแพทย์ได้หรือไม่?',
    a: 'ไม่ได้ครับ ข้อมูลและคำแนะนำใน NutriSmart มีไว้เพื่อเป็นข้อมูลประกอบเท่านั้น ไม่ใช่คำวินิจฉัยทางการแพทย์ หากมีภาวะสุขภาพเฉพาะ ควรปรึกษาแพทย์หรือนักกำหนดอาหารโดยตรง',
  },
  {
    q: 'ข้อมูลของฉันถูกเก็บไว้ที่ไหน และปลอดภัยหรือไม่?',
    a: 'ข้อมูลโปรไฟล์และบันทึกการกินถูกเก็บอย่างปลอดภัยและผูกกับบัญชีของคุณเท่านั้น คุณสามารถดาวน์โหลดหรือขอลบข้อมูลได้ที่หน้า "ความเป็นส่วนตัว"',
  },
  {
    q: 'ทำไมแจ้งเตือนบางอย่างไม่ขึ้น?',
    a: 'ตรวจสอบได้ที่หน้า "การแจ้งเตือน" ว่าเปิดสวิตช์ของประเภทนั้นไว้หรือไม่ และตรวจสอบสิทธิ์การแจ้งเตือนของเบราว์เซอร์/อุปกรณ์ด้วย',
  },
]

export default function HelpFaqPage() {
  return (
    <div className="p-4 space-y-5 lg:space-y-6 pb-24 max-w-2xl lg:max-w-3xl mx-auto">
      <SettingsBackHeader title="ช่วยเหลือ & คำถามที่พบบ่อย" subtitle="คู่มือการใช้งาน" />

      <div className="bg-card rounded-3xl shadow-sm border border-border px-5">
        <Accordion type="single" collapsible>
          {FAQS.map((item, idx) => (
            <AccordionItem key={idx} value={`item-${idx}`}>
              <AccordionTrigger>
                <span className="flex items-start gap-2 text-foreground">
                  <MessageCircleQuestionMark size={16} className="text-primary shrink-0 mt-0.5" />
                  {item.q}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground pl-6">{item.a}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      <a
        href="mailto:support@nutrismart.app"
        className="flex items-center gap-3.5 bg-card rounded-3xl shadow-sm border border-border px-5 py-4 hover:bg-muted/50 transition-colors"
      >
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Mail size={16} className="text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">ยังหาคำตอบไม่เจอ?</p>
          <p className="text-xs text-muted-foreground">ติดต่อทีมสนับสนุนที่ support@nutrismart.app</p>
        </div>
      </a>
    </div>
  )
}
