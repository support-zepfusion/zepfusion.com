# Center-crop og-image.png to square, remove dark backdrop → transparent, export favicon + apple-touch.
# Re-run after changing og-image.png.
Add-Type -AssemblyName System.Drawing
$base = Split-Path -Parent $PSScriptRoot
$srcPath = Join-Path $base 'og-image.png'
if (-not (Test-Path $srcPath)) {
  Write-Error "Missing $srcPath"
  exit 1
}

function Remove-OgBackground {
  param([System.Drawing.Bitmap]$bmp)
  # OG art uses ~#0d0f14; treat near-black / dark charcoal as transparent (anti-alias friendly).
  $bgR = 13; $bgG = 15; $bgB = 20
  $distCutoff = 48
  $maxRgb = 52
  for ($y = 0; $y -lt $bmp.Height; $y++) {
    for ($x = 0; $x -lt $bmp.Width; $x++) {
      $c = $bmp.GetPixel($x, $y)
      if ($c.A -eq 0) { continue }
      $dr = [double]($c.R - $bgR)
      $dg = [double]($c.G - $bgG)
      $db = [double]($c.B - $bgB)
      $dist = [math]::Sqrt($dr * $dr + $dg * $dg + $db * $db)
      if ($dist -lt $distCutoff -or ($c.R -le $maxRgb -and $c.G -le $maxRgb -and $c.B -le $maxRgb)) {
        $bmp.SetPixel($x, $y, [System.Drawing.Color]::Transparent)
      }
    }
  }
}

function Export-SizePng {
  param($bmp, [int]$size, [string]$outPath)
  $outBmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g2 = [System.Drawing.Graphics]::FromImage($outBmp)
  $g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g2.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g2.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g2.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g2.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
  $g2.Clear([System.Drawing.Color]::Transparent)
  $g2.DrawImage($bmp, 0, 0, $size, $size)
  $g2.Dispose()
  $outBmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $outBmp.Dispose()
}

$src = [System.Drawing.Image]::FromFile($srcPath)
try {
  $w = $src.Width
  $h = $src.Height
  $side = [Math]::Min($w, $h)
  $x = [int](($w - $side) / 2)
  $y = [int](($h - $side) / 2)

  $square = New-Object System.Drawing.Bitmap($side, $side, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($square)
  $g.Clear([System.Drawing.Color]::Transparent)
  $srcRect = [System.Drawing.Rectangle]::new($x, $y, $side, $side)
  $dstRect = [System.Drawing.Rectangle]::new(0, 0, $side, $side)
  $g.DrawImage($src, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()

  Remove-OgBackground -bmp $square

  Export-SizePng -bmp $square -size 32 -outPath (Join-Path $base 'favicon.png')
  Export-SizePng -bmp $square -size 180 -outPath (Join-Path $base 'apple-touch-icon.png')
  $square.Dispose()
  Write-Host "Wrote transparent favicon.png and apple-touch-icon.png"
} finally {
  $src.Dispose()
}
