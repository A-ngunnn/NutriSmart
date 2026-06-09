# 1. ใช้ Python 3.11 บน Linux แบบคลีน
FROM python:3.11-slim

# 2. ตั้งค่าโฟลเดอร์ทำงานภายในคอนเทนเนอร์
WORKDIR /backend

# 3. ติดตั้งเครื่องมือของระบบ Linux ที่จำเป็น
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 4. ก๊อปปี้ไฟล์รายการแพ็กเกจ
COPY requirements.txt .

# 5. สั่งติดตั้งแพ็กเกจ
RUN pip install --no-cache-dir -r requirements.txt

# 6. ก๊อปปี้โค้ดและโฟลเดอร์ทั้งหมดเข้าคอนเทนเนอร์
COPY . .

# 7. เปิดช่องทางพอร์ต 10000 สำหรับระบบ Render
EXPOSE 10000

# 8. คำสั่งสตาร์ทเซิร์ฟเวอร์หลังบ้านทำงานจริง
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "10000"]