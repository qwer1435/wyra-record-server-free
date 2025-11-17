import { ApiClient } from "@twurple/api";
import { RefreshingAuthProvider } from "@twurple/auth";
import { env } from "process";
import { z } from "zod"
import dotenv from "dotenv"
import { parse as parseHls } from "hls-parser"
import { Variant as HlsStreamVariant } from "hls-parser/types";
import Ffmpeg, { FfmpegCommand } from "fluent-ffmpeg";
import { Mixin } from "ts-mixer";
import Stream, { EventEmitter } from "stream";
import path from "path";

dotenv.config({ quiet: true })

export const errors = {
  userOffline: "User offline"
}

async function getClient(): Promise<ApiClient> {
  const authProvider = new RefreshingAuthProvider({ clientId: env.TWITCH_CLIENT_ID, clientSecret: env.TWITCH_CLIENT_SECRET })
  const client = new ApiClient({ authProvider })
  return client
}

export async function isOnline(name: string): Promise<boolean> {
  const client = await getClient()

  const stream = await client.streams.getStreamByUserName(name)
  const isOnline = !!stream

  return isOnline
}

export async function getSiteClientId(): Promise<string> {
  const res = await fetch("https://www.twitch.tv", {
    method: "GET"
  })
  const body = await res.text()
  if (!res.ok) {
    throw new Error()
  }

  const match = body.match(/clientId="([A-Za-z0-9]+)"/)
  const clientId = match?.at(1)
  if (!clientId) {
    throw new Error()
  }

  return clientId
}

export const PlaybackAccessTokenZod = z.object({
  value: z.string(),
  signature: z.string(),
})
export type PlaybackAccessToken = z.infer<typeof PlaybackAccessTokenZod>
export const PlaybackAccessTokenResponseZod = z.array(
  z.object({
    data: z.object({
      streamPlaybackAccessToken: z.object({
        __typename: z.string().regex(/^PlaybackAccessToken$/)
      }).and(PlaybackAccessTokenZod)
    }),
    extensions: z.object({
      durationMilliseconds: z.number(),
      operationName: z.string().regex(/^PlaybackAccessToken$/),
      requestID: z.string()
    })
  })
)
export type PlaybackAccessTokenResponse = [
  z.infer<typeof PlaybackAccessTokenResponseZod.element> & {
    data: { streamPlaybackAccessToken: { __typename: "PlaybackAccessToken" } },
    extensions: { operationName: "PlaybackAccessToken" }
  }
]
export async function getPlaybackAccessToken(name: string): Promise<PlaybackAccessToken | undefined> {
  const _isOnline = await isOnline(name)

  if (!_isOnline) {
    return undefined
  }

  const clientId = await getSiteClientId()  
  const res = await fetch("https://gql.twitch.tv/gql", {
    method: "POST",
    headers: {
      "Client-ID": clientId
    },
    body: JSON.stringify([{
      operationName: "PlaybackAccessToken",
      extensions: {
        persistedQuery: {
          version: 1,
          sha256Hash: "0828119ded1c13477966434e15800ff57ddacf13ba1911c129dc2200705b0712",
        },
      },
      variables: {
        isLive: true,
        login: name,
        isVod: false,
        vodID: "",
        playerType: "embed",
      },
    }]),
  })

  const body = await res.json()
  if (!res.ok) {
    throw new Error(`body: ${JSON.stringify(body, null, 2)}`)
  }
  
  const parsedBody = PlaybackAccessTokenResponseZod.parse(body)
  const data = parsedBody as PlaybackAccessTokenResponse

  return data[0].data.streamPlaybackAccessToken
}

export async function getHlsStreamVariants(name: string): Promise<HlsStreamVariant[] | undefined> {
  const playbackAccessToken = await getPlaybackAccessToken(name)

  if (!playbackAccessToken) {
    return undefined
  }

  const params = new URLSearchParams({
    supported_codecs: "av1,h264",
    sig: playbackAccessToken.signature,
    token: playbackAccessToken.value
  })
  const res = await fetch(`https://usher.ttvnw.net/api/channel/hls/${name}.m3u8?${params.toString()}`, { method: "GET" })
  const body = await res.text()
  if (!res.ok) {
    throw new Error(`body: ${JSON.stringify(body, null, 2)}`)
  }
  
  const hls = parseHls(body)
  if (!hls.isMasterPlaylist) {
    throw new Error()
  }

  return hls.variants
}

export interface RecordEventMap {
  start: []
  progress: [{
    frames: number
    currentFps: number
    currentKbps: number
    targetSize: number
    timemark: string
    percent?: number | undefined
  }]
  error: [Error]
  end: []
}
// export interface Record extends EventEmitter<RecordEventMap> {}
// @mix(EventEmitter)
export class Record extends Mixin(EventEmitter<RecordEventMap>) {
  private _command: FfmpegCommand | null = null
  private _isRecording = false
  private _stopSignal = "SIGINT"
  public get isRecording() {
    return this._isRecording
  }
  name: string
  target: string | Stream.Writable
  
  constructor(name: string, directory: string)
  constructor(name: string, stream: Stream.Writable)
  constructor(name: string, target: string | Stream.Writable) {
    super()
    this.name = name
    this.target = target
  }

  async start(): Promise<void> {
    try {
    if (this._isRecording) {
      throw new Error
    }
    this._isRecording = true

    const variants = await getHlsStreamVariants(this.name)
    if (!variants) {
      throw new Error
    }
    if (variants.length < 1) {
      throw new Error
    }

    const bestVariant = variants.toSorted((a, b) => (b.resolution?.height || 0) - (a.resolution?.height || 0))[0]
    const uri = bestVariant.uri

    const command = Ffmpeg()
    this._command = command

    command
    .on("start", () => {
      this.emit("start")
    })
    .on("progress", (progress) => {
      this.emit("progress", progress)
    })
    .on("error", (error) => {
      this._command = null
      this._isRecording = false
      if (error.message.includes(this._stopSignal)) {
        this.emit("end")
        return
      }
      this.emit("error", error)
    })
    .on("end", () => {
      this._command = null
      this._isRecording = false
      this.emit("end")
    })
    
    command
    .input(uri)
    .videoCodec("copy")
    .audioCodec("copy")
    if (typeof this.target === "string") {
      command
      .format("hls")
      .outputOptions([
        "-hls_list_size 0",
        "-hls_time 10",
        `-hls_segment_filename ${path.join(this.target, "%d.ts")}`,
      ])
      .output(path.join(this.target, "playlist.m3u8"))
    } else {
      command
      .outputFormat("mpegts")
      .output(this.target)
    }
    
    command.run()
    } catch(error) {
      this._isRecording = false
      throw error
    }
  }

  async stop(): Promise<void> {
    if (this._command && this._isRecording) {
      this._command.kill(this._stopSignal)
      return
    }

    throw new Error()
  }
}