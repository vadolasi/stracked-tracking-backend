import { App } from "uWebSockets.js"
import { InfluxDB, Point } from "@influxdata/influxdb-client"
import { hostname } from "node:os"
import { createVerifier } from "fast-jwt"
import dotenv from "dotenv"

dotenv.config()

const verifyToken = createVerifier({ key: process.env.JWT_SECRET })

const influx = new InfluxDB({ url: "http://localhost:8086", token: process.env.INFLUXDB_ADMIN_TOKEN })

const writeApi = influx.getWriteApi("stracked", "stracked", "ms")
writeApi.useDefaultTags({ location: hostname() })

const app = App()

app.ws("/*", {
  upgrade: (res, req, context) => {
    const token = new URLSearchParams(req.getQuery()).get("token") || ""

    let payload: object

    try {
      payload = verifyToken(token)
    } catch (error) {
      res.writeStatus("401 Unauthorized")
      res.end("Unauthorized")
      return
    }

    res.upgrade( 
      payload,
      req.getHeader("sec-websocket-key"),
      req.getHeader("sec-websocket-protocol"),
      req.getHeader("sec-websocket-extensions"),
      context
    );
  },
  message: (ws, message) => {
    const { websiteUuid, visitorUuid } = ws.getUserData() as { websiteUuid: string, visitorUuid: string }
    const event = JSON.parse(Buffer.from(message).toString())

    const point = new Point("stracked")
      .tag("websiteUuid", websiteUuid)
      .tag("visitorUuid", visitorUuid)
      .tag("type", event.type)
      .stringField("data", JSON.stringify(event.data))

    writeApi.writePoint(point)

    writeApi.flush()
  }
})

app.listen(8000, (token) => {
  if (token) {
    console.log("Listening on port 8000")
  }
})
