import Winston from "winston"
import { env } from "process"
import dotenv from "dotenv"

dotenv.config({ quiet: true })

const transports = [
  new Winston.transports.Console({ level: env._MODE === "DEV" ? "DEBUG" : "INFO" }),
  new Winston.transports.File({ dirname: "logs", filename: "info.log", level: "INFO" }),
  new Winston.transports.File({ dirname: "logs", filename: "error.log", level: "ERROR" })
]
if (env.MODE === "DEV") {
  transports.push(
    new Winston.transports.File({ dirname: "logs", filename: "debug.log", level: "DEBUG" })
  )
}

export const logger = Winston.createLogger({
  level: "DEBUG",
  transports,
  format: Winston.format.combine(
    Winston.format.json(),
    Winston.format.timestamp(),
    Winston.format.metadata()
  )
})

export interface LogMeta {
  file: string,
  target: string
}