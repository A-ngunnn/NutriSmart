# 1. ใช้ Python เวอร์ชัน 3.14 บน Linux แบบขนาดกระทัดรัด (Slim) เป็นฐาน
FROM python:3.14-slim

# 2. ตั้งค่าโฟลเดอร์หลักสำหรับทำงานด้านใน Container
WORKDIR /app

# 3. ติดตั้งเครื่องมือของระบบ Linux ที่จำเป็นสำหรับการคอมไพล์แพ็กเกจบางตัว
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 4. ก๊อปปี้ไฟล์รายการแพ็กเกจ (ที่เราเพิ่งสร้างเมื่อกี้) เข้าไปในกล่องก่อน
COPY requirements.txt .

# 5. สั่งติดตั้งแพ็กเกจทั้งหมดลงในระบบของ Docker
RUN pip install --no-cache-dir -r requirements.txt

# 6. ก๊อปปี้โค้ดและโฟลเดอร์ทั้งหมดจากเครื่องเรา (เช่น main.py, routers, services) เข้าไปในกล่อง
COPY . .

# 7. เปิดช่องทางพอร์ต 8080 ให้โลกภายนอกสามารถยิงสแกนภาพหรือแชทเข้ามาได้
EXPOSE 8080

# 8. คำสั่งสูงสุดสำหรับสตาร์ทเซิร์ฟเวอร์หลังบ้านขึ้นมาทำงานทันทีที่กล่องเปิด
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]