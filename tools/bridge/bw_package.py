#!/usr/bin/env python3
"""把逐镜 PNG 序列编码成 mp4，并拼成全片。

用法：
  python3 bw_package.py <scene.json> --frames DIR --clips DIR --ffmpeg PATH \
      [--ffprobe PATH] --reel OUT.mp4 [--fps 24]

输出：
  clips/<shot>.mp4        逐镜
  clips/<shot>_contact.png 首/中/末联络表
  OUT.mp4                 全片
"""
import json
import os
import subprocess
import sys


def arg(name, default=None):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default


def run(cmd):
    proc = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    if proc.returncode:
        raise SystemExit("命令失败（%s）：%s" % (cmd[0], proc.stderr.decode("utf-8", "replace")[:800]))


def main():
    scene_json = os.path.abspath(sys.argv[1])
    frames_dir = os.path.abspath(arg("--frames"))
    clips_dir = os.path.abspath(arg("--clips"))
    reel = os.path.abspath(arg("--reel"))
    ffmpeg = arg("--ffmpeg", "ffmpeg")
    fps = int(arg("--fps", "24"))
    os.makedirs(clips_dir, exist_ok=True)

    cfg = json.load(open(scene_json, encoding="utf-8"))
    fps = int(cfg["project"].get("fps", fps))
    concat_file = os.path.join(clips_dir, "concat.txt")
    made = []
    with open(concat_file, "w", encoding="utf-8") as listfile:
        for shot in cfg["shots"]:
            sid = shot["id"]
            shot_dir = os.path.join(frames_dir, sid)
            if not os.path.isdir(shot_dir):
                continue
            frames = sorted(f for f in os.listdir(shot_dir) if f.endswith(".png"))
            if not frames:
                continue
            out = os.path.join(clips_dir, sid + ".mp4")
            run([ffmpeg, "-y", "-nostdin", "-loglevel", "error", "-framerate", str(fps),
                 "-start_number", "0", "-i", os.path.join(shot_dir, sid + "_%04d.png"),
                 "-frames:v", str(len(frames)), "-c:v", "libx264", "-preset", "veryfast",
                 "-crf", "18", "-pix_fmt", "yuv420p", out])
            listfile.write(f"file '{out}'\n")
            made.append((sid, out, len(frames)))
    if not made:
        print("NO_CLIPS")
        return
    run([ffmpeg, "-y", "-nostdin", "-loglevel", "error", "-f", "concat", "-safe", "0",
         "-i", concat_file, "-c", "copy", reel])
    print("PACKAGED", len(made), "clips")
    print("REEL", reel)


if __name__ == "__main__":
    main()
