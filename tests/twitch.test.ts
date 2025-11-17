import { isOnline, getPlaybackAccessToken, getSiteClientId, getHlsStreamVariants, Record } from "src/twitch"
import "jest-extended"
import { twitchOfflineStreamer, twitchInvalidStreamer, twitchOnlineStreamer } from "root/test-vars"
import { Writable } from "stream"
import { mkdirSync, readdirSync, rmSync } from "fs"
import path from "path"

describe("twitch", () => {
  describe("function " + isOnline.name, () => {
    test("Testing with online user", async() => {
      const _isOnline = await isOnline(twitchOnlineStreamer)

      expect(_isOnline).toBeTrue()
    })

    test("Testing with offline user", async() => {
      const _isOnline = await isOnline(twitchOfflineStreamer)

      expect(_isOnline).toBeFalse()
    })
    
    test("Testing with incorrect user", async() => {
      const _isOnline = isOnline(twitchInvalidStreamer)

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
      const hls = await getPlaybackAccessToken(twitchOnlineStreamer)

      expect(hls).toBeObject()
    })

    test("Testing with offline user", async() => {
      const hls = await getPlaybackAccessToken(twitchOfflineStreamer)

      expect(hls).toBeUndefined()
    })
    
    test("Testing with incorrect user", async() => {
      const hls = getPlaybackAccessToken(twitchInvalidStreamer)

      await expect(hls).toReject()
    })
  })

  describe("function " + getHlsStreamVariants.name, () => {
    test("Testing with online user", async() => {
      const variants = await getHlsStreamVariants(twitchOnlineStreamer)

      expect(variants).toBeArray()
    })

    test("Testing with offline user", async() => {
      const variants = await getHlsStreamVariants(twitchOfflineStreamer)

      expect(variants).toBeUndefined()
    })

    test("Testing with incorrect user", async() => {
      const variants = getHlsStreamVariants(twitchInvalidStreamer)

      await expect(variants).toReject()
    })
  })

  describe("class " + Record.name, () => {
    const startTimeout = 10000
    const workTimeout = 11000
    const stopTimeout = 5000
    const testTimeout = startTimeout + workTimeout + stopTimeout + 10000
    describe("Testing with online user", () => {
      test("save to pipe", async() => {
        let stream = new Writable()
        stream._write = () => {}
        let record = new Record(twitchOnlineStreamer, stream)
        
        const startEvent = new Promise<void>((res, rej) => {
          record.once("start", () => {
            res()
          })
          setTimeout(rej, startTimeout)
        })
        const start = record.start()
        await Promise.all([
          expect(startEvent).toResolve(),
          expect(start).toResolve()
        ])

        const progressEvent = new Promise<void>(async(res, rej) => {
          record.once("progress", () => {
            res()
          })
          setTimeout(rej, workTimeout)
        })
        const errorEvent = new Promise<void>(async(res, rej) => {
          record.once("error", (error) => {
            console.error(error)
            res()
          })
          setTimeout(rej, workTimeout)
        })
        await Promise.all([
          expect(progressEvent).toResolve(),
          expect(errorEvent).toReject()
        ])

        const stopEvent = new Promise<void>((res, rej) => {
          record.once("end", () => {
            res()
          })
          setTimeout(rej, stopTimeout)
        })
        const stop = record.stop()
        await Promise.all([
          expect(stopEvent).toResolve(),
          expect(stop).toResolve()
        ])

        !stream.closed && stream.end()
        stream = record = undefined as any
      }, testTimeout)
      
      test("save to directory", async() => {
        const directory = path.join("tests", "data", path.basename(__filename))
        mkdirSync(directory, { recursive: true })
        let record = new Record(twitchOnlineStreamer, directory)
        
        const startEvent = new Promise<void>((res, rej) => {
          record.once("start", () => {
            res()
          })
          setTimeout(rej, startTimeout)
        })
        const start = record.start()
        await Promise.all([
          expect(startEvent).toResolve(),
          expect(start).toResolve()
        ])

        const progressEvent = new Promise<void>(async(res, rej) => {
          record.once("progress", () => {
            res()
          })
          setTimeout(rej, workTimeout)
        })
        const errorEvent = new Promise<void>(async(res, rej) => {
          record.once("error", (error) => {
            console.error(error)
            res()
          })
          setTimeout(rej, workTimeout)
        })
        await Promise.all([
          expect(progressEvent).toResolve(),
          expect(errorEvent).toReject()
        ])

        const files = readdirSync(directory)
        const hasM3u8Playlist = files.some((name) => name === "playlist.m3u8")
        expect(hasM3u8Playlist).toBeTrue()
        const hasSegments = files.some((name) => /\d+.ts/.test(name))
        expect(hasSegments).toBeTrue()

        const stopEvent = new Promise<void>((res, rej) => {
          record.once("end", () => {
            res()
          })
          setTimeout(rej, stopTimeout)
        })
        const stop = record.stop()
        await Promise.all([
          expect(stopEvent).toResolve(),
          expect(stop).toResolve()
        ])

        record = undefined as any
        rmSync(directory, { recursive: true })
      }, testTimeout)
    })

    test("Testing with offline user", async() => {
      let stream = new Writable()
      stream._write = () => {}
      let record = new Record(twitchOfflineStreamer, stream)

      const start = record.start()
      await expect(start).toReject()

      !stream.closed && stream.end()
      stream = record = undefined as any
    })

    test("Testing with invalid user", async() => {
      let stream = new Writable()
      stream._write = () => {}
      let record = new Record(twitchInvalidStreamer, stream)

      const start = record.start()
      await expect(start).toReject()

      !stream.closed && stream.end()
      stream = record = undefined as any
    })
  })
})