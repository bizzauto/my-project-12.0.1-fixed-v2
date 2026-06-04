import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

// ==================== JIMI NATURAL VOICE TTS ====================
// Neural2 + SSML for sweet, natural Indian female voice

// Convert plain text to SSML with natural pauses and emphasis
function textToSSML(text: string, lang: string): string {
  let ssml = text
    // Natural pauses after conversational fillers
    .replace(/\b(Haan|Haanji)\b/gi, '$1<break time="250ms"/>')
    .replace(/\b(Arre|Arey)\b/gi, '$1<break time="300ms"/>')
    .replace(/\b(Bilkul)\b/gi, '$1<break time="200ms"/>')
    .replace(/\b(Accha|Acha)\b/gi, '$1<break time="250ms"/>')
    .replace(/\b(Theek hai|Theek)\b/gi, '$1<break time="200ms"/>')
    .replace(/\b(Chalo)\b/gi, '$1<break time="250ms"/>')
    .replace(/\b(Namaste)\b/gi, '$1<break time="300ms"/>')
    .replace(/\b(Hello|Hey)\b/gi, '$1<break time="200ms"/>')
    .replace(/\b(Toh|Matlab)\b/gi, '$1<break time="150ms"/>')
    .replace(/\b(Ji)\b/gi, '$1<break time="150ms"/>')
    // Natural pause at commas and periods
    .replace(/,\s*/g, ',<break time="150ms"/> ')
    .replace(/\.\s*/g, '.<break time="350ms"/> ')
    .replace(/\?\s*/g, '?<break time="300ms"/> ')
    .replace(/!\s*/g, '!<break time="250ms"/> ')
    // Pause at line breaks (for multi-line responses)
    .replace(/\n/g, '<break time="400ms"/> ');

  // Wrap in SSML speak tag
  const langAttr = lang || 'hi-IN';
  return `<speak>
    <prosody rate="92%" pitch="+5%" volume="medium">
      <express-as style="cheerful">
        ${ssml}
      </express-as>
    </prosody>
  </speak>`;
}

// Clean text for SSML (remove emojis and special chars)
function cleanTextForSSML(text: string): string {
  return text
    // Remove emojis
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    // Remove special symbols that cause robotic speech
    .replace(/[★☆♡♥♪♫♬☆✦✧◇◆□■△▲●○❤️💕✨🌟💫😊🤔💭]/g, '')
    // Normalize whitespace
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// POST /api/jimi/tts - Natural voice TTS
router.post('/tts', async (req: Request, res: Response) => {
  try {
    const { text, lang = 'hi-IN', gender = 'FEMALE', speed = 0.92, pitch = 1.05 } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required' });
    }

    if (text.length > 5000) {
      return res.status(400).json({ error: 'Text too long (max 5000 chars)' });
    }

    const cleanText = cleanTextForSSML(text);
    if (!cleanText) {
      return res.json({ fallback: true, text: '', message: 'Empty text after cleaning' });
    }

    // Google Cloud TTS API key
    const apiKey = process.env.GOOGLE_TTS_API_KEY || process.env.GOOGLE_CLOUD_TTS_API_KEY;
    
    if (!apiKey) {
      return res.json({ 
        fallback: true, 
        text: cleanText,
        message: 'Google TTS not configured' 
      });
    }

    // Neural2 voices - BEST quality for Indian accent
    // hi-IN-Neural2-A = Sweet young Indian woman (recommended)
    // hi-IN-Wavenet-A = Good fallback
    const voiceMap: Record<string, string> = {
      'hi-IN': 'hi-IN-Neural2-A',      // Sweet Indian female - BEST
      'en-US': 'en-US-Neural2-F',      // Natural American female
      'en-IN': 'en-IN-Neural2-A',      // Indian English female
      'mr-IN': 'hi-IN-Neural2-A',      // Marathi (use Hindi Neural2)
      'ta-IN': 'ta-IN-Neural2-A',      // Tamil female
      'te-IN': 'te-IN-Neural2-A',      // Telugu female
      'bn-IN': 'bn-IN-Neural2-A',      // Bengali female
      'gu-IN': 'hi-IN-Neural2-A',      // Gujarati (use Hindi Neural2)
      'kn-IN': 'kn-IN-Neural2-A',      // Kannada female
      'ml-IN': 'ml-IN-Neural2-A',      // Malayalam female
      'pa-IN': 'hi-IN-Neural2-A',      // Punjabi (use Hindi Neural2)
    };

    const voiceName = voiceMap[lang] || 'hi-IN-Neural2-A';

    // Generate SSML for natural speech
    const ssml = textToSSML(cleanText, lang);

    // Google Cloud TTS API with SSML
    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { ssml },
          voice: {
            languageCode: lang,
            name: voiceName,
            ssmlGender: 'FEMALE',
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: speed,     // 0.92 = natural conversational pace
            pitch: pitch,           // +5% for sweetness without cartoonish
            volumeGainDb: 0,
            sampleRateHertz: 24000, // High quality audio
          },
        }),
      }
    );

    if (!response.ok) {
      console.error('Google TTS error:', await response.text());
      return res.json({ fallback: true, text: cleanText, message: 'TTS API error' });
    }

    const data: any = await response.json();
    
    if (data.audioContent) {
      res.json({
        audio: data.audioContent,
        format: 'mp3',
        voice: voiceName,
        lang,
        engine: 'google-neural2',
        sampleRate: 24000,
      });
    } else {
      res.json({ fallback: true, text: cleanText, message: 'No audio content' });
    }
  } catch (error: any) {
    console.error('TTS endpoint error:', error);
    res.json({ fallback: true, text: req.body.text || '', message: 'TTS service unavailable' });
  }
});

// POST /api/jimi/tts/edge - Edge TTS (free, no API key)
router.post('/tts/edge', async (req: Request, res: Response) => {
  try {
    const { text, lang = 'hi-IN' } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    // Clean text
    const cleanText = text
      .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
      .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
      .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
      .replace(/[\u{2600}-\u{26FF}]/gu, '')
      .replace(/[\u{2700}-\u{27BF}]/gu, '')
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) {
      return res.json({ fallback: true, text: '', message: 'Empty text' });
    }

    // Edge TTS Neural voices
    const edgeVoiceMap: Record<string, string> = {
      'hi-IN': 'hi-IN-SwaraNeural',
      'en-US': 'en-US-JennyNeural',
      'en-IN': 'en-IN-NeerjaNeural',
      'mr-IN': 'mr-IN-AarohiNeural',
      'ta-IN': 'ta-IN-PallaviNeural',
      'te-IN': 'te-IN-ShrutiNeural',
      'bn-IN': 'bn-IN-TanishaaNeural',
      'gu-IN': 'hi-IN-SwaraNeural',
      'kn-IN': 'kn-IN-SapnaNeural',
      'ml-IN': 'ml-IN-SobhanaNeural',
      'pa-IN': 'pa-IN-GurpreetNeural',
    };

    const voice = edgeVoiceMap[lang] || 'hi-IN-SwaraNeural';

    try {
      const { execSync } = await import('child_process');
      const fs = await import('fs');
      const path = await import('path');
      const os = await import('os');
      const crypto = await import('crypto');

      const tmpFile = path.join(os.tmpdir(), `jimi-${crypto.randomBytes(8).toString('hex')}.mp3`);
      
      // Write text to a temp file to avoid shell escaping issues
      const textFile = path.join(os.tmpdir(), `jimi-text-${crypto.randomBytes(8).toString('hex')}.txt`);
      fs.writeFileSync(textFile, cleanText, 'utf-8');

      try {
        // Use --file flag to read text from file (avoids shell escaping)
        execSync(
          `edge-tts --voice "${voice}" --rate="-2%" --pitch="+5Hz" --file "${textFile}" --write-media "${tmpFile}"`,
          { timeout: 10000, stdio: 'pipe' }
        );

        const audioBuffer = fs.readFileSync(tmpFile);
        
        // Cleanup
        try { fs.unlinkSync(tmpFile); } catch {}
        try { fs.unlinkSync(textFile); } catch {}

        res.json({
          audio: audioBuffer.toString('base64'),
          format: 'mp3',
          voice,
          lang,
        });
      } catch (execError: any) {
        // Cleanup on error
        try { fs.unlinkSync(tmpFile); } catch {}
        try { fs.unlinkSync(textFile); } catch {}
        
        console.error('Edge TTS exec error:', execError.message);
        res.json({ fallback: true, text: cleanText, message: 'Edge TTS failed' });
      }
    } catch (err: any) {
      console.error('Edge TTS error:', err.message);
      res.json({ fallback: true, text: cleanText, message: 'Edge TTS unavailable' });
    }
  } catch (error: any) {
    console.error('TTS endpoint error:', error);
    res.json({ fallback: true, text: req.body.text || '', message: 'TTS error' });
  }
});

export default router;
