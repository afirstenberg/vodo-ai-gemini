function myFunction() {

}

function sheetInfo(){
  const id = '1t6rRVDUMcVV425CSmrhxKVBk2ItAslQJbV01UR6TIjQ';
  const spreadsheet = SpreadsheetApp.openById( id );
  const sheet = spreadsheet.getSheetByName( 'Sheet1' );
  const values = sheet.getDataRange().getValues();
  console.log( values );
  const formulas = sheet.getDataRange().getFormulas();
  console.log(formulas);
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

function doSheetInfo( e ){
  console.log( 'doSheetInfo', e );
  const documentId = e.parameter.document;
  const spreadsheet = SpreadsheetApp.openById( documentId );
  const sheet = spreadsheet.getSheets()[0];
  const spreadsheetName = spreadsheet.getName();
  const sheetName = sheet.getName();
  const sheetSize = sheet.getLastRow();
  const sheetWidth = sheet.getLastColumn();
  const range = sheet.getRange( 1, 1, 1, sheetWidth );
  const headers = range.getValues()[0];

  let ret = '';
  ret += `You are working on a spreadsheet named "${spreadsheetName}".\n`
  ret += `There is a sheet named "${sheetName}".\n`
  ret += `${sheetName} has ${sheetSize} rows.\n`
  ret += 'The first row of Sheet1 contains header information.\n'
  for( let co=0; co<headers.length; co++  ){
    const headerName = headers[co]
    const headerCol = colLetter( co )
    ret += `${sheetName}, Column ${headerCol} is titled "${headerName}"`
    if( co === 0 ){
      ret += ' contains datetime and is sorted.\n'
    } else {
      ret += '.\n'
    }
  }

  return({
    info: ret,
    spreadsheetName,
    sheetName,
    sheetSize,
    headers
  })
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
  switch( e?.parameter?.command ){
    case 'test':  return doTest( e )
    case 'info':  return doSheetInfo( e )
    case 'query': return doQuery( e )
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
  return doRun( 'post', e );
}
