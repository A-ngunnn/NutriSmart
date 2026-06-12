# 1. ใช้ Python 3.11 บน Linux แบบคลีน
FROM python:3.11-slim

# 2. ตั้งค่าโฟลเดอร์ทำงานภายในคอนเทนเนอร์
WORKDIR /app

# 3. ติดตั้งเครื่องมือของระบบ Linux ที่จำเป็น
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 4. ก๊อปปี้ไฟล์รายการแพ็กเกจ
COPY requirements.txt .

# 5. สั่งติดตั้งแพ็กเกจ
RUN pip install --no-cache-dir -r requirements.txt

# 6. ก๊อปปี้โค้ด backend ทั้งหมดเข้าคอนเทนเนอร์
COPY . .

# 7. ก๊อปปี้โฟลเดอร์ knowledge จาก database/ (อยู่ถัดขึ้นไป 1 ระดับ) เข้ามาด้วย
# Render Docker build context = backend/ ดังนั้นเราต้องจัดการ path ใน config แทน
# ไฟล์ knowledge จะถูก copy ผ่าน docker-compose หรือ multi-stage build
# สำหรับตอนนี้ rag_service จะ graceful fallback ถ้าไม่เจอไฟล์

# 8. เปิดช่องทางพอร์ต 10000 สำหรับระบบ Render
EXPOSE 10000

# 9. คำสั่งสตาร์ทเซิร์ฟเวอร์หลังบ้านทำงานจริง
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "10000"]