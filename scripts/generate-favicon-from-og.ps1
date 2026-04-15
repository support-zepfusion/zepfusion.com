# One-off: center-crop og-image.png to square, write favicon.png (32) and apple-touch-icon.png (180)
Add-Type -AssemblyName System.Drawing
$base = Split-Path -Parent $PSScriptRoot
$srcPath = Join-Path $base 'og-image.png'
if (-not (Test-Path $srcPath)) {
  Write-Error "Missing $srcPath"
  exit 1
}
$src = [System.Drawing.Image]::FromFile($srcPath)
try {
  $w = $src.Width
  $h = $src.Height
  $side = [Math]::Min($w, $h)
  $x = [int](($w - $side) / 2)
  $y = [int](($h - $side) / 2)
  $square = New-Object System.Drawing.Bitmap($side, $side)
  $g = [System.Drawing.Graphics]::FromImage($square)
  $srcRect = [System.Drawing.Rectangle]::new($x, $y, $side, $side)
  $dstRect = [System.Drawing.Rectangle]::new(0, 0, $side, $side)
  $g.DrawImage($src, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()

  function Export-Size {
    param($bmp, [int]$size, [string]$outPath)
    $outBmp = New-Object System.Drawing.Bitmap($size, $size)
    $g2 = [System.Drawing.Graphics]::FromImage($outBmp)
    $g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g2.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g2.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g2.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g2.DrawImage($bmp, 0, 0, $size, $size)
    $g2.Dispose()
    $outBmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $outBmp.Dispose()
  }

  Export-Size $square 32 (Join-Path $base 'favicon.png')
  Export-Size $square 180 (Join-Path $base 'apple-touch-icon.png')
  $square.Dispose()
  Write-Host "Wrote favicon.png and apple-touch-icon.png"
} finally {
  $src.Dispose()
}
