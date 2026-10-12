"""Сборка звука для французского трека.

    node scripts/audio-list.mjs fr > /tmp/needs-fr.json
    python3 scripts/audio/make_audio_fr.py /tmp/needs-fr.json --models ПАПКА_МОДЕЛЕЙ --asr ПАПКА_WHISPER

Записей носителей пока нет (архивы Lingua Libre и Викисклада из среды сборки недоступны), поэтому всё —
синтез речи Piper через sherpa-onnx, модели с https://github.com/k2-fsa/sherpa-onnx/releases/tag/tts-models:
  * vits-piper-fr_FR-siwis-medium — женский голос, корпус SIWIS, лицензия CC BY 4.0: фразы ученика и слова;
  * vits-piper-fr_FR-upmc-medium — голоса jessica и pierre, корпус UPMC, лицензия CC BY-SA 4.0:
    pierre — реплики собеседника в сценариях, jessica — запасной голос.
Голоса gilles и tom не используются: у gilles в словаре нет знака носовых гласных (bon звучал бы как beau),
у tom лицензия AGPL.

Проверка:
  * фраза из нескольких слов — распознавание речи Whisper small или base (sherpa-onnx, asr-models): если распознанный
    текст не совпал с исходным, фраза синтезируется другим голосом; не совпавшие ни разу — в отчёт;
  * отдельное слово распознавание проверяет плохо, поэтому в отчёт пишется его фонетическая запись espeak-ng
    (по ней и читает синтезатор) — отчёт просматривается глазами.
Отдельное слово синтезируется с точкой на конце (спокойная интонация утверждения) и чуть медленнее фразы.

Результат: public/audio/fr/t-*.mp3 и src/data/lang/fr-audio.js (ключ → имя файла); отчёт — audio-report-fr.json.
Уже собранные файлы не пересинтезируются, если ключ и голос не изменились."""
import argparse, glob, hashlib, json, os, re, subprocess, tempfile, unicodedata

ap = argparse.ArgumentParser()
ap.add_argument('needs'); ap.add_argument('--models', required=True); ap.add_argument('--asr', required=True)
ap.add_argument('--report', default='audio-report-fr.json'); ap.add_argument('--force', action='store_true')
ap.add_argument('--redo', help='отчёт прошлого запуска: фразы, где распознавание не совпало, собрать заново')
args = ap.parse_args()
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'public', 'audio', 'fr')
MAN = os.path.join(ROOT, 'src', 'data', 'lang', 'fr-audio.js')
HEAD = '/* Звуковые файлы трека: ключ (lib/audio-keys.js) → файл в public/audio/. Собирает scripts/audio/make_audio_fr.py, руками не править */\nexport default '
os.makedirs(OUT, exist_ok=True)
old = json.loads(open(MAN).read().split('export default ', 1)[1].rstrip().rstrip(';')) if os.path.exists(MAN) else {}
needs = json.load(open(args.needs))
h = lambda k, v: hashlib.sha1(f'{k}|{v}'.encode()).hexdigest()[:10]

import numpy as np, sherpa_onnx, soundfile as sf

def tts(name):
    d = os.path.join(args.models, f'vits-piper-fr_FR-{name}')
    onnx = glob.glob(d + '/*.onnx')[0]
    cfg = sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(vits=sherpa_onnx.OfflineTtsVitsModelConfig(
        model=onnx, tokens=d + '/tokens.txt', data_dir=d + '/espeak-ng-data'), num_threads=2))
    return sherpa_onnx.OfflineTts(cfg)
ENGINES = {'siwis': tts('siwis-medium'), 'upmc': tts('upmc-medium')}
VOICES = {'siwis': ('siwis', 0), 'jessica': ('upmc', 0), 'pierre': ('upmc', 1)}
ORDER = {'me': ['siwis', 'jessica', 'pierre'], 'word': ['siwis', 'jessica', 'pierre'], 'tile': ['siwis', 'jessica'], 'them': ['pierre', 'jessica', 'siwis']}

W = args.asr
# модель Whisper берётся из папки --asr (small точнее, base втрое быстрее)
pre = glob.glob(W + '/*-encoder.int8.onnx')[0][:-len('-encoder.int8.onnx')]
asr = sherpa_onnx.OfflineRecognizer.from_whisper(encoder=pre + '-encoder.int8.onnx', decoder=pre + '-decoder.int8.onnx',
                                                 tokens=pre + '-tokens.txt', language='fr', task='transcribe', num_threads=2)
def hear(a, sr):
    a = np.concatenate([np.zeros(int(sr * 0.3), 'float32'), a, np.zeros(int(sr * 0.3), 'float32')])
    s = asr.create_stream(); s.accept_waveform(sr, a); asr.decode_stream(s); return s.result.text.strip()
# распознавание пишет числа цифрами и «8h» вместо «huit heures» — приводим к словам
WORDS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix sept', 'dix huit', 'dix neuf', 'vingt']
def norm(t):
    t = unicodedata.normalize('NFC', t.lower()).replace('’', "'").replace('-', ' ')
    t = re.sub(r'\b(\d{1,2})\s*h\b', lambda m: f'{m.group(1)} heures', t)
    t = re.sub(r'\b(\d{1,2})\b', lambda m: WORDS[int(m.group(1))] if int(m.group(1)) <= 20 else m.group(1), t)
    t = re.sub(r"[^\w' ]+", ' ', t)
    return ' '.join(t.split())
plainw = lambda t: unicodedata.normalize('NFD', norm(t)).encode('ascii', 'ignore').decode().replace(' ', '').replace("'", '')
same = lambda a, b: plainw(a) == plainw(b)          # значки распознавание часто теряет: Hotel вместо hôtel

try:
    import espeakng_loader
    from phonemizer.backend.espeak.wrapper import EspeakWrapper
    EspeakWrapper.set_library(espeakng_loader.get_library_path()); EspeakWrapper.set_data_path(espeakng_loader.get_data_path())
    from phonemizer import phonemize
    ipa = lambda t: phonemize(t, language='fr-fr', backend='espeak', with_stress=False, preserve_punctuation=False).strip()
except Exception:                                      # без фонемайзера отчёт просто без фонетической записи
    ipa = lambda t: ''

def dist(a, b):
    d = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        p, d[0] = d[0], i
        for j, y in enumerate(b, 1): p, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, p + (x != y))
    return d[len(b)]
def close(ref, got):
    """Насколько распознанное близко к исходному по звукам (фонетической записи espeak): 1 — совпало"""
    a, b = ipa(ref).replace(' ', ''), ipa(got).replace(' ', '')
    return 1 - dist(a, b) / max(1, len(a)) if a else 0
redo = set()
if args.redo and os.path.exists(args.redo):
    r0 = json.load(open(args.redo)); redo = {x['key'] for x in r0.get('still_imperfect', [])}

# синтезатор читает по правилам espeak-ng: несколько заимствований он принимает за английские слова,
# а отдельную y — за название буквы. Для синтеза их записываем так, как они звучат по-французски
TTS_FIX = [(r'\bsteak', 'stèque'), (r'\bwifi\b', 'oui-fi'), (r'\bAlmaty\b', 'Almati'), (r'\bRouen\b', 'Rouan'), (r'^y$', 'i')]
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
    voices = ORDER.get(role, ORDER['me'])
    name = f't-{h(k, voices[0])}.mp3'
    if not args.force and k not in redo and old.get(k) and os.path.exists(os.path.join(OUT, old[k])):
        manifest[k] = old[k]; report['counts']['kept'] += 1
        if single: report['words'].append({'key': k, 'text': text, 'ipa': ipa(text)})
        continue
    # прерванный запуск: файл этого ключа уже синтезирован и проверен — берём его
    done = [f't-{h(k, v)}.mp3' for v in voices if os.path.exists(os.path.join(OUT, f't-{h(k, v)}.mp3'))]
    if done and not args.force and k not in redo:
        manifest[k] = done[0]; report['counts']['kept'] += 1; continue
    best = None
    for v in (voices[:1] if single else voices):
        a, sr = synth(text, v, single)
        if single: best = (a, sr, v, '', 1); break
        got = hear(a, sr)
        if same(text, got): best = (a, sr, v, got, 1); break
        sc = close(text, got)
        report['phrases_imperfect'].append({'key': k, 'text': text, 'heard': got, 'voice': v, 'close': round(sc, 2)})
        if best is None or sc > best[4]: best = (a, sr, v, got, sc)      # ни один голос не совпал — самый близкий по звукам
    a, sr, v, got, sc = best
    name = f't-{h(k, v)}.mp3'
    save(a, sr, os.path.join(OUT, name)); manifest[k] = name; report['counts']['new'] += 1
    if single: report['words'].append({'key': k, 'text': text, 'ipa': ipa(text)})
    elif not same(text, got): report.setdefault('still_imperfect', []).append({'key': k, 'text': text, 'heard': got, 'voice': v, 'close': round(sc, 2)})
    print(f"{report['counts']['new']:4d} {v:8s} {text}", flush=True)
    if report['counts']['new'] % 20 == 0: write_manifest()      # чтобы прерванный запуск можно было продолжить

# лишние файлы (от удалённых фраз) не нужны в сборке
used = set(manifest.values())
for f in os.listdir(OUT):
    if f.endswith('.mp3') and f not in used: os.remove(os.path.join(OUT, f))
write_manifest(final=True)
json.dump(report, open(args.report, 'w'), ensure_ascii=False, indent=1)
print(f"готово: {len(manifest)} файлов, новых {report['counts']['new']}, фраз с расхождениями после всех голосов: {len(report.get('still_imperfect', []))}")
