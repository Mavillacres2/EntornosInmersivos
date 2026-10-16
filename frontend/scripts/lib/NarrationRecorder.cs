using System;
using System.Collections.Generic;
using System.Globalization;
using System.Speech.Synthesis;
using System.Speech.AudioFormat;
using System.Text.RegularExpressions;

public sealed class NarrationViseme { public double t; public double d; public int id; }
public sealed class NarrationWord { public double t; public string text; }
public sealed class NarrationRecorder : IDisposable {
    public readonly SpeechSynthesizer Synth = new SpeechSynthesizer();
    public readonly List<NarrationViseme> Visemes = new List<NarrationViseme>();
    public readonly List<NarrationWord> Words = new List<NarrationWord>();
    public NarrationRecorder() {
        Synth.VisemeReached += (sender, e) => Visemes.Add(new NarrationViseme { t=e.AudioPosition.TotalSeconds, d=e.Duration.TotalSeconds, id=e.Viseme });
        Synth.SpeakProgress += (sender, e) => Words.Add(new NarrationWord { t=e.AudioPosition.TotalSeconds, text=e.Text });
    }
    public void Record(string text, string locale, int sentencePauseMs, string file) {
        Visemes.Clear(); Words.Clear();
        var prompt = new PromptBuilder(new CultureInfo(locale));
        foreach (string sentence in Regex.Split(text, @"(?<=[.!?])\s+")) {
            prompt.AppendText(sentence);
            prompt.AppendBreak(TimeSpan.FromMilliseconds(sentencePauseMs));
        }
        // Explicit format keeps SAPI timing and the WAV sample clock in the same units.
        Synth.SetOutputToWaveFile(file, new SpeechAudioFormatInfo(16000, AudioBitsPerSample.Sixteen, AudioChannel.Mono));
        Synth.Speak(prompt);
        Synth.SetOutputToNull();
    }
    public void Dispose() { Synth.Dispose(); }
}
