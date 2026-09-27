(() => {
const SOUND_MAP = {
startup:"sounds/startup.mp3",
click:"sounds/click.wav",
tap:"sounds/click.wav",
open:"sounds/open.wav",
attach:"sounds/attach.wav",
magic:"sounds/magic.wav",
send:"sounds/send.wav",
processing:"sounds/processing.wav",
message:"sounds/message.wav",
connect:"sounds/connect.wav",
lock:"sounds/lock.wav",
unlock:"sounds/unlock.wav",
success:"sounds/success.wav",
ok:"sounds/success.wav",
error:"sounds/error.wav",
warning:"sounds/warning.wav"
};

const cache = new Map();
let fallbackContext = null;

function getAudio(kind) {
const normalized = SOUND_MAP[kind] ? kind :"click";
const src = chrome.runtime.getURL(SOUND_MAP[normalized]);
let audio = cache.get(normalized);
if (!audio) {
audio = new Audio(src);
audio.preload ="auto";
audio.volume = normalized ==="startup" ? 0.085 : normalized ==="processing" ? 0.07 : normalized ==="error" || normalized ==="warning" ? 0.09 : 0.10;
cache.set(normalized,audio);
}
return audio;
}

async function fallbackTone(kind) {
try {
fallbackContext ||= new AudioContext();
const ctx = fallbackContext;
if (ctx.state ==="suspended") await ctx.resume();
const now = ctx.currentTime;
const gain = ctx.createGain();
gain.connect(ctx.destination);
gain.gain.setValueAtTime(0.0001,now);
gain.gain.exponentialRampToValueAtTime(kind ==="error" ? 0.012 : 0.009,now + 0.01);
const notes = kind ==="error"
? [[220,0,0.12],[160,0.10,0.16]]
: kind ==="success" || kind ==="ok"
? [[620,0,0.10],[820,0.08,0.12],[1040,0.18,0.16]]
: [[500,0,0.07]];
for (const [freq,start,duration] of notes) {
const osc = ctx.createOscillator();
osc.type = kind ==="error" ?"triangle" :"sine";
osc.frequency.setValueAtTime(freq,now + start);
osc.connect(gain);
osc.start(now + start);
osc.stop(now + start + duration);
}
const end = Math.max(...notes.map(([,start,duration]) => start + duration));
gain.gain.exponentialRampToValueAtTime(0.0001,now + end + 0.02);
} catch {}
}

async function play(kind ="click") {
const normalized = SOUND_MAP[kind] ? kind :"click";
try {
const template = getAudio(normalized);
const audio = template.cloneNode(true);
audio.volume = template.volume;
await audio.play();
} catch {
await fallbackTone(normalized);
}
}

Object.keys(SOUND_MAP).forEach(kind => {
try { getAudio(kind).load(); } catch {}
});

chrome.runtime.onMessage.addListener((message,sender,sendResponse) => {
if (message?.type !=="OFFSCREEN_PLAY") return;
play(message.kind ||"click").finally(() => sendResponse?.({ok:true}));
return true;
});
})();
