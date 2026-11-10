# 🎧 IQ-AI

សេវា media ឯករាជ្យ៖ **សំឡេង · រូបភាព · វីដេអូ · សញ្ញាអារម្មណ៍**។
កម្មវិធីផ្សេងៗ upload រក្សា កែ និងទាញយក media តាម HTTP API តែមួយ។
ដំណើរការ offline ទាំងស្រុងលើទូរស័ព្ទ (Termux) គ្មាន cloud គ្មានថ្លៃ។

`Node 22+` · `ffmpeg` · ច្រក `8799` · **240 តេស្តជាប់ (បានរត់លើ Termux)**

## ⚡ ចាប់ផ្តើម

```bash
pkg install nodejs git curl ffmpeg
cd ~/IQ-AI
cp .env.example .env     # ដាក់ IQAI_TOKEN ជាអក្សរវែងចៃដន្យ
npm start                # ឬ ./ai.sh start
npm test
```

លម្អិត Termux (ពុម្ពអក្សរខ្មែរ, token, troubleshooting)៖ [docs/TERMUX.md](docs/TERMUX.md)

## ✅ អ្វីដែលដំណើរការហើយ (បានតេស្ត)

| ផ្នែក | មុខងារ |
|---|---|
| 📦 Media | upload, list, download (Range), rename, delete, ពិនិត្យប្រភេទ/ទំហំ, ឈ្មោះឯកសារខ្មែរ |
| 🔊 បណ្ណាល័យសំឡេង | ស្វែងរក, tags, favorites, PATCH កែ, seed 209 សំឡេងសំយោគ |
| 🎙️ Audio | ប្តូរសំឡេង 22 preset, កែ (trim/fade/reverse/normalize/denoise/removeSilence), បង្កើត sfx |
| 🎬 Video (ffmpeg) | រូប→វីដេអូ zoom, អត្ថបទខ្មែរ→វីដេអូ, កែ (trim/speed/mute/resize), thumbnail, ដកសំឡេង |
| 🧠 Emotion | វិភាគអារម្មណ៍អត្ថបទខ្មែរតាមច្បាប់ (6 អារម្មណ៍, ពាក្យអវិជ្ជមាន, emoji) |
| 🔍 Inspect | អានព័ត៌មាន audio / image / video |
| ⚙️ C++ native | វិភាគ peak/RMS សម្រាប់ WAV PCM8/16/24/32 និង float (មាន JS fallback) |
| 🧭 Capabilities | `GET /api/v1/capabilities` ប្រាប់ UI ថា ffmpeg / ពុម្ពអក្សរ / C++ មានអត់ និងមុខងារណាត្រៀមរួច |
| 🖥️ Sound Studio | ទំព័រ `/ui` ពី server ផ្ទាល់ |
| 🔐 សុវត្ថិភាព | bearer token គ្រប់ route លើកលែង health; bind `127.0.0.1` |

API ទាំងអស់៖ [docs/API.md](docs/API.md) · [AUDIO](docs/AUDIO.md) · [VIDEO](docs/VIDEO.md)

## 🔗 ការភ្ជាប់ជាមួយ UI (`AI` repo)

- Vite proxy `/iqai` → `http://127.0.0.1:8799/api/v1` មានរួចហើយ (បន្ថែម token ឱ្យ)
- `ui-kit/iqaiClient.ts` (client មានប្រភេទ) និង `ui-kit/IqAiStudio.tsx` (ផ្ទាំង 5 tab) ត្រៀមរួច
- ជំហាន៖ [ui-kit/README.md](ui-kit/README.md)

## 🚧 មិនទាន់ធ្វើ

- **ផ្ទាំង `IqAiStudio` មិនទាន់ដាក់ក្នុង `App.tsx`** (UI នៅប្រើ `AvStudio` ចាស់) និងមិនទាន់តេស្តក្នុង Vite
- TTS (`/audio/tts` → 501) និងការបង្កើតដោយ AI (`/…/process` → 501): ត្រូវការ provider
- សំឡេងពិត (បណ្ណាល័យឥឡូវជាសំយោគ; គោលដៅ 10,000 សំឡេងមានអាជ្ញាបណ្ណ)
- Thumbnail រូបភាព, ពេលវេលា ogg/mp3/webm, job queue, ម្ចាស់ផ្សេងគ្នាច្រើនគណនី

ស្ថានភាពលម្អិត៖ [docs/STATUS.md](docs/STATUS.md) · ផែនទីប្រព័ន្ធ KHOEM-AI៖ [docs/SYSTEM_MAP.md](docs/SYSTEM_MAP.md)

## 🔒 សុវត្ថិភាព

`.env` និង `data/` មិនត្រូវបានរុញទៅ GitHub។ កុំដាក់ token ក្នុង chat ឬ commit។
