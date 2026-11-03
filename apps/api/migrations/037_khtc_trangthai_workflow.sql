-- Migration 037: Cập nhật ràng buộc CK_KHTC_TRANGTHAI cho quy trình duyệt kế hoạch chi tiết
-- Thêm các trạng thái: 'Chờ phân công thực hiện', 'Chờ khoa xét duyệt'

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_KHTC_TRANGTHAI')
BEGIN
    ALTER TABLE KEHOACHTOCHUC DROP CONSTRAINT CK_KHTC_TRANGTHAI;
END;

ALTER TABLE KEHOACHTOCHUC ADD CONSTRAINT CK_KHTC_TRANGTHAI CHECK (
    TrangThai IN (
        N'Chờ phân công thực hiện',
        N'Dự thảo',
        N'Chờ khoa xét duyệt',
        N'Chờ khoa ký',
        N'Chờ CTSV ký',
        N'Đã duyệt',
        N'Cần bổ sung',
        N'Từ chối'
    )
);
