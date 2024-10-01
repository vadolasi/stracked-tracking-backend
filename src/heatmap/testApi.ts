import express from "express";
import dotenv from "dotenv";
import { Heatmap, WebsiteSnapshot } from "./schema";

dotenv.config();

const app = express();

app.use(express.json());
app.get("*", express.static("static"));

app.get("/data", async (req, res) => {
  res.json(JSON.stringify(await Heatmap.findOne({ websiteUuid: "af9050e2-df49-41de-94a7-457c84a314c9" })!));
})

app.get("/image/:id", async (req, res) => {
  const snapshot = await WebsiteSnapshot.findOne({ websiteUuid: req.params.id })!

  console.log(snapshot)

  res.setHeader("Content-Type", "image/webp");

  res.send(snapshot!.screenshot);
})

app.listen(5000, () => console.log("Listening on http://localhost:5000"));
