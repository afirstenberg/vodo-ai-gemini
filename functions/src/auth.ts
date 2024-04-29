/**
 * Taken from google-gauth since they don't seem to be exported correctly
 */
import {GoogleAbstractedClient, GoogleAbstractedClientOps, JsonStream} from "@langchain/google-common";
import {Readable} from "stream";
import {GoogleAuth, GoogleAuthOptions} from "google-auth-library";

class NodeJsonStream extends JsonStream {
  constructor(data: Readable) {
    super();

    data.on("data", (data) => this.appendBuffer(data.toString()));
    data.on("end", () => this.closeBuffer());
  }
}

export class GAuthClient implements GoogleAbstractedClient {
  gauth: GoogleAuth;

  constructor(authOptions: GoogleAuthOptions) {
    this.gauth = new GoogleAuth(authOptions);
  }

  get clientType(): string {
    return "gauth";
  }

  async getProjectId(): Promise<string> {
    return this.gauth.getProjectId();
  }

  async request(opts: GoogleAbstractedClientOps): Promise<unknown> {
    try {
      const ret = await this.gauth.request(opts);
      return opts.responseType !== "stream"
        ? ret
        : {
          ...ret,
          data: new NodeJsonStream(ret.data),
        };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (xx: any) {
      console.error("call to gauth.request", JSON.stringify(xx, null, 2));
      console.error(
        "call to gauth.request opts=",
        JSON.stringify(opts, null, 2)
      );
      console.error("call to gauth.request message:", xx?.message);
      throw xx;
    }
  }
}
