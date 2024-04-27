import {DynamicStructuredTool, DynamicStructuredToolInput} from "@langchain/core/tools";
import {z} from "zod";
import * as logger from "firebase-functions/logger";

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
        logger.debug(`function call ${input.name}`, {i, result});
        return ret;
      }
    });
  }
}

