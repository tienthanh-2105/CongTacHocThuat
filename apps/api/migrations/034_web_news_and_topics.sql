IF OBJECT_ID(N'dbo.TINTUCHOCTHUAT',N'U') IS NULL
BEGIN
  DECLARE @activityType sysname, @accountType sysname;
  SELECT @activityType=TYPE_NAME(user_type_id) FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.HOATDONGHOCTHUAT') AND name=N'MaHD';
  SELECT @accountType=TYPE_NAME(user_type_id) FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.TAIKHOAN') AND name=N'MaTK';
  IF @activityType NOT IN(N'int',N'bigint') OR @accountType NOT IN(N'int',N'bigint') THROW 51034,'Unsupported news key types.',1;
  EXEC(N'CREATE TABLE dbo.TINTUCHOCTHUAT (
    MaTin BIGINT IDENTITY PRIMARY KEY, MaHD '+@activityType+N' NOT NULL,
    TieuDe NVARCHAR(250) NOT NULL, NoiDung NVARCHAR(MAX) NOT NULL,
    NguoiLap '+@accountType+N' NOT NULL,
    TrangThai NVARCHAR(20) NOT NULL DEFAULT N''Dự thảo'',
    NgayTao DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    NgayCapNhat DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(), CongBoLuc DATETIMEOFFSET NULL,
    CONSTRAINT FK_TIN_HOATDONG FOREIGN KEY(MaHD) REFERENCES dbo.HOATDONGHOCTHUAT(MaHD),
    CONSTRAINT FK_TIN_NGUOILAP FOREIGN KEY(NguoiLap) REFERENCES dbo.TAIKHOAN(MaTK),
    CONSTRAINT CK_TIN_TRANGTHAI CHECK(TrangThai IN(N''Dự thảo'',N''Đã công bố'',N''Đã ẩn''))
  );');
  CREATE INDEX IX_TIN_TRANGTHAI_NGAY ON dbo.TINTUCHOCTHUAT(TrangThai,CongBoLuc DESC);
END;
GO
-- Legacy topics used a mandatory judging subcommittee; web topics can be
-- submitted before that committee is assigned. Preserve existing relations.
IF COL_LENGTH(N'dbo.DETAI',N'MaTieuBan') IS NOT NULL
  AND EXISTS(SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.DETAI') AND name=N'MaTieuBan' AND is_nullable=0)
  ALTER TABLE dbo.DETAI ALTER COLUMN MaTieuBan INT NULL;
IF COL_LENGTH(N'dbo.DETAI',N'GVHD') IS NULL ALTER TABLE dbo.DETAI ADD GVHD NVARCHAR(150) NULL;
