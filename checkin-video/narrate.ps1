Add-Type -AssemblyName System.Speech
$airlockScenes = Get-Content -LiteralPath 'checkin-video/public/scenes.json' -Raw | ConvertFrom-Json
$airlockSpeaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
$airlockSpeaker.SelectVoice('Microsoft Zira Desktop')
$airlockSpeaker.Rate = 0
for ($airlockIndex=0; $airlockIndex -lt $airlockScenes.Count; $airlockIndex++) {
 $airlockAudioPath = Join-Path (Get-Location).Path "checkin-video/public/voice-$airlockIndex.wav"
 $airlockSpeaker.SetOutputToWaveFile($airlockAudioPath)
 $airlockSpeaker.Speak($airlockScenes[$airlockIndex].narration)
}
$airlockSpeaker.Dispose()
