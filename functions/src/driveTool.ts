import {z} from "zod";
import {MyTool} from "./tools";
import {logger} from "firebase-functions";
import {zodToGeminiParameters} from "@langchain/google-common";

export type DriveState = {
  currentFile?: SpreadsheetInfo;
}

type DriveFileInfo = {
  id: string;
  name: string;
}

type SpreadsheetColumnType = "string" | "number" | "datetime" | "boolean";

type SpreadsheetColumnInfo = {
  columnId: string;      // headerCol
  headerName: string;
  description?: string;
  isWriteable: boolean;
  type?: SpreadsheetColumnType;
}

type SpreadsheetInfo = {
  id: string;
  name: string;         // spreadsheetName
  description: string;
  sheetId: string;      // sheetName
  column: SpreadsheetColumnInfo[];
  lastRow: number;
  currentRow: number;
}

type SpreadsheetCell = {
  columnId: string;
  metadata: SpreadsheetColumnInfo;
  value: string | number | boolean;
}

type SpreadsheetRow = {
  currentRow: number;
  column: SpreadsheetCell[];
}

type GetFilesParams = {
  search?: string;
};

type GetFilesResult = {
  files: DriveFileInfo[];
}

type OpenFileParams = {
  id: string;
}

type OpenFileResult = {
  info: SpreadsheetInfo;
}

type AddNewRowParams = {
}

/*
type SetDataParams = {
  columnIdToValueSet: Record<string, any>
}
*/
type SetDataParams = Record<string, any>

export abstract class AbstractDriveTool {

  _currentFile?: SpreadsheetInfo;

  constructor(state: DriveState) {
    this.currentFile = state.currentFile;
  }

  get currentFile(): SpreadsheetInfo | undefined {
    return this._currentFile;
  }

  set currentFile( currentFile: SpreadsheetInfo | undefined ) {
    this._currentFile = currentFile;

    const writeableZodSchema = this._writeableZodSchema();
    logger.debug( "writeableZodSchema", zodToGeminiParameters(writeableZodSchema) );
    this.setDataTool.schema = writeableZodSchema;
  }

  assertCurrentFile(): SpreadsheetInfo {
    const ret = this.currentFile;
    if( !ret ){
      throw new Error( "No file is open." );
    }
    return ret;
  }

  _writeableZodSchema(): z.AnyZodObject {

    function typeNameToZod( typeName: SpreadsheetColumnType ): z.ZodString | z.ZodNumber | z.ZodBoolean | z.ZodDate {
      switch( typeName ){
        case "datetime": return z.coerce.date();
        case "number": return z.number();
        case "boolean": return z.boolean();
        case "string": return z.string();
      }
    }

    if( this.currentFile ){
      // Build the schema for setting values
      let columnIdToValueSet: z.ZodObject<any> = z.object({});
      const column = this.currentFile?.column ?? [];
      column.forEach( col => {
        const key = col.columnId;
        const typeName = col.type;
        const headerName = col.headerName;
        if( col.isWriteable && typeName ){
          const typeZod = typeNameToZod( typeName );
          const desc = `Set the value for "${headerName}" to a ${typeName} value.`
          columnIdToValueSet = columnIdToValueSet.extend({
            [key]: typeZod.optional().describe( desc )
          })
          logger.debug( '_writeableZodSchema add', {key, headerName, typeName})
        }
      })

      /*
      const schema = z.object({
        columnIdToValueSet,
      })
      */
      const schema = columnIdToValueSet;
      return schema;
    } else {
      return z.object({});
    }
  }

  abstract getFiles(params: GetFilesParams): Promise<GetFilesResult>;
  getFilesDesc =
    `Get the files that are available, 
    including the ID that is required to open or manage the contents.
    Returns: A list of files, including the file id and name for each.`;
  getFilesTool = new MyTool({
    name: "getFiles",
    description: this.getFilesDesc,
    schema: z.object({
      search: z.string().optional().describe("Any search terms to help locate a specific subset of files to view."),
    }),
    func: async (i: GetFilesParams)=> this.getFiles(i),
  })

  abstract openFile(params: OpenFileParams): Promise<OpenFileResult>;
  async _openFile( params: OpenFileParams ): Promise<OpenFileResult> {
    const ret: OpenFileResult = await this.openFile( params );
    logger.debug("_openFile", ret);
    this.currentFile = ret.info;
    return ret;
  }
  openFileDesc =
    `Open a file so you can read and write the data in it.
    Returns: Information about the file including information about the
    schema of the file. The schema includes information about the columns
    you can work with, including the columnId (the letter used in references
    to cells in this column), the name assigned to the column, an optional
    description, if you can write to the column, and the column type.`
  openFileTool = new MyTool({
    name: "openFile",
    description: this.openFileDesc,
    schema: z.object({
      id: z.string().describe("The id of the file we should work with. You can get the id of a file from the getFiles function.")
    }),
    func: async (i:OpenFileParams) => this._openFile(i),
  })

  abstract addNewRow(params: AddNewRowParams): Promise<SpreadsheetRow>;
  async _addNewRow(params: AddNewRowParams): Promise<SpreadsheetRow> {
    const ret = await this.addNewRow(params);
    if( this.currentFile ){
      this.currentFile.currentRow = ret.currentRow;
    }
    return ret;
  }
  addNewRowDesc =
    `Add another row to the spreadsheet, copying the formulas and formatting
    from the previous row, but leaving all the fields that are writeable
    empty. Set the current row to this new row.
    Returns: The metadata and data about the row that has just been added.
    `
  addNewRowTool = new MyTool({
    name: "addNewRow",
    description: this.addNewRowDesc,
    schema: z.object({}),
    func: async (i: AddNewRowParams) => this._addNewRow(i),
  })

  abstract setData(params: SetDataParams): Promise<SpreadsheetRow>;
  setDataDesc =
    `Set the values for specified columns on the current row. You should
    specify the column, by columnId, you are setting and the value you are
    setting it to.
    Returns: The metadata and data about the row after all the data has been set.
    `
  setDataTool = new MyTool({
    name: "setData",
    description: this.setDataDesc,
    schema: z.object({}),    // This is dynamic
    func: async (i: SetDataParams) => this.setData(i),
  })

  getTools(): MyTool[] {
    return [
      this.getFilesTool,
      this.openFileTool,
      this.addNewRowTool,
      this.setDataTool,
    ]
  }

  async getDriveState(): Promise<DriveState> {
    const ret = this.currentFile
      ? {currentFile: this.currentFile}
      : {};
    logger.debug("getDriveState", ret);
    return ret;
  }
}

export class MockDriveTool extends AbstractDriveTool {

  _fileDetails( id: string ) {
    return id === 'mock-1'
      ? {name: "weight", header: "weight"}
      : {name: "height", header: "height"};
  }

  _columnInfo( headerName: string ): SpreadsheetColumnInfo[] {
    return [
      {
        columnId: "A",
        headerName: "Date",
        isWriteable: false,
        type: "datetime",
      },
      {
        columnId: "B",
        headerName: headerName,
        isWriteable: true,
        type: "number",
      },
      {
        columnId: "C",
        headerName: "change",
        isWriteable: false,
        type: "number",
      }
    ]
  }

  async getFiles(params: GetFilesParams): Promise<GetFilesResult> {
    const files: DriveFileInfo[] = [
      {
        id: "mock-1",
        name: "weight",
      },
      {
        id: "mock-2",
        name: "height",
      }
    ];
    return {
      files,
    }
  }

  async openFile(params: OpenFileParams): Promise<OpenFileResult> {
    const details = this._fileDetails( params.id );
    const info: SpreadsheetInfo = {
      id: params.id,
      name: details.name,
      description: "You are working on a spreadsheet.",
      sheetId: "sheet1",
      lastRow: 5,
      currentRow: 5,
      column: this._columnInfo( details.header ),
    }
    return {
      info,
    }
  }

  _fakeValue( valueType: SpreadsheetColumnType | undefined ): string | number | boolean {
    switch( valueType ){
      case "number":   return 10;
      case "boolean":  return true;
      case "datetime": return (new Date()).toISOString();
    }
    return "foobar";
  }

  async addNewRow(params: AddNewRowParams): Promise<SpreadsheetRow> {
    const currentFile = this.assertCurrentFile();
    const metadata = currentFile.column;
    const column: SpreadsheetCell[] = metadata.map( colinfo => {
      const value = colinfo.isWriteable
        ? ""
        : this._fakeValue( colinfo.type );
      const cell: SpreadsheetCell = {
        columnId: colinfo.columnId,
        metadata: colinfo,
        value,
      }
      return cell;
    })
    return {
      currentRow: currentFile.lastRow + 1,
      column
    }
  }

  async setData(params: SetDataParams): Promise<SpreadsheetRow> {
    return this.addNewRow(params);
  }

}

export class RemoteDriveTool extends AbstractDriveTool {

  get url(): string {
    const ret = process.env.DRIVE_SERVER_URL || "missing_env_DRIVE_SERVER_URL";
    logger.info( `RemoteDrive url=${ret}`, {url: ret} );
    return ret;
  }

  async _exec( command: string, params: any = {} ): Promise<any> {
    const url = `${this.url}?command=${command}`
    logger.debug( "_exec", {command, params} );
    const response = await fetch( url, {
      method: "POST",
      body: JSON.stringify(params),
    });
    const ret = await response.json();
    return ret;
  }

  async getFiles(params: GetFilesParams): Promise<GetFilesResult> {
    return this._exec( "list", params );
  }

  async openFile(params: OpenFileParams): Promise<OpenFileResult> {
    const info: SpreadsheetInfo = await this._exec( "info", params );
    return {
      info,
    }
  }

  async addNewRow(params: AddNewRowParams): Promise<SpreadsheetRow> {
    const currentFile = this.assertCurrentFile();
    return this._exec( "addRow", {
      id: currentFile.id,
      sheetName: currentFile.sheetId,
      copyData: false,
      ...params,
    })
  }

  async setData(params: SetDataParams): Promise<SpreadsheetRow> {
    const currentFile = this.assertCurrentFile();
    return this._exec( "setData", {
      id: currentFile.id,
      sheetName: currentFile.sheetId,
      row: currentFile.currentRow,
      //...params,
      columnIdToValueSet: params,
    })
  }

}