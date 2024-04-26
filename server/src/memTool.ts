import {z} from "zod";
import {MyTool} from "./tools";

type getValueType = {
  name: string;
}
type putValueType = {
  name: string;
  value: string;
}

export class MemTool {

  mem: Record<string, any> = {};

  async getValue({name}: getValueType): Promise<string> {
    return this.mem[name] ?? "";
  }

  getValueTool = new MyTool({
    name: "getValue",
    description: "Given a name, look up or get the value assigned to that name",
    schema: z.object({
      name: z.string().describe("The key that references the value.")
    }),
    func: async (params: getValueType) => this.getValue(params),
  });

  async putValue({name, value}: putValueType): Promise<Record<string, any>> {
    this.mem[name] = value;
    return this.mem;
  }

  putValueTool = new MyTool({
    name: "putValue",
    description: "Given a name and a new value, set or change the value as assigned to that name. This returns the full environment with this value set. It is good for both setting values and testing out what-if scenarios.",
    schema: z.object({
      name: z.string().describe("The key whose value is being set"),
      value: z.string().describe("The new value to set"),
    }),
    func: async (params: putValueType) => this.putValue(params),
  });

  getTools(): MyTool[] {
    return [
      this.getValueTool,
      this.putValueTool,
    ]
  }
}