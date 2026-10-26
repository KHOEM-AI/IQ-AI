# IQ-AI — កំណត់ត្រាសម្រាប់អ្នកមកក្រោយ

## IQ-AI ជាអ្វី
សេវា media ឯករាជ្យ (ច្រក 8799) សម្រាប់សំឡេង រូបភាព វីដេអូ និងសញ្ញាអារម្មណ៍។
គម្រោង KHOEM-AI (`~/ai-project/AI`) ហៅវាតាម Vite proxy `/iqai` -> `http://127.0.0.1:8799/api/v1`។

## ប្រភពនៃផ្នែកនីមួយៗក្នុង KHOEM-AI
- ភាសា -> KHOEM_AI
- API -> KI
- សំឡេង វីដេអូ រូបភាព សញ្ញាអារម្មណ៍ -> IQ-AI (ឯកសារនេះ)

## របៀបដំណើរការ
    cd ~/IQ-AI
    cp .env.example .env      # រួចដាក់ IQAI_TOKEN
    npm start
    npm test

- `.env` មិនត្រូវ push ទៅ GitHub ទេ (ត្រូវនៅក្នុង .gitignore)
- IQAI_TOKEN ត្រូវដូចគ្នាទាំងក្នុង `~/IQ-AI/.env` និង `~/ai-project/AI/.env`
  (Vite proxy ក្នុង AI/vite.config.ts ប្រើ process.env.IQAI_TOKEN)
- Termux គ្មាន `/tmp` ប្រើ `$PREFIX/tmp` ជំនួស

## ស្ថានភាព
- ✅ media: upload / list / metadata / download / delete + auth + validation
- ✅ emotion: `POST /api/v1/emotion/analyze` (rule-based ពីអត្ថបទខ្មែរ ពាក្យគន្លឹះ + emoji)
  ក្នុង `src/emotion/analyze.mjs` និង `src/server/routes/emotion.mjs`
- ❌ images/audio/videos process នៅ 501 (មិនទាន់មាន provider)
- ✅ audio inspect: `POST /api/v1/audio/inspect` (WAV -> ល្បឿនសំណាក ឆានែល រយៈពេល)
- ✅ image inspect: `POST /api/v1/images/inspect` (PNG/JPEG/GIF/WebP -> ទំហំ ទទឹង កម្ពស់)
- ❌ emotion ពីសំឡេង/រូបភាព មិនទាន់មាន

## Endpoint ទាំងអស់ដែលធ្វើរួច (2026-10-26)
- `POST /api/v1/emotion/analyze` — JSON `{"text":"..."}` -> អារម្មណ៍
- `POST /api/v1/audio/inspect` — ឯកសារ WAV -> ល្បឿនសំណាក ឆានែល រយៈពេល
- `POST /api/v1/images/inspect` — PNG/JPEG/GIF/WebP -> ទទឹង កម្ពស់
- `POST /api/v1/videos/inspect` — MP4/WebM -> ទទឹង កម្ពស់ រយៈពេល
- តេស្តទាំងអស់ជាប់ (`npm test`)

## Endpoint ទាំងអស់ដែលធ្វើរួច (2026-10-26)
- `POST /api/v1/emotion/analyze` — JSON `{"text":"..."}` -> អារម្មណ៍
- `POST /api/v1/audio/inspect` — ឯកសារ WAV -> ល្បឿនសំណាក ឆានែល រយៈពេល
- `POST /api/v1/images/inspect` — PNG/JPEG/GIF/WebP -> ទទឹង កម្ពស់
- `POST /api/v1/videos/inspect` — MP4/WebM -> ទទឹង កម្ពស់ រយៈពេល
- តេស្តទាំងអស់ជាប់ (`npm test`)

## ជំហានបន្ទាប់
1. ភ្ជាប់ UI ក្នុង KHOEM-AI ឱ្យហៅ `iqaiAnalyzeEmotion`, `iqaiInspectAudio`, `iqaiInspectImage`
2. `images/audio/videos/process` នៅ 501 រហូតដល់មាន provider

## Emotion៖ ពាក្យអវិជ្ជមាន (2026-10-26)
- ពាក្យ មិន / គ្មាន / កុំ / ពុំ នៅមុខពាក្យអារម្មណ៍ ត្រូវបានដោះស្រាយ៖
  joy/love ត្រូវបានបញ្ច្រាស់ទៅ sadness ហើយ sadness/anger/fear ក្លាយជា neutral
- ពាក្យតែមួយ (ឧ. "មិនពេញចិត្ត") នៅក្នុងបញ្ជីរួចហើយ ប្រើតាមបញ្ជី
- នៅមានកម្រិត៖ ពាក្យគន្លឹះប៉ុណ្ណោះ មិនយល់ប្រយោគស្មុគស្មាញ ឬសំនួនប្រៀបធៀប

## Emotion៖ បន្ថែមពាក្យ (2026-10-26)
- បន្ថែមពាក្យ និង emoji ច្រើនសម្រាប់ទាំង 6 អារម្មណ៍ តាម `EXTRA` ក្នុង `src/emotion/analyze.mjs`
- ចង់បន្ថែមពាក្យថ្មី៖ ដាក់ក្នុង `EXTRA` រួចបន្ថែមតេស្តក្នុង `tests/emotion.test.mjs`
- ពាក្យ "ល្អ" ទូទៅពេក អាចចេញ joy ក្នុងប្រយោគមិនទាក់ទងអារម្មណ៍
