#!/bin/bash
# Builds a contact sheet from a rendered graphic, so an agent can look for ghosts, gaps, cut-off glows and unreadable text.
# usage: qa_sheet.sh <video> [out.jpg] [frames, default 9] [columns, default 3]
# Pick your own frames instead: QA_FRAMES="6 14 25 32 40 55 62 71 106" qa_sheet.sh <video> out.jpg
f=$1; out=${2:-qa.jpg}; n=${3:-9}; cols=${4:-3}
if [ -n "$QA_FRAMES" ]; then
  frames=$QA_FRAMES
else
  total=$(ffprobe -v error -count_packets -select_streams v:0 -show_entries stream=nb_read_packets -of csv=p=0 "$f")
  frames=$(python3 -c "t=int('$total');n=$n;print(' '.join(str(round((i+.5)*t/n)) for i in range(n)))")
fi
sel=""; count=0
for k in $frames; do sel="$sel${sel:++}eq(n\\,$k)"; count=$((count+1)); done
rows=$(( (count + cols - 1) / cols ))
ffmpeg -v error -y -i "$f" -vf "select='$sel',scale=640:-2,tile=${cols}x${rows}:padding=4" -fps_mode passthrough -frames:v 1 -q:v 3 "$out" && echo "$out ($count frames: $frames)"
