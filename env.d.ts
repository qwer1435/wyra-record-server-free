declare namespace NodeJS {
  interface ProcessEnv {
    readonly _MODE: "DEV" | "PROD"
    readonly TWITCH_CLIENT_ID: string
    readonly TWITCH_CLIENT_SECRET: string
  }
}