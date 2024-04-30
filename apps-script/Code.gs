function myFunction() {

}

function doList(params){
  console.log(`listFiles: ${params}`);
  const parentFolder = '1Id4aLMjKWtU5WgtekMzfQZqVU5zYgsTj';
  const q = `"${parentFolder}" in parents and not trashed`;
  const fields = [
    "files/id",
    "files/name",
  ].join(',');
  const fileList = Drive.Files.list({q,fields});
  console.log(fileList);
  const files = fileList?.files ?? [];
  return files;
}

/**
 * Add a query formula to this spreadsheet and return the result
 * id : The sheet id
 * desc : A description of the formula
 * formula : The formula
 */
function query( id, desc, formula ){
  const spreadsheet = SpreadsheetApp.openById( id );
  let sheet = spreadsheet.getSheetByName( 'Query' );
  if( sheet === null ){
    sheet = spreadsheet.insertSheet( 'Query' )
    sheet.appendRow(['Query time', 'Query description', 'Query formula', 'Query value']);
  }
  const row = sheet.getLastRow() + 1;
  sheet.getRange(`A${row}`).setValue( new Date() );
  sheet.getRange(`B${row}`).setValue( desc );
  const queryValue = sheet.getRange(`C${row}`).setValue( formula ).getDisplayValue();
  const ret = queryValue !== '#ERROR!' ? queryValue : sheet.getRange(`C${row}`).getValue();
  sheet.getRange(`D${row}`).setValue( ret );
  return ret;
}

function testQuery(){
  const id = '1t6rRVDUMcVV425CSmrhxKVBk2ItAslQJbV01UR6TIjQ';
  const val = query( id, 'test', '=min(Sheet1!a2' )
  console.log( val )
}

function doTest( e ){
  console.log( 'test', e )
  return({
    test: "ok",
    ...e
  })
}

function colLetter( colNum ){
  if( colNum < 26 ){
    return String.fromCharCode( colNum + 65 );
  } else {
    let msl = Math.floor(colNum / 26);
    let lsl = colNum % 26;
    return String.fromCharCode( msl + 64 )+String.fromCharCode( lsl + 65 );
  }
}

function valueToType( value ){
  const t = typeof value;
  switch( t ){
    case "string":
    case "number":
    case "boolean":
      return t;
    case "object":
      return value instanceof Date ? "datetime" : "string";
    default:
      return "string";
  }
}

function getWriteableInfo( column, formula, value ){
  const columnType = valueToType( value );
  const isFirstRowDate = column === 0 && columnType === 'datetime'
  const isWriteable = formula?.length === 0 && !isFirstRowDate;
  return {
    isFirstRowDate,
    isWriteable,
  }
}

function doSheetInfo( params ){
  console.log( 'doSheetInfo', params );
  const documentId = params.id;
  return sheetInfo( documentId );
}

function getMetadata( sheet ){
  const lastRow = sheet.getLastRow();
  const sheetWidth = sheet.getLastColumn();

  const headerRange = sheet.getRange( 1, 1, 1, sheetWidth );
  const headers = headerRange.getValues()[0];

  const firstRowRange = sheet.getRange( lastRow, 1, 1, sheetWidth );
  const formulas = firstRowRange.getFormulas()[0];
  const values = firstRowRange.getValues()[0];

  const column = [];
  for( let co=0; co<headers.length; co++ ){
    const headerName = headers[co]
    const headerCol = colLetter( co )
    const value = values[co]
    const columnType = valueToType( value );
    const formula = formulas[co];
    const {isFirstRowDate, isWriteable} = getWriteableInfo( co, formula, value );
    const columnInfo = {
      columnId: headerCol,
      headerName,
      isWriteable,
      type: columnType,
      isFirstRowDate,
    }
    column.push( columnInfo );
  }
  return column;
}

function sheetInfo( documentId ){
  const spreadsheet = SpreadsheetApp.openById( documentId );
  const sheet = spreadsheet.getSheets()[0];
  const spreadsheetName = spreadsheet.getName();
  const sheetName = sheet.getName();
  const lastRow = sheet.getLastRow();

  const column = [];
  const metadata = getMetadata( sheet );
  let ret = '';
  ret += `You are working on a spreadsheet named "${spreadsheetName}".\n`
  ret += `There is a sheet named "${sheetName}".\n`
  ret += `${sheetName} has ${lastRow} rows.\n`
  ret += 'The first row of Sheet1 contains header information.\n'
  for( let co=0; co<metadata.length; co++  ){
    const meta = metadata[co];
    const headerName = meta.headerName
    const headerCol = meta.columnId
    const columnType = meta.type
    ret += `${sheetName}, Column ${headerCol} is titled "${headerName}", contains ${columnType}`

    if( meta.isWriteable ){
      ret += ', and is writeable'
    } else if( meta.isFirstRowDate ){
      ret += ', is read-only, and is sorted'
    } else {
      ret += ', and is read-only'
    }
    ret += '.\n'

    const {isFirstRowDate, ...col} = meta;
    column.push( col );
  }

  return({
    id: documentId,
    name: spreadsheetName,
    description: ret,
    sheetId: sheetName,
    column,
    lastRow,
  })
}

function testSheetInfo(){
  const id = '1t6rRVDUMcVV425CSmrhxKVBk2ItAslQJbV01UR6TIjQ';
  const info = sheetInfo( id );
  console.log( info );

  const spreadsheet = SpreadsheetApp.openById( id );
  const sheet = spreadsheet.getSheetByName( 'Sheet1' );
  const values = sheet.getDataRange().getValues();
  console.log( values );
  values.forEach( row => {
    let rowStr = "";
    row.forEach( col => {
      const t = typeof col;
      rowStr += "\t" + t;
      if( t === "object" ){
        rowStr += " " + col.constructor.name;
        rowStr += " " + col instanceof Date;
      }
    })
    console.log( rowStr );
  })

  const formulas = sheet.getDataRange().getFormulas();
  console.log(formulas);
}

function doAddRow( params ){
  const documentId = params.id;
  const sheetName = params.sheetName;
  const copyData = params.copyData;
  const spreadsheet = SpreadsheetApp.openById( documentId );
  const sheet = spreadsheet.getSheetByName( sheetName );
  const lastRow = sheet.getLastRow()
  const newRow = lastRow + 1;
  const sheetWidth = sheet.getLastColumn();

  const ret = {
    currentRow: newRow,
    column: [],
  }

  const metadata = getMetadata( sheet );

  const lastRowRange = sheet.getRange( lastRow, 1, 1, sheetWidth );
  const newRowRange = sheet.getRange(  newRow,  1, 1, sheetWidth );
  const formulas = lastRowRange.getFormulas()[0];
  const values = lastRowRange.getValues()[0];
  const now = new Date();
  for( let co=1; co<=sheetWidth; co++ ){
    const cell = lastRowRange.getCell( 1, co );
    const newCell = newRowRange.getCell( 1, co );
    const meta = metadata[co-1];
    if( meta.isFirstRowDate ){
      newCell.setValue( now );
    } else if( copyData || !meta.isWriteable ) {
      cell.copyTo( newCell, SpreadsheetApp.CopyPasteType.PASTE_FORMULA, false );
    }
    cell.copyFormatToRange( sheet, co, co, newRow, newRow )

    const value = meta.isFirstRowDate
      ? now.toISOString()
      : newCell.getValue();
    const retCell = {
      columnId: meta.columnId,
      metadata: meta,
      value
    }
    ret.column.push( retCell );
  }

  return ret;
}

function getRow( sheet, row ){
  const metadata = getMetadata( sheet );

  const ret = {
    currentRow: row,
    column: [],
  }

  metadata.forEach( meta => {
    const columnId = meta.columnId;
    const cellId = `${columnId}${row}`;
    const cell = sheet.getRange( cellId );
    const value = cell.getValue();
    const retCell = {
      columnId,
      metadata: meta,
      value,
    }
    ret.column.push( retCell );
  })

  return ret;
}

function testAddRow(){
  const id = '1t6rRVDUMcVV425CSmrhxKVBk2ItAslQJbV01UR6TIjQ';
  const sheetName = 'Sheet1';
  const copyData = false;
  const row = doAddRow({
    id,
    sheetName,
    copyData,
  })
  console.log(row)
}

function doSetData( params ){
  const documentId = params.id;
  const sheetName = params.sheetName;
  const spreadsheet = SpreadsheetApp.openById( documentId );
  const sheet = spreadsheet.getSheetByName( sheetName );

  const row = params.row;
  const columnIdToValueSet = params.columnIdToValueSet;
  const columnIds = Object.keys( columnIdToValueSet );
  columnIds.forEach( columnId => {
    const value = columnIdToValueSet[columnId];
    const cellId = `${columnId}${row}`;
    const cell = sheet.getRange(cellId);
    cell.setValue( value );
  })
  return getRow( sheet, row );
}

function testSetData(){
  const id = '1t6rRVDUMcVV425CSmrhxKVBk2ItAslQJbV01UR6TIjQ';
  const sheetName = 'Sheet1';
  const spreadsheet = SpreadsheetApp.openById( id );
  const sheet = spreadsheet.getSheetByName( sheetName );
  const row = sheet.getLastRow();

  const ret = doSetData({
    id,
    sheetName,
    row,
    columnIdToValueSet: {
      C: 42,
      E: "Answer",
    }
  })
  console.log( ret );
}

function doGetData( params ){
  const documentId = params.id;
  const sheetName = params.sheetName;
  const spreadsheet = SpreadsheetApp.openById( documentId );
  const sheet = spreadsheet.getSheetByName( sheetName );

  const row = params.row;
  return getRow( sheet, row );
}

function testGetData(){
  const id = '1t6rRVDUMcVV425CSmrhxKVBk2ItAslQJbV01UR6TIjQ';
  const sheetName = 'Sheet1';
  const spreadsheet = SpreadsheetApp.openById( id );
  const sheet = spreadsheet.getSheetByName( sheetName );
  const row = sheet.getLastRow();

  const ret = doGetData({
    id,
    sheetName,
    row,
  })
  console.log( ret );
}

function doWhatIf( params ){
  const add = doAddRow({
    ...params,
    copyData: true,
  })
  const row = add.currentRow;
  const ret = doSetData({
    ...params,
    row,
  })
  return ret;
}

function testWhatIf(){
  const id = '16bhbIUyrFRj-2lBJpHtBCXnpnADqfM5Y4mP1IC22M88';
  const sheetName = 'Sheet1';
  columnIdToValueSet = {
    B: 6,
  }
  const ret = doWhatIf({
    id,
    sheetName,
    columnIdToValueSet
  })
  console.log( ret );
}

function doQuery( e ){
  console.log( 'doQuery', e );
  const documentId = e.parameter.document;
  const desc = e.parameter.description;
  const formula = e.parameter.formula;
  const result = query( documentId, desc, formula )

  return({
    desc,
    formula,
    result
  })
}

function doCmd( e ){
  console.log(e?.postData)
  const body = JSON.parse(e?.postData?.contents ?? "{}");
  switch( e?.parameter?.command ){
    case 'test':    return doTest( body )
    case 'list':    return doList( body )
    case 'info':    return doSheetInfo( body )
    case 'addRow':  return doAddRow( body )
    case 'setData': return doSetData( body )
    case 'getData': return doGetData( body )
    case `whatIf`:  return doWhatIf( body )
    case 'query':   return doQuery( e )  // TODO: Bring to current spec
    default: return({
      error: "Command not found: "+e?.parameter?.command
    })
  }
}

function doRun( method, e ){
  const ret = doCmd( e )
  const message = `${method} ${e?.parameter?.command}`
  console.log({message, request:e, response: ret})
  return ContentService.createTextOutput(JSON.stringify(ret))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e){
  return doRun( 'get', e );
}

function doPost(e){
  console.log('doPost');
  return doRun( 'post', e );
}
