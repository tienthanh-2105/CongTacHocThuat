-- DỮ LIỆU MẪU HỌC KỲ 2 NĂM HỌC 2025-2026 - ĐỀ TÀI QUẢN LÝ CÔNG TÁC HỌC THUẬT (HUIT)

BEGIN;

-- 1. KHOA
INSERT INTO KHOA (MaKhoa, TenKhoa) VALUES
(1, 'Khoa Công nghệ Thông tin'),
(2, 'Khoa Kinh tế và Quản trị Kinh doanh'),
(3, 'Khoa Ngoại ngữ')
ON CONFLICT (MaKhoa) DO NOTHING;

-- 2. BỘ MÔN (Thuộc Khoa Công nghệ Thông tin)
INSERT INTO BOMON (MaBM, MaKhoa, TenBM) VALUES
(1, 1, 'Bộ môn Khoa học Máy tính'),
(2, 1, 'Bộ môn Kỹ thuật Phần mềm'),
(3, 1, 'Bộ môn Hệ thống Thông tin'),
(4, 1, 'Bộ môn Mạng máy tính & An toàn thông tin')
ON CONFLICT (MaBM) DO NOTHING;

-- 3. LỚP
INSERT INTO LOP (MaLop, TenLop, KhoaHoc, MaKhoa) VALUES
(1, 'CNTT_K19A', '2023-2027', 1),
(2, 'CNTT_K19B', '2023-2027', 1),
(3, 'KTPM_K19',  '2023-2027', 1),
(4, 'HTTT_K19',  '2023-2027', 1)
ON CONFLICT (MaLop) DO NOTHING;

-- 4. VAI TRÒ
INSERT INTO VAITRO (MaVaiTro, TenVaiTro) VALUES
(1, 'ADMIN'),
(2, 'CAN_BO_KHOA'),
(3, 'GIANG_VIEN'),
(4, 'SINH_VIEN')
ON CONFLICT (MaVaiTro) DO NOTHING;

-- 5. PHÂN QUYỀN
INSERT INTO PHANQUYEN (MaQuyen, TenQuyen, MoTa) VALUES
(1, 'XEM_DANH_SACH_HOAT_DONG', 'Xem danh sách và chi tiết các hoạt động học thuật'),
(2, 'DANG_KY_HOAT_DONG',       'Đăng ký tham gia hoặc dự thi các hoạt động'),
(3, 'QUAN_LY_KE_HOACH',        'Tạo, chỉnh sửa kế hoạch công tác học thuật'),
(4, 'PHE_DUYET_KE_HOACH',      'Duyệt kế hoạch công tác học thuật khoa/bộ môn'),
(5, 'QUAN_LY_HOAT_DONG',       'Tạo mới, chỉnh sửa và công bố hoạt động học thuật'),
(6, 'DIEM_DANH_QR',            'Quản lý mã QR và xác nhận điểm danh sinh viên'),
(7, 'NHAP_KET_QUA_CUOC_THI',   'Chấm điểm, cập nhật xếp hạng và giải thưởng cuộc thi'),
(8, 'QUAN_LY_DIEM_REN_LUYEN',  'Ghi nhận, điều chỉnh điểm rèn luyện cho sinh viên'),
(9, 'QUYET_TOAN_KINH_PHI',     'Lập và duyệt hồ sơ quyết toán, chi phí thực tế'),
(10, 'QUAN_TRI_HE_THONG',      'Toàn quyền quản trị tài khoản, vai trò và phân quyền')
ON CONFLICT (MaQuyen) DO NOTHING;

-- 6. GÁN QUYỀN CHO VAI TRÒ (VAITRO_QUYEN)
INSERT INTO VAITRO_QUYEN (MaVT, MaQuyen) VALUES
(1, 1), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7), (1, 8), (1, 9), (1, 10),
(2, 1), (2, 3), (2, 4), (2, 5), (2, 6), (2, 7), (2, 8), (2, 9),
(3, 1), (3, 3), (3, 5), (3, 6), (3, 7),
(4, 1), (4, 2)
ON CONFLICT DO NOTHING;

-- 7. NGƯỜI DÙNG
INSERT INTO NGUOIDUNG (MaNgDung, HoTen, Email, SDT, NgaySinh, GioiTinh, TrangThai) VALUES
(1,  'Nguyễn Văn Quản Trị',   'admin@university.edu.vn',    '0901234567', '1985-05-15', 'Nam', 'Hoạt động'),
(2,  'TS. Trần Thị Bích Vân', 'bichvan@university.edu.vn',  '0912345678', '1986-08-20', 'Nữ',  'Hoạt động'),
(3,  'TS. Lê Hoàng Nam',      'hoangnam@university.edu.vn', '0923456789', '1982-11-10', 'Nam', 'Hoạt động'),
(4,  'ThS. Phạm Minh Tuấn',   'minhtuan@university.edu.vn', '0934567890', '1989-03-25', 'Nam', 'Hoạt động'),
(5,  'TS. Nguyễn Thanh Tùng', 'thanhtung@university.edu.vn','0941234567', '1984-06-18', 'Nam', 'Hoạt động'),
(6,  'ThS. Đỗ Thúy Hằng',     'thuyhang@university.edu.vn', '0951234567', '1991-09-12', 'Nữ',  'Hoạt động'),
(7,  'Nguyễn Văn An',         'sv.an@student.edu.vn',       '0961234567', '2005-01-12', 'Nam', 'Hoạt động'),
(8,  'Trần Thị Bình',         'sv.binh@student.edu.vn',     '0971234567', '2005-04-18', 'Nữ',  'Hoạt động'),
(9,  'Lê Quốc Cường',         'sv.cuong@student.edu.vn',    '0981234567', '2005-07-22', 'Nam', 'Hoạt động'),
(10, 'Phạm Thị Dung',         'sv.dung@student.edu.vn',     '0991234567', '2005-09-30', 'Nữ',  'Hoạt động'),
(11, 'Hoàng Văn Em',          'sv.em@student.edu.vn',       '0918765432', '2005-12-05', 'Nam', 'Hoạt động'),
(12, 'Vũ Thị Giang',          'sv.giang@student.edu.vn',    '0928765432', '2005-03-14', 'Nữ',  'Hoạt động')
ON CONFLICT (MaNgDung) DO NOTHING;

-- 8. TÀI KHOẢN (Mật khẩu mặc định: MatKhau@123456)
INSERT INTO TAIKHOAN (MaTK, MaNgDung, MaVaiTro, TenDangNhap, MatKhau, PBMatKhau, TrangThai) VALUES
(1,  1,  1, 'admin.demo',     '$2b$12$rN8MUq6l5vgphMs7vFcogeea0AXRMXbC3uczIfwb881umRKlTmkyC', 0, 'Hoạt động'),
(2,  2,  2, 'cbk.bichvan',    '$2b$12$rN8MUq6l5vgphMs7vFcogeea0AXRMXbC3uczIfwb881umRKlTmkyC', 0, 'Hoạt động'),
(3,  3,  3, 'gv.hoangnam',    '$2b$12$rN8MUq6l5vgphMs7vFcogeea0AXRMXbC3uczIfwb881umRKlTmkyC', 0, 'Hoạt động'),
(4,  4,  3, 'gv.minhtuan',    '$2b$12$rN8MUq6l5vgphMs7vFcogeea0AXRMXbC3uczIfwb881umRKlTmkyC', 0, 'Hoạt động'),
(5,  5,  3, 'gv.thanhtung',   '$2b$12$rN8MUq6l5vgphMs7vFcogeea0AXRMXbC3uczIfwb881umRKlTmkyC', 0, 'Hoạt động'),
(6,  6,  3, 'gv.thuyhang',    '$2b$12$rN8MUq6l5vgphMs7vFcogeea0AXRMXbC3uczIfwb881umRKlTmkyC', 0, 'Hoạt động'),
(7,  7,  4, 'sv.nguyenvanan', '$2b$12$rN8MUq6l5vgphMs7vFcogeea0AXRMXbC3uczIfwb881umRKlTmkyC', 0, 'Hoạt động'),
(8,  8,  4, 'sv.tranthibinh', '$2b$12$rN8MUq6l5vgphMs7vFcogeea0AXRMXbC3uczIfwb881umRKlTmkyC', 0, 'Hoạt động'),
(9,  9,  4, 'sv.lequoccuong', '$2b$12$rN8MUq6l5vgphMs7vFcogeea0AXRMXbC3uczIfwb881umRKlTmkyC', 0, 'Hoạt động'),
(10, 10, 4, 'sv.phamthidung', '$2b$12$rN8MUq6l5vgphMs7vFcogeea0AXRMXbC3uczIfwb881umRKlTmkyC', 0, 'Hoạt động'),
(11, 11, 4, 'sv.hoangvanem',  '$2b$12$rN8MUq6l5vgphMs7vFcogeea0AXRMXbC3uczIfwb881umRKlTmkyC', 0, 'Hoạt động'),
(12, 12, 4, 'sv.vuthigiang',  '$2b$12$rN8MUq6l5vgphMs7vFcogeea0AXRMXbC3uczIfwb881umRKlTmkyC', 0, 'Hoạt động')
ON CONFLICT (MaTK) DO NOTHING;

-- 9. QUẢN TRỊ VIÊN
INSERT INTO QUANTRIVIEN (MaQuanTri, MaNgDung, MoTa) VALUES
(1, 1, 'Quản trị viên hệ thống công tác học thuật toàn trường')
ON CONFLICT (MaQuanTri) DO NOTHING;

-- 10. CÁN BỘ KHOA
INSERT INTO CANBOKHOA (MaCanBo, MaNgDung, MaKhoa, ChucVu) VALUES
(1, 2, 1, 'Phó Trưởng khoa phụ trách Công tác học thuật & NCKH Sinh viên')
ON CONFLICT (MaCanBo) DO NOTHING;

-- 11. GIẢNG VIÊN
INSERT INTO GIANGVIEN (MaGV, MaNgDung, HocVi, MaBM) VALUES
(1, 3, 'Tiến sĩ', 1),
(2, 4, 'Thạc sĩ', 2),
(3, 5, 'Tiến sĩ', 3),
(4, 6, 'Thạc sĩ', 4)
ON CONFLICT (MaGV) DO NOTHING;

-- 12. SINH VIÊN
INSERT INTO SINHVIEN (MaSV, MaNgDung, MaLop) VALUES
(1, 7,  1), -- Nguyễn Văn An (CNTT_K19A)
(2, 8,  1), -- Trần Thị Bình (CNTT_K19A)
(3, 9,  2), -- Lê Quốc Cường (CNTT_K19B)
(4, 10, 2), -- Phạm Thị Dung (CNTT_K19B)
(5, 11, 3), -- Hoàng Văn Em (KTPM_K19)
(6, 12, 4)  -- Vũ Thị Giang (HTTT_K19)
ON CONFLICT (MaSV) DO NOTHING;

-- 13. KẾ HOẠCH HỌC THUẬT (HỌC KỲ 2 NĂM HỌC 2025-2026)
INSERT INTO KEHOACHHOCTHUAT (
    MaKeHoach, TenKeHoach, NamHoc, HocKy, TrangThai, MaKhoa, NgPhuTrach,
    LoaiKeHoach, MaBM, NguoiDuyet, NgayDuyet, LichSuDuyet
) VALUES
(
    1,
    'Kế hoạch Tổng thể Hoạt động Học thuật và NCKH Sinh viên Khoa CNTT - Học kỳ 2 Năm học 2025-2026',
    '2025-2026',
    'Học kỳ 2',
    'Đã duyệt',
    1,
    1,
    'KHOA',
    NULL,
    1,
    '2026-01-20 09:30:00+07',
    '[{"nguoi_duyet": "admin.demo", "thoi_gian": "2026-01-20T09:30:00+07:00", "trang_thai": "Đã duyệt", "noi_dung": "Ban Chủ nhiệm Khoa phê duyệt kế hoạch chung HK2 (2025-2026). Giao các Bộ môn phối hợp tổ chức đúng tiến độ."}]'::jsonb
),
(
    2,
    'Kế hoạch Tổ chức Cuộc thi Học thuật Lập trình và Ứng dụng Phần mềm HK2 (2025-2026)',
    '2025-2026',
    'Học kỳ 2',
    'Đã duyệt',
    1,
    1,
    'BO_MON',
    2,
    2,
    '2026-01-15 14:00:00+07',
    '[{"nguoi_duyet": "cbk.bichvan", "thoi_gian": "2026-01-15T14:00:00+07:00", "trang_thai": "Đã duyệt", "noi_dung": "Kế hoạch chi tiết, dự trù kinh phí hợp lý, duyệt tổ chức cuộc thi HUIT Code Challenge 2026."}]'::jsonb
),
(
    3,
    'Kế hoạch Tổ chức Chuỗi Seminar Chuyên đề Trí tuệ Nhân tạo & Định hướng Nghiên cứu HK2 (2025-2026)',
    '2025-2026',
    'Học kỳ 2',
    'Đã duyệt',
    1,
    1,
    'BO_MON',
    1,
    2,
    '2026-01-18 10:30:00+07',
    '[{"nguoi_duyet": "cbk.bichvan", "thoi_gian": "2026-01-18T10:30:00+07:00", "trang_thai": "Đã duyệt", "noi_dung": "Đồng ý hỗ trợ kinh phí mời chuyên gia doanh nghiệp báo cáo seminar GenAI."}]'::jsonb
),
(
    4,
    'Kế hoạch Phát động Nghiên cứu Ý tưởng Đổi mới Sáng tạo & Chuyển đổi số HK2 (2025-2026)',
    '2025-2026',
    'Học kỳ 2',
    'Chờ duyệt',
    1,
    1,
    'BO_MON',
    3,
    NULL,
    NULL,
    '[]'::jsonb
)
ON CONFLICT (MaKeHoach) DO NOTHING;

-- 14. HOẠT ĐỘNG HỌC THUẬT (HỌC KỲ 2 NĂM HỌC 2025-2026: THÁNG 01/2026 - THÁNG 06/2026)
INSERT INTO HOATDONGHOCTHUAT (
    MaHD, MaKeHoach, MaKeHoachKhoa, TenHoatDong, MoTa,
    TgBatDau, TgKetThuc, HanDangKy, DiaDiem, SLToiDa, TrangThai,
    KinhPhiDuTru, NoiDungCongBo, NgayCongBo
) VALUES
(
    1,
    2,
    1,
    'Cuộc thi Lập trình Olympic Tin học Sinh viên - HUIT Code Challenge 2026',
    'Cuộc thi học thuật thường niên nhằm rèn luyện kỹ năng thuật toán, lập trình thi đấu và tuyển chọn sinh viên ưu tú tham gia đội tuyển Olympic Tin học toàn quốc.',
    '2026-03-22 08:00:00',
    '2026-03-22 17:30:00',
    '2026-03-15 23:59:59',
    'Khu phòng máy C101 - C102, Nhà C, ĐH Công Thương TP.HCM',
    120,
    'Đã kết thúc',
    18000000.00,
    'Khoa CNTT thông báo phát động Cuộc thi HUIT Code Challenge 2026 dành cho toàn thể sinh viên. Đăng ký theo đội 2 người. Cơ cấu giải thưởng hấp dẫn và cộng điểm rèn luyện.',
    '2026-02-15 08:00:00+07'
),
(
    2,
    3,
    1,
    'Seminar Học thuật: GenAI, RAG và Cloud Computing trong Phát triển Phần mềm Doanh nghiệp',
    'Tọa đàm chuyên sâu về mô hình ngôn ngữ lớn (LLM), kỹ thuật Retrieval-Augmented Generation (RAG) và kiến trúc Agentic AI kết hợp Cloud AWS/GCP trong doanh nghiệp thực tế.',
    '2026-04-12 08:30:00',
    '2026-04-12 11:30:00',
    '2026-04-09 23:59:59',
    'Hội trường Lớn B201, Tòa nhà B',
    250,
    'Đã kết thúc',
    6500000.00,
    'Kính mời toàn thể cán bộ, giảng viên và sinh viên quan tâm tham dự buổi Seminar học thuật với sự tham gia của các chuyên gia công nghệ hàng đầu.',
    '2026-03-25 08:30:00+07'
),
(
    3,
    1,
    1,
    'Cuộc thi Sáng tạo Ý tưởng Công nghệ & Đổi mới Sáng tạo Sinh viên CNTT 2026',
    'Khuyến khích sinh viên đề xuất giải pháp, đề tài công nghệ thực tiễn (IoT, AI, Mobile App, Web3) giải quyết các vấn đề đời sống và xã hội.',
    '2026-05-16 08:00:00',
    '2026-05-16 17:00:00',
    '2026-05-05 23:59:59',
    'Hội trường A - Tầng 2, Nhà Hiệu Bộ',
    80,
    'Đang diễn ra',
    22000000.00,
    'Phát động cuộc thi Sáng tạo Ý tưởng Công nghệ HK2 (2025-2026). Các đội thi nộp đề cương ý tưởng và poster sản phẩm trước ngày 05/05/2026.',
    '2026-04-01 09:00:00+07'
),
(
    4,
    1,
    1,
    'Seminar: Kỹ năng Viết Báo cáo Khoa học & Phương pháp Thực hiện Khóa luận Tốt nghiệp CNTT',
    'Hướng dẫn phương pháp nghiên cứu tài liệu, trích dẫn chuẩn IEEE, bố cục đề cương khóa luận và kỹ năng thuyết trình báo cáo trước hội đồng.',
    '2026-06-20 08:30:00',
    '2026-06-20 11:30:00',
    '2026-06-15 23:59:59',
    'Phòng Hội thảo C305, Nhà C',
    150,
    'Đã công bố',
    4500000.00,
    'Buổi tập huấn cực kỳ bổ ích dành cho sinh viên năm 3 và năm cuối chuẩn bị làm khóa luận tốt nghiệp và đồ án chuyên ngành.',
    '2026-05-25 10:00:00+07'
)
ON CONFLICT (MaHD) DO NOTHING;

-- 15. CUỘC THI
INSERT INTO CUOCTHI (MaCThi, MaHD, TenCuocThi, CapToChuc, TheLe, TieuChiCham, SLSinhVien, HinhThucThi) VALUES
(
    1,
    1,
    'Cuộc thi Lập trình Olympic Tin học Sinh viên - HUIT Code Challenge 2026',
    'Cấp Khoa',
    'Thi đấu lập trình giải thuật trên nền tảng Themis Online Judge. Đội gồm 2 sinh viên làm bài trong 4 giờ liên tục với 5 bài toán thuật toán.',
    'Số lượng testcase vượt qua (70%), Tối ưu thời gian chạy và bộ nhớ (30%).',
    60,
    'Theo đội'
),
(
    2,
    3,
    'Cuộc thi Sáng tạo Ý tưởng Công nghệ & Đổi mới Sáng tạo Sinh viên CNTT 2026',
    'Cấp Trường',
    'Mỗi đội từ 2-4 thành viên, nộp báo cáo nghiên cứu khả thi, demo sản phẩm và thuyết trình Pitching 10 phút trước Hội đồng Ban Giám khảo.',
    'Tính mới & sáng tạo (30%), Tính khả thi & công nghệ (40%), Khả năng thuyết trình & trả lời phản biện (30%).',
    40,
    'Theo đội'
)
ON CONFLICT (MaCThi) DO NOTHING;

-- 16. SEMINAR
INSERT INTO SEMINAR (MaSeminar, MaHD, ChuDe, NoiDung, DoiTuongTG, ThoiLuong, DVChuTri, DVPhoiHop, DienGia) VALUES
(
    1,
    2,
    'GenAI, RAG và Cloud Computing trong Phát triển Phần mềm Doanh nghiệp',
    '1. Tổng quan Kiến trúc Transformers & LLMs. 2. Kỹ thuật RAG nâng cao với Vector DB. 3. Multi-Agent Systems trong phát triển phần mềm doanh nghiệp.',
    'Giảng viên, học viên cao học và toàn thể sinh viên khối ngành Công nghệ thông tin',
    180,
    'Bộ môn Khoa học Máy tính',
    'Bộ môn Kỹ thuật Phần mềm',
    '[
        {"ho_ten": "TS. Lê Hoàng Nam", "hoc_vi": "Tiến sĩ", "co_quan": "Trưởng Bộ môn KHMT", "chu_de": "Kiến trúc Agentic AI và ứng dụng thực tiễn trong kỹ nghệ phần mềm"},
        {"ho_ten": "ThS. Phạm Minh Tuấn", "hoc_vi": "Thạc sĩ", "co_quan": "Kỹ sư Cấp cao tại FPT Software", "chu_de": "Triển khai RAG Production-Ready trên nền tảng Cloud"}
    ]'::jsonb
),
(
    2,
    4,
    'Kỹ năng Viết Báo cáo Khoa học & Phương pháp Thực hiện Khóa luận Tốt nghiệp CNTT',
    '1. Quy chuẩn trình bày khóa luận tốt nghiệp FIT-HUIT. 2. Công cụ quản lý tài liệu trích dẫn Zotero/Mendeley. 3. Kỹ năng thiết kế slide và trả lời phản biện trước hội đồng.',
    'Sinh viên năm 3, năm cuối chuẩn bị làm khóa luận tốt nghiệp và đồ án môn học',
    180,
    'Bộ môn Hệ thống Thông tin',
    'Khoa Công nghệ Thông tin',
    '[
        {"ho_ten": "TS. Nguyễn Thanh Tùng", "hoc_vi": "Tiến sĩ", "co_quan": "Trưởng Bộ môn HTTT", "chu_de": "Phương pháp luận nghiên cứu và trình bày khóa luận khoa học"}
    ]'::jsonb
)
ON CONFLICT (MaSeminar) DO NOTHING;

-- 17. BAN CUỘC THI & BAN TỔ CHỨC (PHÂN CÔNG GIẢNG VIÊN VÀ NHIỆM VỤ CHI TIẾT)
INSERT INTO BANCUOCTHI (MaBan, MaCThi, TenBanTC) VALUES
(1, 1, 'Ban Tổ chức & Điều hành Chung'),
(2, 1, 'Ban Ra đề thi & Hội đồng Giám khảo'),
(3, 1, 'Ban Thư ký & Hậu cần Kỹ thuật'),
(4, 2, 'Ban Tổ chức & Ban Giám khảo Cuộc thi Ý tưởng')
ON CONFLICT (MaBan) DO NOTHING;

INSERT INTO BANTOCHUC (MaBanTC, MaGV, ChucVu, NhiemVu) VALUES
(1, 1, 'Trưởng Ban Tổ chức',            '["Chỉ đạo toàn diện công tác tổ chức cuộc thi", "Phê duyệt kế hoạch chi tiết và dự trù kinh phí", "Chủ trì lễ khai mạc và bế mạc trao giải"]'::jsonb),
(1, 2, 'Phó Trưởng Ban Tổ chức',       '["Điều phối các ban chuyên môn", "Phụ trách truyền thông và phối hợp Trung tâm CNTT mượn phòng máy"]'::jsonb),
(2, 3, 'Trưởng Ban Ra đề & Giám khảo', '["Biên soạn ngân hàng đề thi 5 câu thuật toán", "Bảo mật đề thi tuyệt đối trước giờ thi", "Cấu hình hệ thống chấm tự động Themis và giải quyết phúc khảo"]'::jsonb),
(3, 4, 'Trưởng Ban Thư ký & Hậu cần',  '["Điểm danh và kiểm tra thẻ sinh viên thí sinh", "Chuẩn bị chứng từ thanh toán, bằng khen và tiền thưởng", "Tổng hợp biên bản kết quả thi và bàn giao cho Khoa"]'::jsonb),
(4, 1, 'Chủ tịch Hội đồng Giám khảo',  '["Thẩm định hồ sơ đề tài sáng tạo công nghệ", "Chấm điểm trực tiếp phần thuyết trình Pitching của các đội thi"]'::jsonb)
ON CONFLICT (MaBanTC, MaGV) DO NOTHING;

-- 18. ĐỘI THI
INSERT INTO DOITHI (MaDoi, MaCThi, TenDoi) VALUES
(1, 1, 'ByteCrafters'),
(2, 1, 'DevTitans'),
(3, 2, 'EcoSmart AI'),
(4, 2, 'BusTracker HUIT')
ON CONFLICT (MaDoi) DO NOTHING;

-- 19. THÀNH VIÊN ĐỘI (CÓ ĐÚNG MỘT TRƯỞNG ĐỘI)
INSERT INTO THANHVIENDOI (MaDoi, MaSV, VaiTro) VALUES
(1, 1, 'Trưởng đội'), -- Nguyễn Văn An
(1, 2, 'Thành viên'), -- Trần Thị Bình
(2, 3, 'Trưởng đội'), -- Lê Quốc Cường
(2, 4, 'Thành viên'), -- Phạm Thị Dung
(3, 5, 'Trưởng đội'), -- Hoàng Văn Em
(3, 1, 'Thành viên'), -- Nguyễn Văn An
(4, 6, 'Trưởng đội'), -- Vũ Thị Giang
(4, 3, 'Thành viên')  -- Lê Quốc Cường
ON CONFLICT (MaDoi, MaSV) DO NOTHING;

-- 20. ĐĂNG KÝ THAM GIA (DỰ THI, THAM GIA SEMINAR, HỖ TRỢ, CỔ VŨ)
INSERT INTO DKTHAMGIA (MaDK, MaHD, MaSV, NgayDK, HinhThuc, NguonDK, TrangThai) VALUES
(1,  1, 1, '2026-03-01 08:30:00', 'Dự thi',    'Sinh viên', 'Đã xác nhận'),
(2,  1, 2, '2026-03-01 08:35:00', 'Dự thi',    'Sinh viên', 'Đã xác nhận'),
(3,  1, 3, '2026-03-02 10:00:00', 'Dự thi',    'Sinh viên', 'Đã xác nhận'),
(4,  1, 4, '2026-03-02 10:05:00', 'Dự thi',    'Sinh viên', 'Đã xác nhận'),
(5,  1, 5, '2026-03-03 14:00:00', 'Hỗ trợ',    'Sinh viên', 'Đã xác nhận'), -- Hỗ trợ kỹ thuật BTC
(6,  1, 6, '2026-03-04 15:20:00', 'Cổ vũ',     'Sinh viên', 'Đã xác nhận'), -- Cổ động viên
(7,  2, 1, '2026-04-01 09:00:00', 'Tham gia',  'Sinh viên', 'Đã xác nhận'), -- Seminar GenAI
(8,  2, 2, '2026-04-01 09:15:00', 'Tham gia',  'Sinh viên', 'Đã xác nhận'),
(9,  2, 6, '2026-04-02 11:30:00', 'Tham gia',  'Sinh viên', 'Đã xác nhận'),
(10, 3, 5, '2026-04-15 10:00:00', 'Dự thi',    'Sinh viên', 'Đã xác nhận'), -- Cuộc thi Ý tưởng
(11, 4, 1, '2026-05-28 09:00:00', 'Tham gia',  'Sinh viên', 'Đã xác nhận'), -- Seminar Khóa luận (Sắp diễn ra)
(12, 4, 3, '2026-05-28 09:30:00', 'Tham gia',  'Sinh viên', 'Đã xác nhận')
ON CONFLICT (MaDK) DO NOTHING;

-- 21. PHÂN CÔNG CỔ VŨ & HỖ TRỢ THEO LỚP
INSERT INTO PHANCONGCOVU (MaCoVu, MaHD, MaLop, SoLuong, NhiemVu, TrangThai, LoaiPhanCong) VALUES
(1, 1, 1, 30, 'Tham gia cổ vũ khai mạc và lễ trao giải HUIT Code Challenge 2026', 'Đang thực hiện', 'CO_VU'),
(2, 1, 3, 15, 'Hỗ trợ điều phối thí sinh vào phòng máy và hỗ trợ kỹ thuật mạng nội bộ', 'Đang thực hiện', 'HO_TRO'),
(3, 2, 4, 20, 'Hỗ trợ đón tiếp đại biểu, phát tài liệu và micro hội thảo GenAI', 'Đang thực hiện', 'HO_TRO')
ON CONFLICT (MaCoVu) DO NOTHING;

-- 22. ĐỀ TÀI DỰ THI
INSERT INTO DETAI (MaDeTai, MaCThi, MaDoi, MaDK, TenDeTai, LinhVuc, MoTa, NgBatDau, NgKetThuc, TrangThai) VALUES
(
    1,
    2,
    3,
    NULL,
    'Hệ thống Phân loại Rác thải Thông minh Sử dụng Edge AI và IoT',
    'Trí tuệ nhân tạo & Smart City',
    'Giải pháp thùng rác thông minh tự động nhận diện và phân loại rác thải tại nguồn qua camera AI gắn trên Raspberry Pi.',
    '2026-04-15',
    '2026-05-16',
    'Đang thực hiện'
),
(
    2,
    2,
    4,
    NULL,
    'Ứng dụng Di động Định vị và Tối ưu Lộ trình Xe buýt Sinh viên HUIT',
    'Công nghệ Di động & GIS',
    'Ứng dụng theo dõi xe buýt trường theo thời gian thực và ước tính thời gian đến trạm chính xác.',
    '2026-04-18',
    '2026-05-16',
    'Đang thực hiện'
)
ON CONFLICT (MaDeTai) DO NOTHING;

-- 23. MÃ QR ĐIỂM DANH
INSERT INTO MAQR (MaQR, MaHD, MaQRCode, TGMo, TGHetHan, TrangThai) VALUES
(1, 1, 'QR_CODECHALLENGE_2026_CHECKIN', '2026-03-22 07:00:00+07', '2026-03-22 18:00:00+07', 'Hết hạn'),
(2, 2, 'QR_SEMINAR_GENAI_2026_CHECKIN',  '2026-04-12 07:30:00+07', '2026-04-12 12:00:00+07', 'Hết hạn'),
(3, 4, 'QR_SEMINAR_KHOALUAN_2026_CHECKIN','2026-06-20 07:30:00+07', '2026-06-20 12:00:00+07', 'Hoạt động')
ON CONFLICT (MaQR) DO NOTHING;

-- 24. ĐIỂM DANH (SINH VIÊN QUÉT MÃ QR CHECK-IN)
INSERT INTO DIEMDANH (MaDD, MaQR, MaDK, BatDauLuc, KetThucLuc, TrangThai) VALUES
(1, 2, 7, '2026-04-12 08:15:00+07', '2026-04-12 11:30:00+07', 'Đã xác nhận'),
(2, 2, 8, '2026-04-12 08:20:00+07', '2026-04-12 11:28:00+07', 'Đã xác nhận'),
(3, 2, 9, '2026-04-12 08:22:00+07', '2026-04-12 11:30:00+07', 'Đã xác nhận')
ON CONFLICT (MaDD) DO NOTHING;

-- 25. GIẢI THƯỞNG CUỘC THI
INSERT INTO GIAITHUONG (MaGT, MaCThi, TenGT, CapGiai) VALUES
(1, 1, 'Giải Nhất HUIT Code Challenge 2026', 'Giải Nhất'),
(2, 1, 'Giải Nhì HUIT Code Challenge 2026',  'Giải Nhì'),
(3, 1, 'Giải Ba HUIT Code Challenge 2026',   'Giải Ba'),
(4, 1, 'Giải Khuyến khích HUIT Code Challenge 2026', 'Giải Khuyến khích'),
(5, 2, 'Giải Ý tưởng Đổi mới Sáng tạo Xuất sắc', 'Giải Đặc biệt')
ON CONFLICT (MaGT) DO NOTHING;

-- 26. KẾT QUẢ HỌC THUẬT
INSERT INTO KETQUAHOCTHUAT (
    MaKQ, MaCThi, MaDoi, MaDK, MaGT, LoaiKQ, XepHang, Diem, GhiChu, TrangThai
) VALUES
(
    1,
    1,
    1,
    NULL,
    1,
    'Giải Nhất',
    1,
    97.50,
    'Đội ByteCrafters giải trọn vẹn 5/5 bài toán với thuật toán tối ưu thời gian thực thi tốt nhất.',
    'Đã công bố'
),
(
    2,
    1,
    2,
    NULL,
    2,
    'Giải Nhì',
    2,
    88.00,
    'Đội DevTitans hoàn thành xuất sắc 4/5 bài toán thuật toán.',
    'Đã công bố'
)
ON CONFLICT (MaKQ) DO NOTHING;

-- 27. ĐIỂM RÈN LUYỆN (HỌC KỲ 2 NĂM HỌC 2025-2026)
INSERT INTO DIEMRENLUYEN (
    MaDiem, MaSV, MaHD, HocKy, NamHoc, SoDiem, LyDo, TrangThai, NguoiGhi, GhiLuc
) VALUES
(1, 1, 1, 'Học kỳ 2', '2025-2026', 10.00, 'Đạt Giải Nhất cuộc thi Olympic Tin học - HUIT Code Challenge 2026 cấp Khoa', 'Đã xác nhận', 2, '2026-03-25 09:00:00+07'),
(2, 2, 1, 'Học kỳ 2', '2025-2026', 10.00, 'Đạt Giải Nhất cuộc thi Olympic Tin học - HUIT Code Challenge 2026 cấp Khoa', 'Đã xác nhận', 2, '2026-03-25 09:00:00+07'),
(3, 3, 1, 'Học kỳ 2', '2025-2026',  8.00, 'Đạt Giải Nhì cuộc thi Olympic Tin học - HUIT Code Challenge 2026 cấp Khoa',  'Đã xác nhận', 2, '2026-03-25 09:00:00+07'),
(4, 4, 1, 'Học kỳ 2', '2025-2026',  8.00, 'Đạt Giải Nhì cuộc thi Olympic Tin học - HUIT Code Challenge 2026 cấp Khoa',  'Đã xác nhận', 2, '2026-03-25 09:00:00+07'),
(5, 1, 2, 'Học kỳ 2', '2025-2026',  4.00, 'Tham dự và quét QR điểm danh đầy đủ buổi Seminar GenAI & Cloud Computing',    'Đã xác nhận', 2, '2026-04-13 10:00:00+07'),
(6, 2, 2, 'Học kỳ 2', '2025-2026',  4.00, 'Tham dự và quét QR điểm danh đầy đủ buổi Seminar GenAI & Cloud Computing',    'Đã xác nhận', 2, '2026-04-13 10:00:00+07'),
(7, 6, 2, 'Học kỳ 2', '2025-2026',  4.00, 'Tham dự và quét QR điểm danh đầy đủ buổi Seminar GenAI & Cloud Computing',    'Đã xác nhận', 2, '2026-04-13 10:00:00+07'),
(8, 5, 1, 'Học kỳ 2', '2025-2026',  5.00, 'Tham gia lực lượng cộng tác viên hỗ trợ kỹ thuật và tổ chức cuộc thi HUIT Code Challenge', 'Đã xác nhận', 2, '2026-03-25 09:30:00+07'),
(9, 6, 1, 'Học kỳ 2', '2025-2026',  2.00, 'Tham gia cổ vũ sôi nổi tại vòng Chung kết Cuộc thi HUIT Code Challenge 2026', 'Đã xác nhận', 2, '2026-03-25 09:30:00+07')
ON CONFLICT (MaDiem) DO NOTHING;

-- 28. HỒ SƠ QUYẾT TOÁN KINH PHÍ
INSERT INTO HOSOQUYETTOAN (MaHS, MaHD, NguoiLap, NguoiDuyet, TrangThai, NgayLap, NgayDuyet, GhiChu) VALUES
(
    1,
    1,
    2,
    1,
    'Đã duyệt',
    '2026-03-28 08:30:00+07',
    '2026-03-31 16:00:00+07',
    'Hồ sơ quyết toán Cuộc thi HUIT Code Challenge 2026 đầy đủ chứng từ hóa đơn đỏ, biên bản nghiệm thu và danh sách ký nhận tiền thưởng.'
),
(
    2,
    2,
    2,
    1,
    'Đã duyệt',
    '2026-04-16 09:00:00+07',
    '2026-04-18 15:30:00+07',
    'Quyết toán thù lao báo cáo viên và chi phí tiệc trà seminar GenAI.'
)
ON CONFLICT (MaHS) DO NOTHING;

-- 29. CHI PHÍ THỰC TẾ (KÈM CHỨNG TỪ JSONB)
INSERT INTO CHIPHITHUCTE (MaCP, MaHD, MaHS, NoiDung, SoTien, NgChi, NguoiGhi, ChungTu) VALUES
(
    1,
    1,
    1,
    'In ấn backdrop sân khấu, standee hội trường và phôi giấy khen giải thưởng',
    2800000.00,
    '2026-03-20',
    2,
    '[{"so_hd": "HD00248", "ngay": "2026-03-20", "don_vi": "Công ty In ấn & Quảng cáo Sài Gòn", "so_tien": 2800000}]'::jsonb
),
(
    2,
    1,
    1,
    'Tiền thưởng giải thưởng Cuộc thi HUIT Code Challenge 2026 (Nhất, Nhì, Ba, Khuyến khích)',
    10500000.00,
    '2026-03-22',
    2,
    '[{"so_ct": "PC00342", "ngay": "2026-03-22", "noi_dung": "Phiếu chi tiền mặt kèm danh sách ký nhận tiền giải thưởng của các đội thi"}]'::jsonb
),
(
    3,
    1,
    1,
    'Nước khoáng đóng chai và bánh ngọt giải lao cho thí sinh và Ban giám khảo',
    1650000.00,
    '2026-03-22',
    2,
    '[{"so_hd": "HD7721", "ngay": "2026-03-22", "don_vi": "Siêu thị Co.opmart Thắng Lợi", "so_tien": 1650000}]'::jsonb
),
(
    4,
    1,
    1,
    'Văn phòng phẩm, thẻ đeo thí sinh và tài liệu thi',
    1200000.00,
    '2026-03-21',
    2,
    '[{"so_hd": "HD3391", "ngay": "2026-03-21", "don_vi": "Nhà sách Fahasa", "so_tien": 1200000}]'::jsonb
),
(
    5,
    2,
    2,
    'Thù lao báo cáo viên chuyên gia Seminar GenAI & Cloud Computing',
    3500000.00,
    '2026-04-12',
    2,
    '[{"so_ct": "PC00388", "ngay": "2026-04-12", "noi_dung": "Phiếu chi thù lao diễn giả kèm hợp đồng và biên bản báo cáo khoa học"}]'::jsonb
),
(
    6,
    2,
    2,
    'Tiệc trà teabreak giữa giờ cho đại biểu, giảng viên và sinh viên',
    1700000.00,
    '2026-04-12',
    2,
    '[{"so_hd": "HD8890", "ngay": "2026-04-12", "don_vi": "Công ty TNHH Bánh Givral", "so_tien": 1700000}]'::jsonb
)
ON CONFLICT (MaCP) DO NOTHING;

-- 30. PHIÊN ĐĂNG NHẬP (MẪU DEMO CHO ADMIN)
INSERT INTO PHIENDANGNHAP (MaPhien, MaBamToken, MaTK, PBMatKhau, TaoLuc, HetHanLuc) VALUES
(
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    1,
    0,
    now(),
    now() + INTERVAL '8 hours'
)
ON CONFLICT (MaPhien) DO NOTHING;

-- Đồng bộ sequence
SELECT setval(pg_get_serial_sequence('KHOA', 'makhoa'), COALESCE(MAX(MaKhoa), 1)) FROM KHOA;
SELECT setval(pg_get_serial_sequence('BOMON', 'mabm'), COALESCE(MAX(MaBM), 1)) FROM BOMON;
SELECT setval(pg_get_serial_sequence('LOP', 'malop'), COALESCE(MAX(MaLop), 1)) FROM LOP;
SELECT setval(pg_get_serial_sequence('VAITRO', 'mavaitro'), COALESCE(MAX(MaVaiTro), 1)) FROM VAITRO;
SELECT setval(pg_get_serial_sequence('PHANQUYEN', 'maquyen'), COALESCE(MAX(MaQuyen), 1)) FROM PHANQUYEN;
SELECT setval(pg_get_serial_sequence('NGUOIDUNG', 'mangdung'), COALESCE(MAX(MaNgDung), 1)) FROM NGUOIDUNG;
SELECT setval(pg_get_serial_sequence('TAIKHOAN', 'matk'), COALESCE(MAX(MaTK), 1)) FROM TAIKHOAN;
SELECT setval(pg_get_serial_sequence('QUANTRIVIEN', 'maquantri'), COALESCE(MAX(MaQuanTri), 1)) FROM QUANTRIVIEN;
SELECT setval(pg_get_serial_sequence('CANBOKHOA', 'macanbo'), COALESCE(MAX(MaCanBo), 1)) FROM CANBOKHOA;
SELECT setval(pg_get_serial_sequence('GIANGVIEN', 'magv'), COALESCE(MAX(MaGV), 1)) FROM GIANGVIEN;
SELECT setval(pg_get_serial_sequence('SINHVIEN', 'masv'), COALESCE(MAX(MaSV), 1)) FROM SINHVIEN;
SELECT setval(pg_get_serial_sequence('KEHOACHHOCTHUAT', 'makehoach'), COALESCE(MAX(MaKeHoach), 1)) FROM KEHOACHHOCTHUAT;
SELECT setval(pg_get_serial_sequence('HOATDONGHOCTHUAT', 'mahd'), COALESCE(MAX(MaHD), 1)) FROM HOATDONGHOCTHUAT;
SELECT setval(pg_get_serial_sequence('CUOCTHI', 'macthi'), COALESCE(MAX(MaCThi), 1)) FROM CUOCTHI;
SELECT setval(pg_get_serial_sequence('SEMINAR', 'maseminar'), COALESCE(MAX(MaSeminar), 1)) FROM SEMINAR;
SELECT setval(pg_get_serial_sequence('BANCUOCTHI', 'maban'), COALESCE(MAX(MaBan), 1)) FROM BANCUOCTHI;
SELECT setval(pg_get_serial_sequence('DOITHI', 'madoi'), COALESCE(MAX(MaDoi), 1)) FROM DOITHI;
SELECT setval(pg_get_serial_sequence('DKTHAMGIA', 'madk'), COALESCE(MAX(MaDK), 1)) FROM DKTHAMGIA;
SELECT setval(pg_get_serial_sequence('PHANCONGCOVU', 'macovu'), COALESCE(MAX(MaCoVu), 1)) FROM PHANCONGCOVU;
SELECT setval(pg_get_serial_sequence('DETAI', 'madetai'), COALESCE(MAX(MaDeTai), 1)) FROM DETAI;
SELECT setval(pg_get_serial_sequence('MAQR', 'maqr'), COALESCE(MAX(MaQR), 1)) FROM MAQR;
SELECT setval(pg_get_serial_sequence('DIEMDANH', 'madd'), COALESCE(MAX(MaDD), 1)) FROM DIEMDANH;
SELECT setval(pg_get_serial_sequence('GIAITHUONG', 'magt'), COALESCE(MAX(MaGT), 1)) FROM GIAITHUONG;
SELECT setval(pg_get_serial_sequence('KETQUAHOCTHUAT', 'makq'), COALESCE(MAX(MaKQ), 1)) FROM KETQUAHOCTHUAT;
SELECT setval(pg_get_serial_sequence('DIEMRENLUYEN', 'madiem'), COALESCE(MAX(MaDiem), 1)) FROM DIEMRENLUYEN;
SELECT setval(pg_get_serial_sequence('HOSOQUYETTOAN', 'mahs'), COALESCE(MAX(MaHS), 1)) FROM HOSOQUYETTOAN;
SELECT setval(pg_get_serial_sequence('CHIPHITHUCTE', 'macp'), COALESCE(MAX(MaCP), 1)) FROM CHIPHITHUCTE;

COMMIT;
