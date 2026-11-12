import pathlib, sys
def edit(path, pairs):
    p = pathlib.Path(path); s = p.read_text(encoding="utf-8")
    for i, (old, new) in enumerate(pairs, 1):
        if s.count(old) != 1:
            sys.exit(f"{path} edit {i}: expected 1 match, found {s.count(old)}. Nothing written.")
        s = s.replace(old, new)
    p.write_text(s, encoding="utf-8"); print("OK", path)
MUX_OLD = """'-nostdin', '-v', 'error', '-y', '-i', silentMp4, '-i', wavPath,
        '-c:v', 'copy', '-c:a', 'aac', '-shortest', '-f', 'mp4', muxed,
      ]);"""
MUX_NEW = """'-nostdin', '-v', 'error', '-y', '-i', silentMp4, '-stream_loop', '-1', '-i', wavPath,
        '-c:v', 'copy', '-c:a', 'aac', '-t', String(dur.value), '-shortest', '-f', 'mp4', muxed,
      ], { timeoutMs: ffTimeout });"""
edit("src/video/textToVideo.mjs", [
 ("durationSec: [1, 20]", "durationSec: [1, 1800]"),
 ("  const fps = 25;\n", "  const fps = dur.value > 20 ? 5 : 25; // static text: low fps keeps long videos fast\n  const ffTimeout = 120000 + Math.round(dur.value * 500);\n"),
 ("'-pix_fmt', 'yuv420p', '-f', 'mp4', silentMp4,\n    ]);", "'-pix_fmt', 'yuv420p', '-f', 'mp4', silentMp4,\n    ], { timeoutMs: ffTimeout });"),
 ("synthSfx({ type: sfxType, durationSec: dur.value })", "synthSfx({ type: sfxType, durationSec: Math.min(dur.value, 20) })"),
 (MUX_OLD, MUX_NEW),
])
edit("src/video/photoToVideo.mjs", [
 ("durationSec: [1, 20]", "durationSec: [1, 120]"),
 ("  const fps = 25;\n", "  const fps = 25;\n  const ffTimeout = 120000 + Math.round(dur.value * 3000);\n"),
 ("'-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-f', 'mp4', silentMp4,\n    ]);", "'-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-f', 'mp4', silentMp4,\n    ], { timeoutMs: ffTimeout });"),
 ("synthSfx({ type: sfxType, durationSec: dur.value })", "synthSfx({ type: sfxType, durationSec: Math.min(dur.value, 20) })"),
 (MUX_OLD, MUX_NEW),
])
