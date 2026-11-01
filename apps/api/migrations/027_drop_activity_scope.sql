IF COL_LENGTH(N'dbo.HOATDONGHOCTHUAT', N'CapTC') IS NOT NULL
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

  EXEC sys.sp_executesql N'ALTER TABLE dbo.HOATDONGHOCTHUAT DROP COLUMN CapTC';
END;
