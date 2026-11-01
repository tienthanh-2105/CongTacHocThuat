IF COL_LENGTH(N'dbo.HOATDONGHOCTHUAT', N'CapTC') IS NULL
BEGIN
  EXEC sys.sp_executesql N'ALTER TABLE dbo.HOATDONGHOCTHUAT ADD CapTC NVARCHAR(50) NULL CONSTRAINT DF_HOATDONGHOCTHUAT_CapTC DEFAULT N''Cấp Khoa/Liên bộ môn'' WITH VALUES';
END
ELSE
BEGIN
  DECLARE @capTcDefaultConstraint sysname;
  SELECT @capTcDefaultConstraint=dc.name
  FROM sys.default_constraints dc
  JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id
  WHERE dc.parent_object_id=OBJECT_ID(N'dbo.HOATDONGHOCTHUAT') AND c.name=N'CapTC';

  IF @capTcDefaultConstraint IS NOT NULL
  BEGIN
    DECLARE @dropCapTcDefaultSql nvarchar(max)=N'ALTER TABLE dbo.HOATDONGHOCTHUAT DROP CONSTRAINT '+QUOTENAME(@capTcDefaultConstraint);
    EXEC sys.sp_executesql @dropCapTcDefaultSql;
  END;

  EXEC sys.sp_executesql N'ALTER TABLE dbo.HOATDONGHOCTHUAT ADD CONSTRAINT DF_HOATDONGHOCTHUAT_CapTC DEFAULT N''Cấp Khoa/Liên bộ môn'' FOR CapTC';
END;

EXEC sys.sp_executesql N'UPDATE dbo.HOATDONGHOCTHUAT SET CapTC=N''Cấp Khoa/Liên bộ môn'' WHERE CapTC=N''Cấp Khoa''';
