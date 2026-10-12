"""Сборка звука для испанского трека.

    node scripts/audio-list.mjs es > /tmp/needs-es.json
    python3 scripts/audio/make_audio_es.py /tmp/needs-es.json --models ПАПКА_МОДЕЛЕЙ --asr ПАПКА_WHISPER

Записей носителей пока нет, поэтому всё — синтез речи Piper через sherpa-onnx, модели
с https://github.com/k2-fsa/sherpa-onnx/releases/tag/tts-models:
  * vits-piper-es_ES-sharvard-medium — два голоса (F и M), корпус Sharvard (University of Edinburgh),
    лицензия CC BY 3.0: F — фразы ученика и слова, M — реплики собеседника;
  * vits-piper-es_ES-davefx-medium — мужской голос, лицензия CC0: запасной голос Испании;
  * vits-piper-es_MX-claude-high — голос Мексики, лицензия Apache 2.0: фразы mx-… и уроки с voice: 'mx';
  * vits-piper-es_AR-daniela-high — голос Аргентины, корпус OpenSLR 61, лицензия CC BY-SA 4.0:
    фразы ar-… и уроки с voice: 'ar'.
Голос carlfm (x_low) не используется: слишком низкое качество.

Проверка — как у французского (make_audio_fr.py): фраза из нескольких слов — распознавание речи Whisper
(sherpa-onnx), при расхождении — следующий голос той же страны; отдельные слова — в отчёт с фонетической записью
espeak-ng. Результат: public/audio/es/t-*.mp3 и src/data/lang/es-audio.js; отчёт — audio-report-es.json."""
import argparse, glob, hashlib, json, os, re, subprocess, tempfile, unicodedata

ap = argparse.ArgumentParser()
ap.add_argument('needs'); ap.add_argument('--models', required=True); ap.add_argument('--asr', required=True)
ap.add_argument('--report', default='audio-report-es.json'); ap.add_argument('--force', action='store_true')
ap.add_argument('--redo', help='отчёт прошлого запуска: фразы, где распознавание не совпало, собрать заново')
args = ap.parse_args()
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'public', 'audio', 'es')
MAN = os.path.join(ROOT, 'src', 'data', 'lang', 'es-audio.js')
HEAD = '/* Звуковые файлы трека: ключ (lib/audio-keys.js) → файл в public/audio/. Собирает scripts/audio/make_audio_es.py, руками не править */\nexport default '
os.makedirs(OUT, exist_ok=True)
old = {}
if os.path.exists(MAN):
    body = open(MAN).read().split('export default ', 1)[1].rstrip().rstrip(';')
    old = json.loads(body) if body.strip() not in ('', '{}') else {}
needs = json.load(open(args.needs))
h = lambda k, v: hashlib.sha1(f'{k}|{v}'.encode()).hexdigest()[:10]

import numpy as np, sherpa_onnx, soundfile as sf

def tts(name):
    d = os.path.join(args.models, f'vits-piper-{name}')
    onnx = glob.glob(d + '/*.onnx')[0]
    cfg = sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(vits=sherpa_onnx.OfflineTtsVitsModelConfig(
        model=onnx, tokens=d + '/tokens.txt', data_dir=d + '/espeak-ng-data'), num_threads=2))
    return sherpa_onnx.OfflineTts(cfg)
ENGINES = {'sharvard': tts('es_ES-sharvard-medium'), 'davefx': tts('es_ES-davefx-medium'),
           'mx': tts('es_MX-claude-high'), 'ar': tts('es_AR-daniela-high')}
VOICES = {'ana': ('sharvard', 1), 'pablo': ('sharvard', 0), 'davefx': ('davefx', 0), 'mx': ('mx', 0), 'ar': ('ar', 0)}
ORDER = {'me': ['ana', 'pablo', 'davefx'], 'word': ['ana', 'pablo', 'davefx'], 'tile': ['ana', 'pablo', 'davefx'], 'them': ['pablo', 'davefx', 'ana']}
def voices_for(role):
    # роль с суффиксом страны (me-mx, them-ar, word-mx) — только голос этой страны
    if role.endswith('-mx'): return ['mx']
    if role.endswith('-ar'): return ['ar']
    return ORDER.get(role, ORDER['me'])

W = args.asr
pre = glob.glob(W + '/*-encoder.int8.onnx')[0][:-len('-encoder.int8.onnx')]
asr = sherpa_onnx.OfflineRecognizer.from_whisper(encoder=pre + '-encoder.int8.onnx', decoder=pre + '-decoder.int8.onnx',
                                                 tokens=pre + '-tokens.txt', language='es', task='transcribe', num_threads=2)
def hear(a, sr):
    a = np.concatenate([np.zeros(int(sr * 0.3), 'float32'), a, np.zeros(int(sr * 0.3), 'float32')])
    s = asr.create_stream(); s.accept_waveform(sr, a); asr.decode_stream(s); return s.result.text.strip()
# распознавание пишет числа цифрами — приводим к словам
WORDS = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce',
         'quince', 'dieciseis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidos', 'veintitres', 'veinticuatro',
         'veinticinco', 'veintiseis', 'veintisiete', 'veintiocho', 'veintinueve', 'treinta']
TENS = {3: 'treinta', 4: 'cuarenta', 5: 'cincuenta', 6: 'sesenta', 7: 'setenta', 8: 'ochenta', 9: 'noventa'}
def num(n):
    if n <= 30: return WORDS[n]
    if n < 100: return TENS[n // 10] + ('' if n % 10 == 0 else ' y ' + WORDS[n % 10])
    return str(n)
def norm(t):
    t = unicodedata.normalize('NFC', t.lower()).replace('’', "'").replace('-', ' ')
    t = re.sub(r'\b(\d{1,2})[:.](\d{2})\b', lambda m: f'{num(int(m.group(1)))} {num(int(m.group(2)))}', t)
    t = re.sub(r'\b(\d{1,2})\b', lambda m: num(int(m.group(1))), t)
    t = re.sub(r"[^\w' ]+", ' ', t)
    return ' '.join(t.split())
# значки и немая h: распознавание часто пишет Hida вместо ida, Dónde вместо dónde
plainw = lambda t: unicodedata.normalize('NFD', norm(t)).encode('ascii', 'ignore').decode().replace(' ', '').replace("'", '').replace('h', '')
same = lambda a, b: plainw(a) == plainw(b)

try:
    import espeakng_loader
    from phonemizer.backend.espeak.wrapper import EspeakWrapper
    EspeakWrapper.set_library(espeakng_loader.get_library_path()); EspeakWrapper.set_data_path(espeakng_loader.get_data_path())
    from phonemizer import phonemize
    ipa = lambda t: phonemize(t, language='es', backend='espeak', with_stress=False, preserve_punctuation=False).strip()
except Exception:
    ipa = lambda t: ''

def dist(a, b):
    d = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        p, d[0] = d[0], i
        for j, y in enumerate(b, 1): p, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, p + (x != y))
    return d[len(b)]
def close(ref, got):
    a, b = ipa(ref).replace(' ', ''), ipa(got).replace(' ', '')
    return 1 - dist(a, b) / max(1, len(a)) if a else 0
redo = set()
if args.redo and os.path.exists(args.redo):
    r0 = json.load(open(args.redo)); redo = {x['key'] for x in r0.get('still_imperfect', [])}

# синтезатор читает по правилам espeak-ng: одиночные гласные-названия букв и заимствования записываем так, как они звучат
TTS_FIX = [(r'^wifi$', 'güifi'), (r'\bwifi\b', 'güifi'), (r'\bAlmaty\b', 'Almati'), (r'\bIB\b', 'i be')]
def fixed(t):
    for a, b in TTS_FIX: t = re.sub(a, b, t)
    return t

def synth(text, voice, single):
    eng, sid = VOICES[voice]
    text = fixed(text)
    say = text if not single or re.search(r'[.?!…]$', text) else text + '.'
    a = ENGINES[eng].generate(say, sid=sid, speed=0.9 if single else 1.0)
    return np.asarray(a.samples, dtype='float32'), a.sample_rate
def save(a, sr, dst):
    tmp = tempfile.mktemp(suffix='.wav'); sf.write(tmp, a, sr)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', tmp, '-af',
                    'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,adelay=60,apad=pad_dur=0.1,loudnorm=I=-18:TP=-2:LRA=11',
                    '-ac', '1', '-ar', '24000', '-b:a', '40k', dst], check=True)
    os.remove(tmp)

def write_manifest(final=False):
    open(MAN, 'w').write(HEAD + json.dumps(dict(sorted({**({} if final else old), **manifest}.items())), ensure_ascii=False, indent=0) + ';\n')

manifest, report = {}, {'phrases_imperfect': [], 'words': [], 'counts': {'kept': 0, 'new': 0}}
for n in needs:
    k, text, role = n['key'], n['text'], n['role']
    single = n['words'] == 1
    voices = voices_for(role)
    if not args.force and k not in redo and old.get(k) and os.path.exists(os.path.join(OUT, old[k])):
        manifest[k] = old[k]; report['counts']['kept'] += 1
        if single: report['words'].append({'key': k, 'text': text, 'ipa': ipa(text), 'voice': voices[0]})
        continue
    done = [f't-{h(k, v)}.mp3' for v in voices if os.path.exists(os.path.join(OUT, f't-{h(k, v)}.mp3'))]
    if done and not args.force and k not in redo:
        manifest[k] = done[0]; report['counts']['kept'] += 1; continue
    best = None
    # синтез немного случаен, поэтому при расхождении каждый голос пробует дважды
    tries = [v for v in voices[:1]] if single else [v for v in voices for _ in range(2)]
    for v in tries:
        a, sr = synth(text, v, single)
        if single: best = (a, sr, v, '', 1); break
        got = hear(a, sr)
        if same(text, got): best = (a, sr, v, got, 1); break
        sc = close(text, got)
        report['phrases_imperfect'].append({'key': k, 'text': text, 'heard': got, 'voice': v, 'close': round(sc, 2)})
        if best is None or sc > best[4]: best = (a, sr, v, got, sc)
    a, sr, v, got, sc = best
    name = f't-{h(k, v)}.mp3'
    save(a, sr, os.path.join(OUT, name)); manifest[k] = name; report['counts']['new'] += 1
    if single: report['words'].append({'key': k, 'text': text, 'ipa': ipa(text), 'voice': v})
    elif not same(text, got): report.setdefault('still_imperfect', []).append({'key': k, 'text': text, 'heard': got, 'voice': v, 'close': round(sc, 2)})
    print(f"{report['counts']['new']:4d} {v:8s} {text}", flush=True)
    if report['counts']['new'] % 20 == 0: write_manifest()

used = set(manifest.values())
for f in os.listdir(OUT):
    if f.endswith('.mp3') and f not in used: os.remove(os.path.join(OUT, f))
write_manifest(final=True)
json.dump(report, open(args.report, 'w'), ensure_ascii=False, indent=1)
print(f"готово: {len(manifest)} файлов, новых {report['counts']['new']}, фраз с расхождениями после всех голосов: {len(report.get('still_imperfect', []))}")
