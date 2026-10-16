param([string]$SourcePath = '')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
Add-Type -Path (Join-Path $PSScriptRoot 'lib/NarrationRecorder.cs') -ReferencedAssemblies 'System.Speech', 'System.Core'
$frontendPath = Split-Path $PSScriptRoot -Parent
if (!$SourcePath) { $SourcePath = Join-Path $frontendPath 'src/guides/narration.es.json' }
$sourcePath = $SourcePath
$scriptData = Get-Content -Encoding UTF8 -LiteralPath $sourcePath -Raw | ConvertFrom-Json
$audioPath = Join-Path $frontendPath "public/assets/guides/$($scriptData.version)"
if (Test-Path -LiteralPath (Join-Path $audioPath 'manifest.json')) { throw 'Esta version ya tiene grabaciones. Cambia version antes de generar audios nuevos.' }
New-Item -ItemType Directory -Force -Path $audioPath | Out-Null
$recorder = New-Object NarrationRecorder
$synthesizer = $recorder.Synth
try {
  $availableVoices = @($synthesizer.GetInstalledVoices() | Where-Object Enabled | ForEach-Object { [PSCustomObject]@{ Name=$_.VoiceInfo.Name; Culture=$_.VoiceInfo.Culture.Name } })
  $preferredVoice = $null
  foreach ($localeCode in @('es-EC','es-MX','es-CO','es-US','es-PE','es-AR','es-CL')) {
    $preferredVoice = $availableVoices | Where-Object Culture -EQ $localeCode | Select-Object -First 1
    if ($preferredVoice) { break }
  }
  if (!$preferredVoice) { throw 'No hay una voz latinoamericana verificada. No se sustituye por es-ES.' }
  if ($preferredVoice.Name -ne $scriptData.voice -or $preferredVoice.Culture -ne $scriptData.locale) { throw 'La voz preferida disponible difiere de la fuente versionada. Revisar nombre, locale y version antes de generar.' }
  $synthesizer.SelectVoice($scriptData.voice)
  if ($synthesizer.Voice.Culture.Name -ne $scriptData.locale) { throw 'La voz seleccionada no coincide con la region requerida.' }
  $synthesizer.Rate = $scriptData.rate
  $synthesizer.Volume = 100
  $entries = @()
  foreach ($world in @('classroom', 'space', 'museum', 'host')) {
    foreach ($clip in $scriptData.$world) {
      $clipPath = Join-Path $audioPath "$($clip.id).wav"
      $recorder.Record([string]$clip.text, [string]$scriptData.locale, [int]$scriptData.sentencePauseMs, $clipPath)
      $audioHash = (Get-FileHash -LiteralPath $clipPath -Algorithm SHA256).Hash.ToLower()
      [PSCustomObject]@{ wavSHA256=$audioHash; source='Windows System.Speech events'; visemes=@($recorder.Visemes); words=@($recorder.Words) } | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $audioPath "$($clip.id).timing.json")
      $entries += [PSCustomObject]@{ id=$clip.id; text=$clip.text; sha256=$audioHash; bytes=(Get-Item -LiteralPath $clipPath).Length; visemeCount=$recorder.Visemes.Count; wordCount=$recorder.Words.Count }
    }
  }
  $sourceCanonical = [System.IO.File]::ReadAllText($sourcePath).Replace("`r`n", "`n")
  $sourceHasher = [System.Security.Cryptography.SHA256]::Create()
  try { $sourceHash = [BitConverter]::ToString($sourceHasher.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($sourceCanonical))).Replace('-', '').ToLower() } finally { $sourceHasher.Dispose() }
  [PSCustomObject]@{ version=$scriptData.version; voice=$scriptData.voice; locale=$synthesizer.Voice.Culture.Name; availableVoices=$availableVoices; engine='Windows System.Speech'; rate=$scriptData.rate; sentencePauseMs=$scriptData.sentencePauseMs; generatedAt=[DateTime]::UtcNow.ToString('o'); sourceSHA256=$sourceHash; clips=$entries } | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $audioPath 'manifest.json')
} finally { $recorder.Dispose() }
Write-Output "Audios locales generados: $audioPath"
