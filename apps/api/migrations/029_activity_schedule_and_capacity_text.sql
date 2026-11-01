DECLARE @TgDuKienType sysname;
DECLARE @TgDuKienLength smallint;
DECLARE @TgDuKienNullable nvarchar(8);
DECLARE @SLSVDuKienType sysname;
DECLARE @SLSVDuKienLength smallint;
DECLARE @SLSVDuKienNullable nvarchar(8);
DECLARE @SLSVDuKienDefaultName sysname;
DECLARE @SLSVDuKienDefaultDefinition nvarchar(max);
DECLARE @Sql nvarchar(max);

SELECT @TgDuKienType = t.name, @TgDuKienLength = c.max_length,
       @TgDuKienNullable = CASE WHEN c.is_nullable = 1 THEN N'NULL' ELSE N'NOT NULL' END
FROM sys.columns c
JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID(N'dbo.HOATDONGHOCTHUAT') AND c.name = N'TgDuKien';

SELECT @SLSVDuKienType = t.name, @SLSVDuKienLength = c.max_length,
       @SLSVDuKienNullable = CASE WHEN c.is_nullable = 1 THEN N'NULL' ELSE N'NOT NULL' END
FROM sys.columns c
JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID(N'dbo.HOATDONGHOCTHUAT') AND c.name = N'SLSVDuKien';

SELECT @SLSVDuKienDefaultName = dc.name, @SLSVDuKienDefaultDefinition = dc.definition
FROM sys.default_constraints dc
JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
WHERE dc.parent_object_id = OBJECT_ID(N'dbo.HOATDONGHOCTHUAT') AND c.name = N'SLSVDuKien';

IF @TgDuKienType IS NULL OR @SLSVDuKienType IS NULL
  THROW 51000, 'HOATDONGHOCTHUAT.TgDuKien or SLSVDuKien is missing.', 1;

IF @TgDuKienType <> N'nvarchar' OR @TgDuKienLength <> 450
BEGIN
  SET @Sql = N'ALTER TABLE dbo.HOATDONGHOCTHUAT ALTER COLUMN [TgDuKien] NVARCHAR(225) ' + @TgDuKienNullable + N';';
  EXEC sys.sp_executesql @Sql;

  IF @TgDuKienType IN (N'date', N'datetime', N'datetime2', N'smalldatetime')
    UPDATE dbo.HOATDONGHOCTHUAT
    SET TgDuKien = CONVERT(nvarchar(225), TRY_CONVERT(date, TgDuKien), 23)
    WHERE TRY_CONVERT(date, TgDuKien) IS NOT NULL;
END;

IF @SLSVDuKienType <> N'nvarchar' OR @SLSVDuKienLength <> 450
BEGIN
  IF @SLSVDuKienDefaultName IS NOT NULL
  BEGIN
    SET @Sql = N'ALTER TABLE dbo.HOATDONGHOCTHUAT DROP CONSTRAINT ' + QUOTENAME(@SLSVDuKienDefaultName) + N';';
    EXEC sys.sp_executesql @Sql;
  END;

  SET @Sql = N'ALTER TABLE dbo.HOATDONGHOCTHUAT ALTER COLUMN [SLSVDuKien] NVARCHAR(225) ' + @SLSVDuKienNullable + N';';
  EXEC sys.sp_executesql @Sql;

  IF @SLSVDuKienDefaultName IS NOT NULL
  BEGIN
    SET @Sql = N'ALTER TABLE dbo.HOATDONGHOCTHUAT ADD CONSTRAINT ' + QUOTENAME(@SLSVDuKienDefaultName)
      + N' DEFAULT ' + @SLSVDuKienDefaultDefinition + N' FOR [SLSVDuKien];';
    EXEC sys.sp_executesql @Sql;
  END;
END;
