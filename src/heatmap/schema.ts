import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

mongoose.connect(process.env.MONGODB_URI!);

const CoordinateSchema = new mongoose.Schema({
  top: { type: Number, required: true },
  left: { type: Number, required: true },
  bottom: { type: Number, required: true },
  right: { type: Number, required: true }
});
  
const ActionSchema = new mongoose.Schema({
  selector: { type: String, required: true },
  coordinates: {
    type: CoordinateSchema,
    required: true
  }
});

const WebsiteSnapshotSchema = new mongoose.Schema({
  websiteUuid: String,
  snapshot: {
    type: [ActionSchema],
    required: true
  },
  screenshot: { type: Buffer, required: true },
  date: { type: Date, default: Date.now },
});

export const WebsiteSnapshot = mongoose.model("WebsiteSnapshot", WebsiteSnapshotSchema);

const PointSchema = new mongoose.Schema({
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  value: { type: Number, required: true }
});

const HeatmapSchema = new mongoose.Schema({
  websiteUuid: String,
  points: {
    type: [PointSchema],
    required: true
  },
  date: { type: Date, default: Date.now },
});

export const Heatmap = mongoose.model("Heatmap", HeatmapSchema);
