# KHOEM-AI · ផែនទីប្រព័ន្ធ (System Map)

ឯកសារនេះពន្យល់ថា ផ្នែកនីមួយៗនៃ KHOEM-AI ធ្វើអ្វី និងភ្ជាប់គ្នាយ៉ាងណា។
ឯកសារដូចគ្នានេះមាននៅក្នុង repo KI, AI និង IQ-AI ។ កំណែដើមនៅ `KI/docs/SYSTEM_MAP.md` (កែនៅទីនោះ រួចចម្លងទៅពីរទៀត)។

## ផ្នែកទាំងអស់

| Repo | តួនាទី | ច្រក |
|---|---|---|
| **AI** | **UI** — ផ្ទាំងដែលអ្នកប្រើមើល និងចុច (មាន AI backend ផង) | UI `5175` · backend `8787` |
| **KI** | **API** — កន្លែងចែកចាយ API និងទិន្នន័យកណ្តាល | `5001` |
| **IQ-AI** | សំឡេង វីដេអូ រូបភាព | `8799` |
| **KSV** | បញ្ជាឧបករណ៍អេឡិចត្រូនិចទូទៅ (gateway · API · UI) | gateway `4000` · API `3000` · UI `5173` |
| **khoem-now** | ពណ៌ និងអំពូល (ទិន្នន័យកណ្តាល) | គ្មានច្រក — ជាឯកសារក្នុង `data/` |
| **KHOEM_AI** | ភាសា និងកូដ | `8790` |
| **KEI** | ក្តារចុចខ្មែរ និង editor (React Native) | គ្មានច្រក |
| **EI-T** | គណិតវិទ្យាត្រឹមត្រូវ | `3100` |
| **CAI** | ស្គេនរូបថតរាប់ចំនួន និងទីតាំង | scan `5180` · share `5181` |
| **MI-K-VISION-3D** | ស្ទូឌីយោ 3D | `5176` |
| **Central-Intelligence-Data-Core (CIDC)** | ទិន្នន័យកូដ/ភាសាកណ្តាល · ប្រព័ន្ធការពារឯកសារ | API `8800` · UI `5190` |

## UI និង API ខុសគ្នាយ៉ាងណា

- **UI** ដូចមុខហាង៖ ជាអ្វីដែលអ្នកប្រើមើលឃើញ និងចុច (បើកតាម `http://localhost:5175`)។
- **API** ដូចទ្វារសេវា៖ ទំព័រ ឬកម្មវិធីផ្សេងៗហៅមកយកទិន្នន័យ ឬបញ្ជូនទិន្នន័យមកទុក។
- UI មិនទុកទិន្នន័យ ឬ key ក្នុងខ្លួនទេ វាទាញពី API។ **KI** ជាកន្លែងចែកចាយ API នេះ។
    ┌─ AI backend  (8787)
AI UI ──┼─ KHOEM_AI    (8790)  ភាសា និងកូដ
(5175)  ├─ IQ-AI       (8799)  សំឡេង វីដេអូ រូបភាព
├─ KSV         (4000)  ឧបករណ៍អេឡិចត្រូនិច
└─ /ki proxy ──► KI API (5001)  ← ទំព័រផ្សេងៗក៏មកទាញពីទីនេះ
MI-K (5176) និង CAI (5180) ក៏ហៅ KI តាម proxy /ki ដូចគ្នា
## KI API (ច្រក 5001)

KI ស្តាប់តែ `127.0.0.1`។ **គ្រប់ route លើកលែង `GET /api/healthz` ត្រូវការ header `x-ki-token`** (token នៅ `~/KI/.env` មិនឡើង GitHub)។ ទំព័រ (UI) មិនត្រូវដាក់ token ក្នុង browser ទេ ត្រូវហៅតាម proxy `/ki` ដែល server ដាក់ token ឱ្យ។

| Method | Route | ការពន្យល់ |
|---|---|---|
| GET | `/api/healthz` | ពិនិត្យថា KI រស់ (បើកចំហ) |
| GET, POST | `/api/colors` | បញ្ជី / រក្សា palette ពណ៌ |
| GET, POST | `/api/scans` | បញ្ជី / រក្សាលទ្ធផលស្កេន CAI |
| POST | `/api/scan` | ស្កេនដោយ AI vision — មិនទាន់កំណត់ (ឆ្លើយ 501) |
| GET | `/api/registry`, `/api/registry/<ឈ្មោះ>` | ឯកសារក្នុង `data/` (អានតែប៉ុណ្ណោះ) |
| GET, POST | `/api/notify`, `/api/notifications`, `/api/status` | ការជូនដំណឹង និងស្ថានភាពសេវា |
| * | `/v1/...` | ច្រកមានកំណែ (chat, search, translate, math, audio, videos, media, projects, files, data, keys, usage, system) |
| * | `/gw/<សេវា>/...` | gateway ទៅសេវាផ្សេង (ai, cidc, lang, ei-t, iqai) ដែលអនុញ្ញាតតែ route ក្នុងបញ្ជី |

ព័ត៌មានលម្អិត៖ `docs/API.md` និង `docs/ARCHITECTURE.md`។ កូដ៖ `KI/src/` (Node ធម្មតា គ្មាន dependency)។ ទិន្នន័យទុកក្នុង `~/.ki-*.json` (មិនឡើង GitHub)។

## ទំព័រ Color and Light

ក្នុង UI ៖ ម៉ឺនុយ → **Color and Light · ពណ៌ និងអំពូលភ្លើង**។ **Save → KI** រក្សា palette ទៅ KI · **Load from KI** ទាញមកវិញ។ កូដ៖ `AI/src/components/ColorLightCenter.tsx`។

## របៀបបើក
ai            # បើកទាំងអស់
ai stop       # បិទទាំងអស់
ai restart    # បើកឡើងវិញ
ai status     # ស្ថានភាពសេវានីមួយៗ
ai check      # ពិនិត្យ API (AI_CHECK_WAIT=30 ដើម្បីរង់ចាំ)
ពាក្យ `ai` ដំណើរការ `~/KSV/ai.sh`។

## ច្បាប់ថែទាំ

1. បម្រុងទុកឯកសារមុនកែ (`cp file file.bak-...`) មិនលុបអ្វីដែលកំពុងដំណើរការ។
2. កុំដាក់ key ឬលេខសម្ងាត់ក្នុង GitHub ឬក្នុងទំព័រ UI (key នៅ `.env` ក្នុង server)។
3. Push តាមឈ្មោះឯកសារ (`git add <file>`) មិនប្រើ `git add .` ក្នុងថត Home។
4. ទំព័រថ្មីទាញទិន្នន័យពី KI មិនបង្កើតកន្លែងទុកទិន្នន័យដាច់ដោយឡែកទេ។
5. ឈ្មោះ និងឡូហ្គោ **KHOEM-AI** មិនត្រូវប្តូរ។

_ធ្វើបច្ចុប្បន្នភាព៖ 2026-11-23_
