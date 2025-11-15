import { isOnline, getPlaybackAccessToken, getSiteClientId, getHlsStreamVariants, Record } from "src/twitch"
import "jest-extended"
import { offlineStreamer, invalidStreamer, onlineStreamer } from "src/test-vars"
import { Writable } from "stream"

describe("twitch", () => {
  describe("function " + isOnline.name, () => {
    test("Testing with online user", async() => {
      const _isOnline = await isOnline(onlineStreamer)

      expect(_isOnline).toBeTrue()
    })

    test("Testing with offline user", async() => {
      const _isOnline = await isOnline(offlineStreamer)

      expect(_isOnline).toBeFalse()
    })
    
    test("Testing with incorrect user", async() => {
      const _isOnline = isOnline(invalidStreamer)

      await expect(_isOnline).toReject()
    })
  })
  
  describe("function " + getSiteClientId.name, () => {
    test("Testing", async() => {
      const clientId = await getSiteClientId()

      expect(clientId).toBeString()
    })
  })
  
  describe("function " + getPlaybackAccessToken.name, () => {
    test("Testing with online user", async() => {
      const hls = await getPlaybackAccessToken(onlineStreamer)

      expect(hls).toBeObject()
    })

    test("Testing with offline user", async() => {
      const hls = await getPlaybackAccessToken(offlineStreamer)

      expect(hls).toBeUndefined()
    })
    
    test("Testing with incorrect user", async() => {
      const hls = getPlaybackAccessToken(invalidStreamer)

      await expect(hls).toReject()
    })
  })

  describe("function " + getHlsStreamVariants.name, () => {
    test("Testing with online user", async() => {
      const variants = await getHlsStreamVariants(onlineStreamer)

      expect(variants).toBeArray()
    })

    test("Testing with offline user", async() => {
      const variants = await getHlsStreamVariants(offlineStreamer)

      expect(variants).toBeUndefined()
    })

    test("Testing with incorrect user", async() => {
      const variants = getHlsStreamVariants(invalidStreamer)

      await expect(variants).toReject()
    })
  })

  describe("class " + Record.name, () => {
    test("Testing with online user", async() => {
      let stream = new Writable()
      let record = new Record(onlineStreamer, stream)
      
      const start = record.start()
      await expect(start).toResolve()

      await expect(new Promise<void>((res, rej) => {
        record.once("start", res)
        setTimeout(rej, 10000)
      })).toResolve()

      await expect(new Promise<void>(async(res, rej) => {
        record.once("progress", () => res())
        setTimeout(rej, 5000)
      })).toResolve()
      await expect(new Promise<void>(async(res, rej) => {
        record.once("error", () => res())
        setTimeout(rej, 5000)
      })).toReject()

      const stop = record.stop()
      await expect(stop).toResolve()

      await expect(new Promise<void>((res, rej) => {
        record.once("end", res)
        setTimeout(rej, 5000)
      })).toResolve()

      stream.end()
    })
  })
})