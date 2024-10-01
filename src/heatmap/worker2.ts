import { Heatmap, WebsiteSnapshot } from "./schema";
import { InfluxDB } from "@influxdata/influxdb-client"
import dotenv from "dotenv"

dotenv.config()

const influx = new InfluxDB({ url: "http://localhost:8086", token: process.env.INFLUXDB_ADMIN_TOKEN })
const queryApi = influx.getQueryApi("stracked")

const websiteUuid = "af9050e2-df49-41de-94a7-457c84a314c9"

const map = new Map<string, { top: number, left: number, bottom: number, right: number }>()

;(async () => {
  const snapshot = await WebsiteSnapshot.findOne({ websiteUuid })!;

  for (const { selector, coordinates } of snapshot?.snapshot ?? []) {
    const { top, left, bottom, right } = coordinates

    map.set(selector, { top, left, bottom, right })
  }

  const query = `from(bucket: "stracked")
  |> range(start: 0)
  |> filter(fn: (r) => r["websiteUuid"] == "${websiteUuid}")
  |> filter(fn: (r) => r["type"] == "event")`

  const events = await queryApi.collectRows(query) as { _value: string }[]

  const points: { x: number, y: number, value: number }[] = []

  for (const { _value: eventString } of events) {
    const event = JSON.parse(eventString) as { type: string, data: { xpath: string, relativeXPercentage: number, relativeYPercentage: number } }
    const { top, left, bottom, right } = map.get(event.data.xpath)!

    const x = left + (right - left) * (event.data.relativeXPercentage / 100)
    const y = top + (bottom - top) * (event.data.relativeYPercentage / 100)

    points.push({ x, y, value: event.type.includes("click") ? 3 : 1 })
  }

  const heatmap = new Heatmap({
    websiteUuid,
    points
  })

  await heatmap.save()
})();
