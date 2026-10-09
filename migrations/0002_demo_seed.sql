-- Data demo agar dashboard terlihat hidup. Aman dihapus untuk produksi.
-- Staff memakai hash yang sama dengan admin (kata sandi: admin123).

INSERT OR IGNORE INTO users (id, name, email, role, salt, hash) VALUES
  ('u-kasir',  'Putri Kasir',   'kasir@fiftynine.id',   'kasir',   'd6e9189820cd23ad80d75ff78f042d02', 'fb373250691bb22af8fedea214b6fbd4473ed1a417539e5443fab3956265f903'),
  ('u-finance','Agus Finance',  'finance@fiftynine.id', 'finance', 'd6e9189820cd23ad80d75ff78f042d02', 'fb373250691bb22af8fedea214b6fbd4473ed1a417539e5443fab3956265f903'),
  ('u-socmed', 'Nina Socmed',   'socmed@fiftynine.id',  'socmed',  'd6e9189820cd23ad80d75ff78f042d02', 'fb373250691bb22af8fedea214b6fbd4473ed1a417539e5443fab3956265f903'),
  ('u-hrd',    'Hadi HRD',      'hrd@fiftynine.id',     'hrd',     'd6e9189820cd23ad80d75ff78f042d02', 'fb373250691bb22af8fedea214b6fbd4473ed1a417539e5443fab3956265f903'),
  ('u-staff1', 'Rizky Staff',   'staff@fiftynine.id',   'staff',   'd6e9189820cd23ad80d75ff78f042d02', 'fb373250691bb22af8fedea214b6fbd4473ed1a417539e5443fab3956265f903');

INSERT OR IGNORE INTO members (id, name, phone, tier, ayo_member_id, joined_at) VALUES
  ('m-1','Andi Wijaya','081200000001','vip','AYO-1001','2025-01-10'),
  ('m-2','Siti Aminah','081200000002','reguler','AYO-1002','2025-02-14'),
  ('m-3','Budi Hartono','081200000003','vvip','AYO-1003','2025-03-05'),
  ('m-4','Rina Melati','081200000004','reguler','AYO-1004','2025-04-21'),
  ('m-5','Dedi Kurnia','081200000005','vip','AYO-1005','2025-06-02'),
  ('m-6','Lia Puspita','081200000006','reguler','AYO-1006','2025-07-19');

INSERT OR IGNORE INTO events (id, title, venue, starts_at, ends_at, status) VALUES
  ('ev-1','Turnamen Futsal','Lapangan A','2026-10-18 08:00','2026-10-18 17:00','rencana'),
  ('ev-2','Gathering Member','Aula Utama','2026-10-25 19:00','2026-10-25 22:00','rencana'),
  ('ev-3','Coaching Clinic','Lapangan B','2026-10-12 09:00','2026-10-12 12:00','berjalan'),
  ('ev-4','Fun Match','Lapangan A','2026-09-28 16:00','2026-09-28 18:00','selesai');

INSERT OR IGNORE INTO finance_entries (id, date, type, category, amount, note) VALUES
  ('f-1','2026-06-05','income','Sewa Lapangan',18500000,'Juni'),
  ('f-2','2026-06-20','expense','Operasional',9200000,'Juni'),
  ('f-3','2026-07-08','income','Sewa Lapangan',21000000,'Juli'),
  ('f-4','2026-07-22','expense','Gaji',14500000,'Juli'),
  ('f-5','2026-08-03','income','Membership',12750000,'Agustus'),
  ('f-6','2026-08-19','expense','Operasional',8600000,'Agustus'),
  ('f-7','2026-09-06','income','Sewa Lapangan',24300000,'September'),
  ('f-8','2026-09-25','expense','Event',11200000,'September'),
  ('f-9','2026-10-02','income','Sewa Lapangan',27800000,'Oktober'),
  ('f-10','2026-10-07','income','Kafe',6400000,'Oktober'),
  ('f-11','2026-10-08','expense','Operasional',9800000,'Oktober');

INSERT OR IGNORE INTO social_posts (id, platform, caption, scheduled_at, status) VALUES
  ('sp-1','instagram','Promo weekend 20% off!','2026-10-11 10:00','terjadwal'),
  ('sp-2','tiktok','Highlight turnamen futsal','2026-10-13 19:00','draft'),
  ('sp-3','instagram','Open member VIP','2026-10-15 12:00','draft');

INSERT OR IGNORE INTO achievements (id, staff_id, title, points, date) VALUES
  ('ac-1','u-kasir','Zero selisih kas sebulan',50,'2026-09-30'),
  ('ac-2','u-socmed','Reach 100rb minggu ini',40,'2026-10-05'),
  ('ac-3','u-staff1','Karyawan teladan',60,'2026-09-15');

INSERT OR IGNORE INTO attendance (id, staff_id, date, check_in, check_out, status) VALUES
  ('at-1','u-kasir','2026-10-08','08:02','16:10','hadir'),
  ('at-2','u-staff1','2026-10-08','09:20','17:05','telat'),
  ('at-3','u-finance','2026-10-08','08:00','16:00','hadir'),
  ('at-4','u-socmed','2026-10-08',NULL,NULL,'izin');
