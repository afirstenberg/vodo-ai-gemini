import {GoogleConnectionParams, GoogleHostConnection, GoogleResponse} from "@langchain/google-common";
import {GAuthClient} from "./auth";
import {AsyncCaller, AsyncCallerCallOptions} from "@langchain/core/utils/async_caller";

export interface TtsInputText {
  text: string;
}

export interface TtsInputSsml {
  ssml: string;
}

export type TtsInput = TtsInputText | TtsInputSsml;

export type TtsSsmlVoiceGender = "MALE" | "FEMALE" | "NEUTRAL";

export interface TtsVoiceSelection {
  languageCode: string;
  name?: string;
  ssmlGender?: TtsSsmlVoiceGender;
  // Custom voice not supported
}

export type TtsAudioEncoding =
  "LINEAR16" |
  "MP3" |
  "OGG_OPUS" |
  "MULAW" |
  "ALAW";

export interface TtsAudioConfig {
  "audioEncoding": TtsAudioEncoding;
  "speakingRate"?: number;
  "pitch"?: number;
  "volumeGainDb"?: number;
  "sampleRateHertz"?: number;
  "effectsProfileId"?: string[];
}

export interface TtsRequest {
  input: TtsInput;
  voice: TtsVoiceSelection;
  audioConfig: TtsAudioConfig;
}

export interface TtsResponse extends GoogleResponse {
  data: {
    audioContent: string;
  }
}

export interface TtsConnectionParams extends GoogleConnectionParams<GAuthClient> {
}

export class TtsConnection extends GoogleHostConnection<any, TtsResponse, GAuthClient> {

  endpoint = "texttospeech.googleapis.com";

  apiVersion = "v1";


  async buildUrl(): Promise<string> {
    return `https://${this.endpoint}/${this.apiVersion}/text:synthesize`;
  }

  async request(
    input: TtsRequest,
    options: AsyncCallerCallOptions
  ): Promise<TtsResponse> {
    const response = await this._request(input, options);
    return response;
  }

}

export async function makeAudio( textOrSsml: string ): Promise<string> {
  const fields: GoogleConnectionParams<GAuthClient> = {};
  const caller: AsyncCaller = new AsyncCaller({});
  const authOptions = {};
  const client = new GAuthClient( authOptions );
  const connection = new TtsConnection(
    fields,
    caller,
    client,
  );

  const options: AsyncCallerCallOptions = {
  }

  const input = textOrSsml.trim().startsWith("<")
    ? {ssml: textOrSsml}
    : {text: textOrSsml};
  const request: TtsRequest = {
    input,
    voice: {
      languageCode: "en-us"
    },
    audioConfig: {
      audioEncoding: "MP3"
    }
  }
  const response = await connection.request( request, options );
  const audio64 = response?.data?.audioContent;
  return audio64;
}
