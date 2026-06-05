-- สร้างตาราง profiles เก็บข้อมูลผู้ใช้
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  name text,
  age numeric,
  gender text,
  weight numeric,
  height numeric,
  activity_level text,
  goal text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- สร้างตาราง food_logs เก็บประวัติการกินอาหาร
create table public.food_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  meal_type text not null,
  calories numeric not null,
  protein numeric not null,
  carbs numeric not null,
  fat numeric not null,
  date date not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- สร้างตาราง scan_history เก็บประวัติการวิเคราะห์ฉลาก
create table public.scan_history (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  product_name text not null,
  calories numeric not null,
  protein numeric not null,
  carbs numeric not null,
  total_fat numeric not null,
  sugar numeric not null,
  sodium numeric not null,
  score numeric not null,
  status text not null,
  date date not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- สร้างตาราง water_logs เก็บประวัติการดื่มน้ำ
create table public.water_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  amount numeric not null,
  date date not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- เปิดใช้งาน RLS (Row Level Security) เพื่อความปลอดภัย
alter table public.profiles enable row level security;
alter table public.food_logs enable row level security;
alter table public.scan_history enable row level security;
alter table public.water_logs enable row level security;

-- สร้าง Policies ให้ผู้ใช้แต่ละคนเห็น/แก้ไขข้อมูลเฉพาะของตัวเองเท่านั้น
create policy "Users can view own profile." on profiles for select using (auth.uid() = id);
create policy "Users can update own profile." on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile." on profiles for insert with check (auth.uid() = id);

create policy "Users can CRUD own food_logs." on food_logs for all using (auth.uid() = user_id);
create policy "Users can CRUD own scan_history." on scan_history for all using (auth.uid() = user_id);
create policy "Users can CRUD own water_logs." on water_logs for all using (auth.uid() = user_id);
