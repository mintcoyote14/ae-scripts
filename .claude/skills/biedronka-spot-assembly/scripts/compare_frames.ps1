param([string]$PathA,[string]$PathB,[string]$Out)
Add-Type -AssemblyName System.Drawing
$a=[System.Drawing.Bitmap]::FromFile($PathA); $b=[System.Drawing.Bitmap]::FromFile($PathB)
if($a.Width -ne 1920 -or $b.Width -ne 1920){ "SIZE MISMATCH $($a.Width) $($b.Width)"; exit }
$dm=New-Object System.Drawing.Bitmap 960,540; $sum=0;$strong=0
for($y=0;$y -lt 1080;$y+=2){ for($x=0;$x -lt 1920;$x+=2){ $p=$a.GetPixel($x,$y);$q=$b.GetPixel($x,$y); $e=[math]::Abs($p.R-$q.R)+[math]::Abs($p.G-$q.G)+[math]::Abs($p.B-$q.B); $sum+=$e; if($e -gt 60){$strong++}; $v=[math]::Min(255,$e*3); $dm.SetPixel($x/2,$y/2,[System.Drawing.Color]::FromArgb($v,$v,$v)) } }
$n=960*540; "WHOLE mean $([math]::Round($sum/$n,1)) strong $([math]::Round(100*$strong/$n,2))%"
$dm.Save($Out)
function Roi($name,$x0,$y0,$x1,$y1){ $s=0;$st=0;$n=0; for($y=$y0;$y -lt $y1;$y+=2){for($x=$x0;$x -lt $x1;$x+=2){ $p=$a.GetPixel($x,$y);$q=$b.GetPixel($x,$y); $e=[math]::Abs($p.R-$q.R)+[math]::Abs($p.G-$q.G)+[math]::Abs($p.B-$q.B); $s+=$e; if($e -gt 60){$st++}; $n++ }}; "{0,-18} mean {1,5} strong {2,5}%" -f $name,[math]::Round($s/$n,1),[math]::Round(100*$st/$n,2) }
Roi 'legal' 100 870 1100 1030
Roi 'dates box' 115 10 490 145
Roi 'mechanism' 1205 190 1640 770
Roi 'bottom band' 0 880 1920 1080
Roi 'table edge x20-90' 20 560 90 640
Roi 'table edge x1700-1900' 1700 560 1900 640
foreach($EX in 60,1760){ foreach($n in 'A','B'){ $img=if($n -eq 'A'){$a}else{$b}; $prev=$img.GetPixel($EX,540); $edge=-1; for($y=541;$y -lt 700;$y++){ $c=$img.GetPixel($EX,$y); $e=[math]::Abs($c.R-$prev.R)+[math]::Abs($c.G-$prev.G)+[math]::Abs($c.B-$prev.B); if($e -gt 25 -and $edge -lt 0){$edge=$y}; $prev=$c }; "table edge x=$EX $n first change y: $edge" } }
$a.Dispose();$b.Dispose()


