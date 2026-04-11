// Audio format conversion utilities
// Plivo: mulaw 8kHz mono
// Gemini Live: PCM 16-bit LE 16kHz mono (input), PCM 16-bit LE 24kHz mono (output)

const MULAW_BIAS = 0x84;
const MULAW_CLIP = 32635;
const MULAW_MAX = 0x1FFF;

// Mu-law decode table (256 entries)
const mulawDecodeTable = new Int16Array(256);
for (let i = 0; i < 256; i++) {
  let mulaw = ~i;
  let sign = mulaw & 0x80;
  let exponent = (mulaw >> 4) & 0x07;
  let mantissa = mulaw & 0x0f;
  let sample = ((mantissa << 3) + MULAW_BIAS) << exponent;
  sample -= MULAW_BIAS;
  mulawDecodeTable[i] = sign ? -sample : sample;
}

// Linear PCM to mu-law
function linearToMulaw(sample) {
  let sign = 0;
  if (sample < 0) {
    sign = 0x80;
    sample = -sample;
  }
  if (sample > MULAW_CLIP) sample = MULAW_CLIP;
  sample += MULAW_BIAS;

  let exponent = 7;
  let mask = 0x4000;
  while (exponent > 0 && !(sample & mask)) {
    exponent--;
    mask >>= 1;
  }
  let mantissa = (sample >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

// Mulaw 8kHz -> PCM 16-bit LE 16kHz (upsample 2x with linear interpolation)
function mulawToPcm16k(mulawBuf) {
  const numSamples = mulawBuf.length;
  const outSamples = numSamples * 2;
  const out = Buffer.alloc(outSamples * 2); // 16-bit = 2 bytes per sample

  for (let i = 0; i < numSamples; i++) {
    const s0 = mulawDecodeTable[mulawBuf[i]];
    const s1 = i + 1 < numSamples ? mulawDecodeTable[mulawBuf[i + 1]] : s0;
    const mid = (s0 + s1) >> 1;

    out.writeInt16LE(s0, i * 4);
    out.writeInt16LE(mid, i * 4 + 2);
  }
  return out;
}

// PCM 16-bit LE 24kHz -> Mulaw 8kHz (downsample 3x)
function pcm24kToMulaw(pcmBuf) {
  const numSamples = pcmBuf.length / 2;
  const outLen = Math.floor(numSamples / 3);
  const out = Buffer.alloc(outLen);

  for (let i = 0; i < outLen; i++) {
    const sample = pcmBuf.readInt16LE(i * 6); // pick every 3rd sample
    out[i] = linearToMulaw(sample);
  }
  return out;
}

module.exports = { mulawToPcm16k, pcm24kToMulaw, mulawDecodeTable, linearToMulaw };
