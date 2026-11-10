SET XACT_ABORT ON;

IF OBJECT_ID(N'dbo.trg_ChiPhiKhongVuotDuToan', N'TR') IS NOT NULL
  DROP TRIGGER dbo.trg_ChiPhiKhongVuotDuToan;

DECLARE @ConstraintName sysname;
DECLARE @Sql nvarchar(max);

DECLARE DefaultConstraints CURSOR LOCAL FAST_FORWARD FOR
  SELECT dc.name
  FROM sys.default_constraints dc
  JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id
  WHERE dc.parent_object_id=OBJECT_ID(N'dbo.HOATDONGHOCTHUAT')
    AND c.name IN(N'SLToiDa',N'KinhPhiDuTru');
OPEN DefaultConstraints;
FETCH NEXT FROM DefaultConstraints INTO @ConstraintName;
WHILE @@FETCH_STATUS=0
BEGIN
  SET @Sql=N'ALTER TABLE dbo.HOATDONGHOCTHUAT DROP CONSTRAINT '+QUOTENAME(@ConstraintName)+N';';
  EXEC sys.sp_executesql @Sql;
  FETCH NEXT FROM DefaultConstraints INTO @ConstraintName;
END;
CLOSE DefaultConstraints;
DEALLOCATE DefaultConstraints;

DECLARE CheckConstraints CURSOR LOCAL FAST_FORWARD FOR
  SELECT cc.name
  FROM sys.check_constraints cc
  WHERE cc.parent_object_id=OBJECT_ID(N'dbo.HOATDONGHOCTHUAT')
    AND (cc.definition LIKE N'%SLToiDa%' OR cc.definition LIKE N'%KinhPhiDuTru%');
OPEN CheckConstraints;
FETCH NEXT FROM CheckConstraints INTO @ConstraintName;
WHILE @@FETCH_STATUS=0
BEGIN
  SET @Sql=N'ALTER TABLE dbo.HOATDONGHOCTHUAT DROP CONSTRAINT '+QUOTENAME(@ConstraintName)+N';';
  EXEC sys.sp_executesql @Sql;
  FETCH NEXT FROM CheckConstraints INTO @ConstraintName;
END;
CLOSE CheckConstraints;
DEALLOCATE CheckConstraints;

IF COL_LENGTH(N'dbo.HOATDONGHOCTHUAT',N'SLToiDa') IS NOT NULL
  ALTER TABLE dbo.HOATDONGHOCTHUAT DROP COLUMN SLToiDa;
IF COL_LENGTH(N'dbo.HOATDONGHOCTHUAT',N'KinhPhiDuTru') IS NOT NULL
  ALTER TABLE dbo.HOATDONGHOCTHUAT DROP COLUMN KinhPhiDuTru;
IF COL_LENGTH(N'dbo.HOATDONGHOCTHUAT',N'BanThamGia') IS NULL
  ALTER TABLE dbo.HOATDONGHOCTHUAT ADD BanThamGia nvarchar(max) NULL;
