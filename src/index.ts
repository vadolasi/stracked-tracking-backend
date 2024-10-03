import { App } from "uWebSockets.js"
import { InfluxDB, Point } from "@influxdata/influxdb-client"
import { createVerifier } from "fast-jwt"
import dotenv from "dotenv"
import { UAParser } from "ua-parser-js";
import { parse } from "cookie";
import maxmind, { CityResponse } from "maxmind";
import { join } from "path";

dotenv.config()

const verifyToken = createVerifier({ key: process.env.JWT_SECRET })

const influx = new InfluxDB({ url: "http://localhost:8086", token: process.env.INFLUXDB_ADMIN_TOKEN })

const writeApi = influx.getWriteApi("stracked", "stracked", "ms")

const app = App()

type Payload = {
  websiteUuid: string
  visitorUuid: string
}

type UserData = Payload & {
  browser?: string
  device?: string
  os?: string
  path: string
  user_id: string
  country?: string
  region?: string
  referrer: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
}

async function main() {
  const lookup = await maxmind.open<CityResponse>(join(__dirname, "GeoLite2-City.mmdb"))

  app.ws("/*", {
    upgrade: (res, req, context) => {
      const params = new URLSearchParams(req.getQuery())

      const token = params.get("token") as string
      const path = params.get("path") as string
      const country = params.get("country") as string
      const region = params.get("region") as string
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

      const { getResult } = new UAParser(req.getHeader("user-agent"))
      const result = getResult()

      const cookies = parse(req.getHeader("cookie")!)

      const userData: UserData = {
        ...payload,
        browser: result.browser.name,
        device: result.device.type,
        os: result.os.name,
        country,
        region,
        referrer,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_term,
        utm_content,
        path,
        user_id: cookies["stracked-user-id"]
      }

      res.upgrade(
        userData,
        req.getHeader("sec-websocket-key"),
        req.getHeader("sec-websocket-protocol"),
        req.getHeader("sec-websocket-extensions"),
        context
      );
    },
    open: (ws) => {
      const ip = new TextDecoder().decode(ws.getRemoteAddressAsText())
      const ipData = lookup.get(ip)

      const userData = ws.getUserData() as UserData

      let point = new Point("stracked")
        .tag("websiteUuid", userData.websiteUuid)
        .tag("visitorUuid", userData.visitorUuid)
        .tag("userUuid", userData.user_id)
        .tag("path", userData.path)
        .tag("referrer", userData.referrer)
        .tag("type", "open")

      if (userData.browser) point = point.tag("browser", userData.browser)
      if (userData.device) point = point.tag("device", userData.device)
      if (userData.os) point = point.tag("os", userData.os)
      if (userData.country) point = point.tag("country", userData.country)
      if (userData.region) point = point.tag("region", userData.region)
      if (userData.utm_source) point = point.tag("utm_source", userData.utm_source)
      if (userData.utm_medium) point = point.tag("utm_medium", userData.utm_medium)
      if (userData.utm_campaign) point = point.tag("utm_campaign", userData.utm_campaign)
      if (userData.utm_term) point = point.tag("utm_term", userData.utm_term)
      if (userData.utm_content) point = point.tag("utm_content", userData.utm_content)
      if (ipData?.country?.iso_code) point = point.tag("country", ipData.country.iso_code)
      if (ipData?.subdivisions?.[0]?.iso_code) point = point.tag("state", ipData.subdivisions[0].iso_code)

      writeApi.writePoint(point)

      writeApi.flush()
    },
    message: (ws, message) => {
      const ip = new TextDecoder().decode(ws.getRemoteAddressAsText())
      const ipData = lookup.get(ip)
      const userData = ws.getUserData() as UserData
      const event = JSON.parse(Buffer.from(message).toString())

      let point = new Point("stracked")
        .tag("websiteUuid", userData.websiteUuid)
        .tag("visitorUuid", userData.visitorUuid)
        .tag("userUuid", userData.user_id)
        .tag("path", userData.path)
        .tag("referrer", userData.referrer)
        .tag("type", event.type)
        .stringField("data", JSON.stringify(event.data))
 
      if (userData.browser) point = point.tag("browser", userData.browser)
      if (userData.device) point = point.tag("device", userData.device)
      if (userData.os) point = point.tag("os", userData.os)
      if (userData.country) point = point.tag("country", userData.country)
      if (userData.region) point = point.tag("region", userData.region)
      if (userData.utm_source) point = point.tag("utm_source", userData.utm_source)
      if (userData.utm_medium) point = point.tag("utm_medium", userData.utm_medium)
      if (userData.utm_campaign) point = point.tag("utm_campaign", userData.utm_campaign)
      if (userData.utm_term) point = point.tag("utm_term", userData.utm_term)
      if (userData.utm_content) point = point.tag("utm_content", userData.utm_content)
      if (ipData?.country?.iso_code) point = point.tag("country", ipData.country.iso_code)
      if (ipData?.subdivisions?.[0]?.iso_code) point = point.tag("state", ipData.subdivisions[0].iso_code)

      writeApi.writePoint(point)

      writeApi.flush()
    },
    close(ws) {
      const ip = new TextDecoder().decode(ws.getRemoteAddressAsText())
      const ipData = lookup.get(ip)

      const userData = ws.getUserData() as UserData

      let point = new Point("stracked")
        .tag("websiteUuid", userData.websiteUuid)
        .tag("visitorUuid", userData.visitorUuid)
        .tag("userUuid", userData.user_id)
        .tag("path", userData.path)
        .tag("referrer", userData.referrer)
        .tag("type", "close")

      if (userData.browser) point = point.tag("browser", userData.browser)
      if (userData.device) point = point.tag("device", userData.device)
      if (userData.os) point = point.tag("os", userData.os)
      if (userData.country) point = point.tag("country", userData.country)
      if (userData.region) point = point.tag("region", userData.region)
      if (userData.utm_source) point = point.tag("utm_source", userData.utm_source)
      if (userData.utm_medium) point = point.tag("utm_medium", userData.utm_medium)
      if (userData.utm_campaign) point = point.tag("utm_campaign", userData.utm_campaign)
      if (userData.utm_term) point = point.tag("utm_term", userData.utm_term)
      if (userData.utm_content) point = point.tag("utm_content", userData.utm_content)
      if (ipData?.country?.iso_code) point = point.tag("country", ipData.country.iso_code)
      if (ipData?.subdivisions?.[0]?.iso_code) point = point.tag("state", ipData.subdivisions[0].iso_code)

      writeApi.writePoint(point)

      writeApi.flush()
    },
  })

  app.listen(8000, (token) => {
    if (token) {
      console.log("Listening on port 8000")
    }
  })
}

main()
