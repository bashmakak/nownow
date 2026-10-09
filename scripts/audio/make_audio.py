"""Сборка звука для языкового трека.

    node scripts/audio-list.mjs > /tmp/needs.json
    python3 scripts/audio/make_audio.py /tmp/needs.json --cmn ПАПКА_AUDIO_CMN --models ПАПКА_МОДЕЛЕЙ

Источники, по порядку предпочтения:
  1. Слог (ключ s:…) — запись носителя из проекта audio-cmn (голос Chen Wang, CC BY-SA):
     https://github.com/hugolpz/audio-cmn, папка 24k-abr/syllabs. Файл копируется без изменений.
  2. Слово или короткая фраза, которые есть в наборе HSK того же проекта (голос Yue Tan, проект Shtooka, CC BY-SA),
     — тоже без изменений, меняется только имя файла.
  3. Остальное — синтез речи Kokoro-82M v1.1-zh (Apache 2.0) через sherpa-onnx, модели с
     https://github.com/k2-fsa/sherpa-onnx/releases/tag/tts-models. Каждую фразу проверяет распознавание речи
     (Paraformer, тоже из sherpa-onnx): если распознанный текст не совпал с исходным, фраза пересинтезируется
     другим голосом. Фразы, которые не совпали ни с одним голосом, попадают в отчёт для ручной проверки.
     Повторный запуск с --retry ПРОШЛЫЙ_ОТЧЁТ пересинтезирует такие фразы с бо́льшим набором голосов.
  Несколько слов, которые синтез стабильно читает неверно (GLUE ниже), склеиваются из записей слогов Chen Wang
  с короткими паузами — только слова из слогов первого тона, где при склейке тон не искажается.
  Слога, которого нет среди записей Chen Wang, берётся запись того же проекта (Yue Tan) отдельного иероглифа
  с этим чтением (чтение — по pypinyin), а если и её нет — синтез этого иероглифа.

Результат: public/audio/<код>/*.mp3 и src/data/lang/<код>-audio.js (ключ → имя файла). Файлы коммитятся:
на сервере публикации моделей нет. Запускать нужно после любой правки текстов трека — проверка данных
(scripts/validate-lang.mjs) не пропустит фразу без звука."""
import argparse, hashlib, json, os, re, shutil, subprocess, sys, tempfile

ap = argparse.ArgumentParser()
ap.add_argument('needs'); ap.add_argument('--cmn', required=True); ap.add_argument('--models', required=True)
ap.add_argument('--code', default='zh'); ap.add_argument('--report', default='audio-report.json')
ap.add_argument('--retry', help='отчёт прошлого запуска: неточно синтезированные фразы сделать заново')
args = ap.parse_args()
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'public', 'audio', args.code)
MAN = os.path.join(ROOT, 'src', 'data', 'lang', f'{args.code}-audio.js')
HEAD = '/* Звуковые файлы трека: ключ (lib/audio-keys.js) → файл в public/audio/. Собирает scripts/audio/make_audio.py, руками не править */\nexport default '
os.makedirs(OUT, exist_ok=True)
old = json.loads(open(MAN).read().split('export default ', 1)[1].rstrip().rstrip(';')) if os.path.exists(MAN) else {}
needs = json.load(open(args.needs))
SYL = os.path.join(args.cmn, '24k-abr', 'syllabs'); HSK = os.path.join(args.cmn, '24k-abr', 'hsk')
HAN = re.compile(r'[一-鿿]')
h = lambda k: hashlib.sha1(k.encode()).hexdigest()[:10]

# слова, которые Kokoro читает неверно (распознавание слышит «性弃»): склейка записей слогов первого тона
GLUE = {'星期一': ['xing1', 'qi1', 'yi1'], '星期天': ['xing1', 'qi1', 'tian1']}
TRIM = 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse'
def glue(parts, out):
    tmp = tempfile.mkdtemp(); pieces = []
    for k, syl in enumerate(parts):
        w = os.path.join(tmp, f'{k}.wav')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(SYL, f'cmn-{syl}.mp3'), '-af', TRIM, '-ac', '1', '-ar', '24000', w], check=True)
        pieces.append(w)
    inputs = sum((['-i', w] for w in pieces), [])
    chain = ''.join(f'[{k}]apad=pad_dur=0.04[p{k}];' for k in range(len(pieces))) + ''.join(f'[p{k}]' for k in range(len(pieces))) + f'concat=n={len(pieces)}:v=0:a=1,adelay=60,apad=pad_dur=0.08,loudnorm=I=-18:TP=-2:LRA=11'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *inputs, '-filter_complex', chain, '-ac', '1', '-ar', '24000', '-b:a', '40k', out], check=True)

FILLER = re.compile(r'[啊呀哦呢嗯耶了吧]+$')
same = lambda ref, hyp: ''.join(HAN.findall(ref)) == FILLER.sub('', ''.join(HAN.findall(hyp)))   # лишняя частица в конце — огрехи распознавания
retry = set()
if args.retry and os.path.exists(args.retry):
    retry = {x['key'] for x in json.load(open(args.retry))['tts_imperfect'] if not same(x['text'], x['heard'])}

def char_for(num):
    """Иероглиф с чтением num (ju4), для которого есть запись HSK; иначе любой частый знак с этим чтением"""
    from pypinyin import pinyin, Style
    read = lambda ch: pinyin(ch, style=Style.TONE3, heteronym=False, neutral_tone_with_five=True)[0][0].replace('ü', 'v')
    singles = sorted(f[4:-4] for f in os.listdir(HSK) if f.startswith('cmn-') and len(f) == 9)
    for ch in singles:
        if read(ch) == num: return ch, True
    for code in range(0x4E00, 0x9FA6):
        if read(chr(code)) == num: return chr(code), False
    return None, False

manifest, report, tts_todo = {}, {'syl_missing': [], 'syl_substitute': {}, 'tts_imperfect': [], 'sources': {'syl': 0, 'hsk': 0, 'tts': 0}}, []
for n in needs:
    k = n['key']
    if k.startswith('s:'):
        src = os.path.join(SYL, f"cmn-{k[2:]}.mp3")
        if os.path.exists(src):
            name = f"cmn-{k[2:]}.mp3"; shutil.copyfile(src, os.path.join(OUT, name)); manifest[k] = name; report['sources']['syl'] += 1
            continue
        # слога нет среди записей Chen Wang: отдельный иероглиф с тем же чтением
        ch, rec = char_for(k[2:])
        if not ch: report['syl_missing'].append(k); continue
        report['syl_substitute'][k] = ch
        if rec:
            name = f'w-{h(k)}.mp3'; shutil.copyfile(os.path.join(HSK, f'cmn-{ch}.mp3'), os.path.join(OUT, name)); manifest[k] = name; report['sources']['hsk'] += 1
            continue
        n = {**n, 'zh': ch, 'role': 'word'}
    else:
        word = k[2:]
        src = os.path.join(HSK, f'cmn-{word}.mp3')
        if os.path.exists(src):
            name = f'w-{h(k)}.mp3'; shutil.copyfile(src, os.path.join(OUT, name)); manifest[k] = name; report['sources']['hsk'] += 1
            continue
        if word in GLUE:
            name = f'g-{h(k)}.mp3'; glue(GLUE[word], os.path.join(OUT, name)); manifest[k] = name; report['sources']['glue'] = report['sources'].get('glue', 0) + 1
            continue
    name = f't-{h(k)}.mp3'
    if old.get(k) == name and os.path.exists(os.path.join(OUT, name)) and k not in retry:
        manifest[k] = name; report['sources']['tts'] += 1; continue      # уже синтезировано раньше
    tts_todo.append((n, name))

print(f"слоги: {report['sources']['syl']}, записи HSK: {report['sources']['hsk']}, синтез: {len(tts_todo)} новых", flush=True)
if tts_todo:
    import numpy as np, sherpa_onnx, soundfile as sf
    K = os.path.join(args.models, 'kokoro-multi-lang-v1_1')
    tts = sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(
        model=sherpa_onnx.OfflineTtsModelConfig(kokoro=sherpa_onnx.OfflineTtsKokoroModelConfig(
            model=f'{K}/model.onnx', voices=f'{K}/voices.bin', tokens=f'{K}/tokens.txt',
            lexicon=f'{K}/lexicon-us-en.txt,{K}/lexicon-zh.txt', data_dir=f'{K}/espeak-ng-data', dict_dir=f'{K}/dict'), num_threads=4),
        rule_fsts=f'{K}/phone-zh.fst,{K}/date-zh.fst,{K}/number-zh.fst', max_num_sentences=1))
    P = os.path.join(args.models, 'sherpa-onnx-paraformer-zh-2024-03-09')
    asr = sherpa_onnx.OfflineRecognizer.from_paraformer(paraformer=f'{P}/model.int8.onnx', tokens=f'{P}/tokens.txt', num_threads=4)
    # голоса Kokoro v1.1-zh: 58, 62, 90 — мужские, 5, 8, 45 — женские; выбраны по точности распознавания
    VOICES = {'me': [58, 62, 8, 5, 90], 'word': [58, 62, 8, 5, 90], 'them': [8, 5, 45, 58, 62]}
    MORE = [3, 10, 20, 30, 40, 50, 70, 80, 95, 100]           # для повторного синтеза: другие китайские голоса (3–102)
    def cer(ref, hyp):
        a = HAN.findall(ref); b = HAN.findall(hyp)
        d = list(range(len(b) + 1))
        for i, ca in enumerate(a, 1):
            p = d[:]; d[0] = i
            for j, cb in enumerate(b, 1): d[j] = min(p[j] + 1, d[j - 1] + 1, p[j - 1] + (ca != cb))
        return d[-1] / max(1, len(a))
    tmp = tempfile.mkdtemp()
    for i, (n, name) in enumerate(tts_todo):
        text = n['zh'].replace('……', '').replace('…', '').strip() or n['zh']
        best = None
        tries = [(sid, 0.85, text) for sid in VOICES.get(n['role'], VOICES['me'])]
        if n['key'] in retry:      # короткие фразы синтез читает хуже: другие голоса, медленнее, с точкой в конце
            tries += [(sid, sp, t) for sid in MORE for sp, t in ((0.85, text), (0.75, text + '。'))]
        for sid, speed, t in tries:
            a = tts.generate(t, sid=sid, speed=speed)
            st = asr.create_stream(); st.accept_waveform(a.sample_rate, np.array(a.samples, dtype=np.float32)); asr.decode_stream(st)
            c = 0 if same(text, st.result.text) else cer(text, st.result.text)
            if best is None or c < best[0]: best = (c, sid, a, st.result.text)
            if c == 0: break
        c, sid, a, hyp = best
        wav = os.path.join(tmp, 'x.wav'); sf.write(wav, np.array(a.samples), a.sample_rate)
        # тишина по краям убирается, громкость выравнивается под записи носителей
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-af',
                        'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,adelay=60,apad=pad_dur=0.08,loudnorm=I=-18:TP=-2:LRA=11',
                        '-ac', '1', '-ar', '24000', '-b:a', '40k', os.path.join(OUT, name)], check=True)
        manifest[n['key']] = name; report['sources']['tts'] += 1
        if c > 0: report['tts_imperfect'].append({'key': n['key'], 'text': text, 'heard': hyp, 'cer': round(c, 2), 'voice': sid})
        if i % 20 == 0: print(f'{i + 1}/{len(tts_todo)} {text} → {hyp} ({c:.2f}, голос {sid})', flush=True)
# лишние файлы от прошлых сборок удаляются
keep = set(manifest.values())
for f in os.listdir(OUT):
    if f.endswith('.mp3') and f not in keep: os.remove(os.path.join(OUT, f))
open(MAN, 'w').write(HEAD + json.dumps(dict(sorted(manifest.items())), ensure_ascii=False, indent=0) + ';\n')
json.dump(report, open(args.report, 'w'), ensure_ascii=False, indent=1)
print('готово:', report['sources'], 'нет слогов:', report['syl_missing'], 'замена слогов:', report['syl_substitute'], 'неточный синтез:', len(report['tts_imperfect']), flush=True)
