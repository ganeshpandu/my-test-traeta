CREATE OR REPLACE FUNCTION public.updateentity(
  dbschema TEXT,       -- schema name (e.g. 'public')
  tbl TEXT,            -- table name (e.g. 'Users')
  updatedata JSONB,
  criteria JSONB,
  requestid TEXT,
  username TEXT
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    col_name TEXT;
    col_value TEXT;
    whereString TEXT := '';
    latestRecCriteria TEXT;
    lastIndex INT;
    recSeq INT;
    recStatus TEXT;
    endDate DATE;
    updateString TEXT := '';
    columns_list TEXT;
    dynasql TEXT;
    jsonResult JSONB;
    colExists INT;
    response JSONB;
BEGIN
    -- log begin
    INSERT INTO "Logtable" VALUES (DEFAULT, requestId, 'Begin Request');
    INSERT INTO "Logtable" VALUES (DEFAULT, requestId, 'updateData: ' || updateData::TEXT || ' ; Criteria: ' || criteria::TEXT);

    -- validate updateData columns
    FOR col_name IN SELECT jsonb_object_keys(updateData) LOOP
        SELECT COUNT(*) INTO colExists
        FROM information_schema.columns
        WHERE table_schema = dbschema
          AND table_name = tbl
          AND lower(column_name) = lower(col_name);

        IF colExists = 0 THEN
            INSERT INTO "Logtable" VALUES (DEFAULT, requestId, 'Column does not exist: ' || col_name);
            response := jsonb_build_object('status', 400, 'message', 'Unknown column: ' || col_name);
            RETURN response;
        END IF;
    END LOOP;

    -- build WHERE clause from criteria
    whereString := '';
    FOR col_name IN SELECT jsonb_object_keys(criteria) LOOP
        SELECT criteria ->> col_name INTO col_value;
        IF whereString = '' THEN
            whereString := format('%I = %L', col_name, col_value);
        ELSE
            whereString := whereString || ' AND ' || format('%I = %L', col_name, col_value);
        END IF;
    END LOOP;

    latestRecCriteria := whereString || ' AND "recSeq" = 0';

    -- get list of columns for dynamic sql (all table columns)
    SELECT string_agg(quote_ident(column_name), ', ')
    INTO columns_list
    FROM information_schema.columns
    WHERE table_schema = dbschema
      AND table_name = tbl;

    -- get last recSeq
    dynasql := format('SELECT max("recSeq") FROM %I.%I WHERE %s', dbschema, tbl, whereString);
    EXECUTE dynasql INTO lastIndex;

    IF lastIndex IS NULL THEN
        INSERT INTO "Logtable" VALUES (DEFAULT, requestId, 'Bad Request');
        response := jsonb_build_object('status', 500, 'message', 'Record not found for the given criteria');
        RETURN response;
    END IF;

    recSeq := lastIndex + 1;
    recStatus := 'I';
    endDate := CURRENT_DATE;

    -- insert history record (override recSeq + recStatus)
    dynasql := format(
      'INSERT INTO %I.%I (%s)
       SELECT %s FROM %I.%I WHERE %s',
      dbschema, tbl,
      columns_list,
      regexp_replace(
        regexp_replace(columns_list, '"recSeq"', recSeq::text, 'gi'),
        '"recStatus"', quote_literal(recStatus), 'gi'
      ),
      dbschema, tbl, latestRecCriteria
    );
    EXECUTE dynasql;

    -- build update string
    updateString := '';
    FOR col_name IN SELECT jsonb_object_keys(updateData) LOOP
        SELECT updateData ->> col_name INTO col_value;
        IF updateString = '' THEN
            updateString := format('%I = %L', col_name, col_value);
        ELSE
            updateString := updateString || ', ' || format('%I = %L', col_name, col_value);
        END IF;
    END LOOP;

    updateString := updateString || ', "recStatus" = ''A''';

    -- perform update
    dynasql := format('UPDATE %I.%I SET %s WHERE %s', dbschema, tbl, updateString, latestRecCriteria);
    EXECUTE dynasql;

    -- fetch updated row as JSON
    dynasql := format(
      'SELECT row_to_json(t)::jsonb 
       FROM (SELECT %s FROM %I.%I WHERE %s) t',
      columns_list, dbschema, tbl, latestRecCriteria
    );
    EXECUTE dynasql INTO jsonResult;

    response := jsonb_build_object('status', 200, 'message', jsonResult);
    RETURN response;

EXCEPTION
    WHEN OTHERS THEN
        response := jsonb_build_object('status', 400, 'message', SQLERRM);
        INSERT INTO "Logtable" VALUES (DEFAULT, requestId, 'Error: ' || SQLERRM);
        RETURN response;
END;
$$;
