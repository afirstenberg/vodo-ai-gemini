import {z} from "zod";
import {MyTool} from "./tools";
import {logger} from "firebase-functions";

export type DriveState = {
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

export abstract class AbstractDriveTool {

  constructor(state: DriveState) {
    // TODO: Implement state
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
    func: async (i:OpenFileParams) => this.openFile(i),
  })

  getTools(): MyTool[] {
    return [
      this.getFilesTool,
      this.openFileTool,
    ]
  }

  async getDriveState(): Promise<DriveState> {
    return {};
  }
}

export class MockDriveTool extends AbstractDriveTool {

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
    const values = params.id === 'mock-1'
      ? {name: "weight", header: "weight"}
      : {name: "height", header: "height"};
    const info: SpreadsheetInfo = {
      id: params.id,
      name: values.name,
      description: "You are working on a spreadsheet.",
      sheetId: "sheet1",
      lastRow: 5,
      currentRow: 5,
      column: [
        {
          columnId: "A",
          headerName: "Date",
          isWriteable: false,
          type: "datetime",
        },
        {
          columnId: "B",
          headerName: values.header,
          isWriteable: true,
          type: "number",
        },
        {
          columnId: "C",
          headerName: "change",
          isWriteable: false,
          type: "number",
        }
      ],
    }
    return {
      info,
    }
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
    return this._exec( "info", params );
  }

}