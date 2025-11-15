import { logger, LogMeta } from "src/logger"

const logMetaSocketStart: LogMeta = {
  file: "@/socket",
  target: "Socket -> start"
}

export class Socket {
  private readonly url = ""

  async start() {
    const logMeta = logMetaSocketStart
    return new Promise<void>((res, rej) => {
      const socket = new WebSocket(this.url)
      socket.onopen = () => {
        logger.info("WebSocket connection established", logMeta)
      }
      socket.onmessage = (ev) => {
        logger.info("WebSocket received message", logMeta)
      }
      socket.onerror = (ev) => {
        logger.error("WebSocket error", { ...logMeta, error: ev })
        rej()
      }
      socket.onclose = (ev) => {
        const { code, reason } = ev
        logger.info("WebSocket connection closed", { ...logMeta, code, reason })
        if (ev.wasClean) {
          console.log("WebSocket connection closed cleanly", logMeta)
        } else {
          console.log("WebSocket connection terminated due to an error", logMeta)
        }
        res()
      }
    })
  }
}