import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

// Phase-3-Pipeline Step 1: Reel-Video von Instagram laden und mit ffmpeg
// in einzelne Frames splitten. Die Frames werden dann von der Vision-Stage
// (lib/ai/select-keyframe.ts) durchgesehen und der beste fuer Flux gewaehlt.
//
// Wichtig: NICHT das displayUrl (Cover-Frame) nehmen — das ist das vom
// Creator designte Click-Bait-Thumbnail mit Werbe-Text-Overlays und
// gelegentlich Talking-Heads. Wir wollen einen sauberen Frame mittendrin
// im Video, wo nur das fertige Gericht zu sehen ist.

const FFMPEG_PATH = ffmpegInstaller.path;

export type ExtractedFrame = {
  /** Sekunden ab Video-Start, z. B. 14.3 */
  timestampSeconds: number;
  /** Base64-JPEG (data:image/jpeg;base64,...) — direkt fuer Gemini-Vision-
   *  inlineData oder fuer Flux Reference-Image. */
  dataUri: string;
};

export type ExtractOptions = {
  /** Sekunden zwischen Frames. Default 1.5 → 30s Reel = 20 Frames. */
  intervalSeconds?: number;
  /** Max Frames, damit Gemini-Vision-Multi-Image-Limit (~16) nicht
   *  ueberschritten wird. Wenn das Video laenger ist, vergroessern wir
   *  intervalSeconds automatisch. */
  maxFrames?: number;
  /** JPEG-Quality (1-31, niedriger = besser). Default 4 = sehr gut. */
  jpegQuality?: number;
};

/**
 * Laedt Video von URL und gibt ~10-15 Frames als Base64-JPEGs zurueck.
 */
export async function extractVideoFrames(
  videoUrl: string,
  opts: ExtractOptions = {}
): Promise<ExtractedFrame[]> {
  const maxFrames = opts.maxFrames ?? 14;
  const targetInterval = opts.intervalSeconds ?? 1.5;
  const quality = opts.jpegQuality ?? 4;

  const workDir = await fs.mkdtemp(
    path.join(tmpdir(), `frames-${randomBytes(4).toString("hex")}-`)
  );

  try {
    // 1) Video downloaden — Instagram-CDN braucht freundliche Headers.
    const videoPath = path.join(workDir, "input.mp4");
    const res = await fetch(videoUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      },
    });
    if (!res.ok) {
      throw new Error(
        `Video-Download failed: HTTP ${res.status} ${res.statusText}`
      );
    }
    const arrayBuffer = await res.arrayBuffer();
    await fs.writeFile(videoPath, Buffer.from(arrayBuffer));

    // 2) Video-Duration via ffprobe-aehnliches output von ffmpeg
    //    (ffprobe ist im Installer nicht dabei, deshalb parsen wir die
    //     Duration aus dem stderr-Output beim Demuxing).
    const duration = await getVideoDuration(videoPath);

    // 3) Frame-Interval an Video-Laenge anpassen — bei kurzen Reels nehmen
    //    wir alle ~1.5s, bei langen Reels groessere Sprunge, damit wir
    //    maxFrames nicht ueberschreiten.
    const interval = duration
      ? Math.max(targetInterval, duration / maxFrames)
      : targetInterval;
    const fps = 1 / interval;

    // 4) ffmpeg call:
    //    -i input.mp4
    //    -vf fps=1/INTERVAL
    //    -q:v QUALITY (lower = better, 2-4 is sehr gut)
    //    -frames:v MAX
    //    frame_%03d.jpg
    const framePattern = path.join(workDir, "frame_%03d.jpg");
    await runFfmpeg([
      "-i",
      videoPath,
      "-vf",
      `fps=${fps.toFixed(3)}`,
      "-q:v",
      String(quality),
      "-frames:v",
      String(maxFrames),
      framePattern,
    ]);

    // 5) Files einlesen, in Reihenfolge sortieren, Timestamps berechnen.
    const files = (await fs.readdir(workDir))
      .filter((f) => f.startsWith("frame_") && f.endsWith(".jpg"))
      .sort();
    const frames: ExtractedFrame[] = [];
    for (let i = 0; i < files.length; i++) {
      const buf = await fs.readFile(path.join(workDir, files[i]));
      const base64 = buf.toString("base64");
      frames.push({
        timestampSeconds: Math.round((i + 0.5) * interval * 10) / 10,
        dataUri: `data:image/jpeg;base64,${base64}`,
      });
    }
    return frames;
  } finally {
    // tmp folder aufraeumen — Vercel Lambda /tmp hat 512 MB, mehrere Runs
    // wuerden sich sonst gegenseitig den Platz wegnehmen.
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG_PATH, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-400)}`));
    });
  });
}

// ffmpeg gibt beim Demuxing die Duration aus, z. B. "Duration: 00:00:24.51".
// Wir parsen das aus stderr, weil ffprobe nicht im Installer-Bundle dabei ist.
function getVideoDuration(videoPath: string): Promise<number | null> {
  return new Promise((resolve) => {
    const proc = spawn(FFMPEG_PATH, ["-i", videoPath, "-f", "null", "-"], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    proc.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("close", () => {
      const m = stderr.match(/Duration:\s+(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (!m) {
        resolve(null);
        return;
      }
      const h = Number(m[1]);
      const mm = Number(m[2]);
      const s = Number(m[3]);
      resolve(h * 3600 + mm * 60 + s);
    });
    proc.on("error", () => resolve(null));
  });
}
