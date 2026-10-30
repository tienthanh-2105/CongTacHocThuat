-- Three sequential signatures for the annual academic plan workflow.
IF EXISTS(SELECT 1 FROM sys.check_constraints WHERE name=N'CK_KEHOACH_TRANGTHAI')
  ALTER TABLE dbo.KEHOACHHOCTHUAT DROP CONSTRAINT CK_KEHOACH_TRANGTHAI;
ALTER TABLE dbo.KEHOACHHOCTHUAT ADD CONSTRAINT CK_KEHOACH_TRANGTHAI
  CHECK(TrangThai IN(
    N'Dự thảo', N'Chờ duyệt', N'Chờ Trưởng khoa ký duyệt',
    N'Chờ Phòng KHCN ký duyệt', N'Chờ Ban giám hiệu duyệt',
    N'Cần bổ sung', N'Đã duyệt', N'Không duyệt'
  ));
UPDATE dbo.KEHOACHHOCTHUAT
  SET TrangThai=N'Chờ Trưởng khoa ký duyệt'
  WHERE TrangThai=N'Chờ duyệt';
GO
IF NOT EXISTS(SELECT 1 FROM dbo.VAITRO WHERE TenVaiTro=N'Trưởng khoa')
  INSERT INTO dbo.VAITRO(TenVaiTro) VALUES(N'Trưởng khoa');
GO
