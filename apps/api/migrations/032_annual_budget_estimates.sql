-- A yearly budget estimate references already approved activity budget lines.
-- The original activity budget rows and their per-activity proposals remain intact.
IF EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id=OBJECT_ID(N'dbo.DUTRUKINHPHI') AND name=N'MaHD' AND is_nullable=0
)
BEGIN
  DECLARE @activityType sysname;
  SELECT @activityType=TYPE_NAME(user_type_id) FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.DUTRUKINHPHI') AND name=N'MaHD';
  EXEC(N'ALTER TABLE dbo.DUTRUKINHPHI ALTER COLUMN MaHD '+@activityType+N' NULL;');
END;
GO

IF OBJECT_ID(N'dbo.DUTRUKINHPHI_HOATDONG', N'U') IS NULL
BEGIN
  DECLARE @proposalType sysname, @lineType sysname;
  SELECT @proposalType=TYPE_NAME(user_type_id) FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.DUTRUKINHPHI') AND name=N'MaDuTruKP';
  SELECT @lineType=TYPE_NAME(user_type_id) FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.KINHPHIHOATDONG') AND name=N'MaKPHD';
  IF @proposalType NOT IN(N'int',N'bigint') OR @lineType NOT IN(N'int',N'bigint')
    THROW 51012, 'Budget estimate and activity budget keys must be INT or BIGINT.', 1;
  DECLARE @createLinkTable nvarchar(max)=N'CREATE TABLE dbo.DUTRUKINHPHI_HOATDONG (
    MaDuTruKP '+@proposalType+N' NOT NULL,
    MaKPHD '+@lineType+N' NOT NULL,
    CONSTRAINT PK_DUTRUKINHPHI_HOATDONG PRIMARY KEY (MaDuTruKP,MaKPHD),
    CONSTRAINT FK_DUTRUKINHPHI_HOATDONG_DUTRU FOREIGN KEY (MaDuTruKP) REFERENCES dbo.DUTRUKINHPHI(MaDuTruKP) ON DELETE CASCADE,
    CONSTRAINT FK_DUTRUKINHPHI_HOATDONG_KINHPHI FOREIGN KEY (MaKPHD) REFERENCES dbo.KINHPHIHOATDONG(MaKPHD)
  );';
  EXEC(@createLinkTable);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.DUTRUKINHPHI_HOATDONG') AND name = N'IX_DUTRUKINHPHI_HOATDONG_LINE')
  CREATE INDEX IX_DUTRUKINHPHI_HOATDONG_LINE ON dbo.DUTRUKINHPHI_HOATDONG(MaKPHD, MaDuTruKP);
GO
