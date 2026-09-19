#!/usr/bin/env bash
# Regenerates the Android launcher icons from web/public/icon.svg and web/public/icon-foreground.svg.
#
# The PNGs are committed, because the APK is built in CI and a CI runner has neither rsvg-convert nor
# ImageMagick; this script is how they are produced, not a build step. Run it after changing either SVG.
#
#   tools/icons.sh
#
# Sizes are Android's: the launcher mipmap is 48dp and the adaptive foreground 108dp, each at the five
# densities (x1, x1.5, x2, x3, x4). The round variant is the square one masked by a circle — a launcher
# that asks for roundIcon gets a circle rather than a rounded square with corners showing.
set -euo pipefail

cd "$(dirname "$0")/.."
res=android/app/src/main/res

for spec in mdpi:48:108 hdpi:72:162 xhdpi:96:216 xxhdpi:144:324 xxxhdpi:192:432; do
    density=${spec%%:*}
    rest=${spec#*:}
    launcher=${rest%%:*}
    foreground=${rest#*:}
    dir="$res/mipmap-$density"

    rsvg-convert -w "$launcher" -h "$launcher" web/public/icon.svg -o "$dir/ic_launcher.png"
    magick "$dir/ic_launcher.png" \
        \( -size "${launcher}x${launcher}" xc:none -fill white \
           -draw "circle $((launcher / 2)),$((launcher / 2)) $((launcher / 2)),0" \) \
        -alpha set -compose DstIn -composite "$dir/ic_launcher_round.png"
    rsvg-convert -w "$foreground" -h "$foreground" -b none web/public/icon-foreground.svg \
        -o "$dir/ic_launcher_foreground.png"
done

echo "wrote $res/mipmap-*/ic_launcher{,_round,_foreground}.png"
