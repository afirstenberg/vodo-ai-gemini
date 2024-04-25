import {DynamicStructuredTool, DynamicStructuredToolInput} from "@langchain/core/tools";
import {z} from "zod";

export interface MyToolInput<
  T extends z.ZodObject<any, any, any, any> = z.ZodObject<any, any, any, any>
> extends DynamicStructuredToolInput {
  func: (
    input: z.infer<T>,
  ) => Promise<any>;
}

export class MyTool extends DynamicStructuredTool {
  constructor(input: MyToolInput) {
    super({
      name: input.name,
      description: input.description,
      schema: input.schema,
      func: async (i) => {
        const result = await input.func(i);
        const ret = JSON.stringify(result);
        console.log(`function ${input.name}: ${JSON.stringify(i)} -> ${ret}`);
        return ret;
      }
    });
  }
}

const mem: Record<string,any> = {};

type getValueType = {
  name: string;
}
async function getValue({name}: getValueType): Promise<string> {
  return mem[name] ?? "";
}
export const getValueTool = new MyTool({
  name: "getValue",
  description: "Given a name, look up or get the value assigned to that name",
  schema: z.object({
    name: z.string().describe("The key that references the value.")
  }),
  func: getValue,
});

type putValueType = {
  name: string;
  value: string;
}
async function putValue({name, value}: putValueType): Promise<Record<string,any>> {
  mem[name] = value;
  return mem;
}
export const putValueTool = new MyTool({
  name: "putValue",
  description: "Given a name and a new value, set or change the value as assigned to that name. This returns the full environment with this value set. It is good for both setting values and testing out what-if scenarios.",
  schema: z.object({
    name: z.string().describe("The key whose value is being set"),
    value: z.string().describe("The new value to set"),
  }),
  func: putValue,
})
