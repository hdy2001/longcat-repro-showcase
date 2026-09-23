#!/bin/bash
# Assemble the single self-contained index.html
{
  printf '<!DOCTYPE html>\n<html lang="zh">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>Ghibli Meadow · 夕暮</title>\n<style>\n'
  cat style.css
  printf '</style>\n</head>\n<body>\n<div id="grade"></div>\n<script>\n'
  cat three.min.js
  printf '\n</script>\n<script>\n'
  cat app.js
  printf '\n</script>\n</body>\n</html>\n'
} > index.html
echo "built: $(wc -c < index.html) bytes"
