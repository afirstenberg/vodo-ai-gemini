import {
  GoogleConnectionParams,
  GoogleHostConnection,
  GoogleResponse
} from "@langchain/google-common";
import {AsyncCaller, AsyncCallerCallOptions} from "@langchain/core/utils/async_caller";
import {logger} from "firebase-functions";
import {GAuthClient} from "./auth";


export interface SttRecognitionFeatures {
  profanityFilter?: boolean;
  enableWordTimeOffsets?: boolean;
  enableWordConfidence?: boolean;
  enableSpokenPunctuation?: boolean;
  enableSpokenEmojis?: boolean;
  maxAlternatives?: number;
  // Some fields missing
}

export interface SttEntry {
  search: string;
  replace: string;
  caseSensitive: boolean;
}

export interface SttTranscriptNormalization {
  entries: SttEntry[];
}

export interface SttRecognitionConfig {
  model?: string;
  languageCodes?: string[];
  features?: SttRecognitionFeatures;
  // adaptation?: SttSpeechAdaptation;
  transcriptNormalization?: SttTranscriptNormalization;
  autoDecodingConfig: {};
  // Some fields missing
}

export interface SttRecognitionRequest {
  config: SttRecognitionConfig;
  configMask?: string;
  content: string;   // Base64 encoded
  // Not supporting uri at the moment
}

export interface SttWordInfo {
  "startOffset": string;
  "endOffset": string;
  "word": string;
  "confidence": number;
  "speakerLabel": string;
}

export interface SttAlternative {
  transcript: string;
  confidence: number;
  words: SttWordInfo[];
}

export interface SttResult {
  alternatives: SttAlternative[];
  channelTag: number;
  resultEndOffset: string;
  languageCode: string;
}

export interface SttResponseMetadata {
  totalBilledDuration: string;
}

export interface SttResponse extends GoogleResponse {
  data: {
    results: SttResult[];
    metadata: SttResponseMetadata;
  }
}

export interface SttRecognitionConnectionParams extends GoogleConnectionParams<GAuthClient> {
}

export class SttRecognitionConnection extends GoogleHostConnection<any, SttResponse, GAuthClient> {

  endpoint = "speech.googleapis.com";

  location = "global";

  apiVersion = "v2";

  recognizer = "_";

  async buildUrl(): Promise<string> {
    const projectId = await this.client.getProjectId();
    const recognizer = `projects/${projectId}/locations/${this.location}/recognizers/${this.recognizer}`;
    return `https://${this.endpoint}/${this.apiVersion}/${recognizer}:recognize`
  }

  async request(
    input: SttRecognitionRequest,
    options: AsyncCallerCallOptions
  ): Promise<SttResponse> {
    const response = await this._request(input, options);
    return response;
  }

}

export async function transcribe( audio64: string ): Promise<string> {
  const fields: GoogleConnectionParams<GAuthClient> = {};
  const caller: AsyncCaller = new AsyncCaller({});
  const authOptions = {};
  const client = new GAuthClient( authOptions );
  const connection = new SttRecognitionConnection(
    fields,
    caller,
    client,
  );

  const options: AsyncCallerCallOptions = {
  }

  const request: SttRecognitionRequest = {
    config: {
      model: "short",
      languageCodes: ["en-US"],
      autoDecodingConfig: {},
    },
    content: audio64,
  }
  const response = await connection.request( request, options );
  logger.debug("transcribe response data", response?.data);
  const msg = response?.data?.results?.[0]?.alternatives?.[0]?.transcript;
  return msg;
}