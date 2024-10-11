import uWS from "uWebSockets.js"
import { InfluxDB, Point } from "@influxdata/influxdb-client"
import { createVerifier } from "fast-jwt"
import dotenv from "dotenv"
import { UAParser } from "ua-parser-js";
import { parse } from "cookie";
import maxmind, { CityResponse } from "maxmind";
import geolite2 from "geolite2"
import { Decoder } from "msgpackr";

dotenv.config()

const decoder = new Decoder()

const verifyToken = createVerifier({ key: process.env.JWT_SECRET })

const influx = new InfluxDB({ url: process.env.INFLUX_URL!, token: process.env.INFLUXDB_ADMIN_TOKEN })

const writeApi = influx.getWriteApi("stracked", "stracked", "ms")

type Payload = {
  websiteUuid: string
  visitorUuid: string
}

type UserData = Payload & {
  user_id: string
}

async function main() {
  const lookup = await maxmind.open<CityResponse>(geolite2.paths.city)

  uWS.App()
    .ws("/", {
      compression: uWS.SHARED_COMPRESSOR,
      maxPayloadLength: 16 * 1024 * 1024,
      idleTimeout: 30,
      upgrade: (res, req, context) => {
        const ip = new TextDecoder().decode(res.getRemoteAddressAsText()) ?? req.getHeader("X-Forwarded-For")
        const ipData = lookup.get(ip)
        const params = new URLSearchParams(req.getQuery())

        const token = params.get("token") as string
        const path = params.get("path") as string
        const referrer = params.get("referrer") as string
        const utm_source = params.get("utm_source") as string
        const utm_medium = params.get("utm_medium") as string
        const utm_campaign = params.get("utm_campaign") as string
        const utm_term = params.get("utm_term") as string
        const utm_content = params.get("utm_content") as string

        let payload: Payload

        try {
          payload = verifyToken(token)
        } catch (error) {
          res.writeStatus("401 Unauthorized")
          res.end("Unauthorized")
          return
        }

        const result = new UAParser(req.getHeader("user-agent")).getResult()

        const cookies = parse(req.getHeader("cookie")!)

        const userData: UserData = {
          ...payload,
          user_id: cookies["stracked-user-id"]
        }

        let point = new Point("stracked")
          .tag("websiteUuid", userData.websiteUuid)
          .tag("visitorUuid", userData.visitorUuid)
          .tag("userUuid", userData.user_id)
          .tag("path", path)
          .tag("type", "open")
          .stringField("complete", JSON.stringify({ referrer }))

        if (result.browser.name) point = point.tag("browser", result.browser.name)
        if (result.device.type) point = point.tag("device", result.device.type)
        if (result.os.name) point = point.tag("os", result.os.name)
        if (utm_source) {
          point = point.tag("souce", utm_source)
        } else if (referrer) {
          point = point.tag("source", new URL(referrer).hostname)
        }
        if (utm_medium) {
          point = point.tag("medium", utm_medium)
        } else if (referrer) {
          point = point.tag("medium", "referral")
        }
        if (utm_campaign) point = point.tag("utm_campaign", utm_campaign)
        if (utm_term) point = point.tag("utm_term", utm_term)
        if (utm_content) point = point.tag("utm_content", utm_content)
        if (ipData?.country?.iso_code) point = point.tag("country", ipData.country.iso_code)
        if (ipData?.subdivisions?.[0]?.iso_code) point = point.tag("state", ipData.subdivisions[0].iso_code)

        writeApi.writePoint(point)

        writeApi.flush()

        res.upgrade(
          userData,
          req.getHeader("sec-websocket-key"),
          req.getHeader("sec-websocket-protocol"),
          req.getHeader("sec-websocket-extensions"),
          context
        );
      },
      message: (ws, message) => {
        const userData = ws.getUserData() as UserData
        const event = decoder.decode(Buffer.from(message))

        let point = new Point("stracked")
          .tag("visitorUuid", userData.visitorUuid)
          .tag("userUuid", userData.user_id)
          .tag("type", event.type)
          .stringField("data", JSON.stringify(event.data))
   
        writeApi.writePoint(point)

        writeApi.flush()
      },
      close: (ws) => {
        const userData = ws.getUserData() as UserData

        let point = new Point("stracked")
          .tag("visitorUuid", userData.visitorUuid)
          .tag("userUuid", userData.user_id)
          .tag("type", "close")
          .stringField("data", JSON.stringify({}))

        writeApi.writePoint(point)

        writeApi.flush()
      },
    }).any("/*", (res) => {
      res.writeStatus("404 Not Found")
      res.end("Not Found")
    }).listen(8000, (token) => {
      if (token) {
        console.log("Listening on port 8000")
      }
    })
}

main()
