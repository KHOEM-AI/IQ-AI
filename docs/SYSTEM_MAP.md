# KHOEM-AI · ផែនទីប្រព័ន្ធ (System Map)

ឯកសារនេះពន្យល់ថា ផ្នែកនីមួយៗនៃ KHOEM-AI ធ្វើអ្វី និងភ្ជាប់គ្នាយ៉ាងណា។
ឯកសារដូចគ្នានេះមាននៅគ្រប់ repo ដើម្បីឱ្យអ្នកណាក៏យល់បាន។

## ផ្នែកទាំង ៦

| Repo | តួនាទី | ច្រក |
|---|---|---|
| **AI** | **UI** — ផ្ទាំងដែលអ្នកប្រើមើល និងចុច (មាន AI backend ផង) | UI `5175` · backend `8787` |
| **KI** | **API** — កន្លែងចែកចាយ API ឱ្យទំព័រផ្សេងៗមកទាញប្រើ | `5001` |
| **IQ-AI** | សំឡេង វីដេអូ រូបភាព | `8799` |
| **KSV** | បញ្ជាឧបករណ៍អេឡិចត្រូនិចទូទៅ (Gateway) | `4000` |
| **khoem-now** | ពណ៌ និងអំពូល (ទិន្នន័យកណ្តាល) | គ្មានច្រក — ជាឯកសារក្នុង `data/` |
| **KHOEM_AI** | ភាសា និងកូដ | `8790` |

## UI និង API ខុសគ្នាយ៉ាងណា

- **UI** ដូចមុខហាង៖ ជាអ្វីដែលអ្នកប្រើមើលឃើញ និងចុច (បើកតាម `http://localhost:5175`)។
- **API** ដូចទ្វារសេវា៖ ទំព័រ ឬកម្មវិធីផ្សេងៗហៅមកយកទិន្នន័យ ឬបញ្ជូនទិន្នន័យមកទុក។
- UI មិនទុកទិន្នន័យ ឬ key ក្នុងខ្លួនទេ វាទាញពី API។ **KI** ជាកន្លែងចែកចាយ API នេះ។

```
        ┌─ AI backend  (8787)
AI UI ──┼─ KHOEM_AI    (8790)  ភាសា និងកូដ
(5175)  ├─ IQ-AI       (8799)  សំឡេង វីដេអូ រូបភាព
        ├─ KSV         (4000)  ឧបករណ៍អេឡិចត្រូនិច
        └─ KI API      (5001)  ← ទំព័រផ្សេងៗក៏មកទាញពីទីនេះ

khoem-now = ទិន្នន័យពណ៌ និងអំពូល (UI អានតាម AI backend)
```

## KI API (ច្រក 5001)

| Method | Route | ការពន្យល់ |
|---|---|---|
| GET | `/api/healthz` | ពិនិត្យថា KI រស់ |
| POST | `/api/tools/chef` | ឧបករណ៍ Chef |
| POST | `/api/tools/tutor` | ឧបករណ៍ Tutor |
| GET | `/api/tools/market` | ទិន្នន័យទីផ្សារ |
| GET | `/api/tools/stocks` | ទិន្នន័យ stocks |
| GET | `/api/colors` | បញ្ជី palette ពណ៌ដែលបានរក្សា |
| POST | `/api/colors` | រក្សា palette ពណ៌ (`id`, `name`, `cols`) |

កូដ API នៅ `artifacts/api-server/src/routes/` ។ Palette ទុកក្នុង `~/.ki-colors.json` (មិនឡើង GitHub)។

## ទំព័រ Color and Light

ក្នុង UI ៖ ម៉ឺនុយ → **🎨 Color and Light · ពណ៌ និងអំពូលភ្លើង** (ទំព័រតែមួយ)។

- Color wheel, Harmony, HSB sliders, កាតពណ៌ HEX
- អំពូលបង្ហាញពន្លឺតាមពណ៌ដែលជ្រើស (មើលជាមុន)
- **Save → KI** រក្សា palette ទៅ KI · **Load from KI** ទាញមកវិញ
- បណ្ណាល័យពណ៌/អំពូលពី **khoem-now** (`data/`) ចុចពណ៌ដើម្បីបន្ថែមចូល palette
- កូដ៖ `AI/src/components/ColorLightCenter.tsx`

## របៀបបើក

```
ai            # បើកទាំងអស់ (IQ-AI, KI, KHOEM_AI, AI backend, KSV, UI)
ai stop       # បិទទាំងអស់
ai restart    # បើកឡើងវិញ
```

ពិនិត្យថារស់ (200 ឬ 404 = រស់, 000 = មិនរត់)៖

```
curl -s localhost:8790/health
curl -s localhost:8787/api/health
curl -s localhost:5001/api/healthz
curl -s localhost:5001/api/colors
```

ពាក្យ `ai` ដំណើរការ `~/KSV/ai.sh`។

## ច្បាប់ថែទាំ

1. បម្រុងទុកឯកសារមុនកែ (`cp file file.bak-...`) មិនលុបអ្វីដែលកំពុងដំណើរការ។
2. កុំដាក់ key ឬលេខសម្ងាត់ក្នុង GitHub ឬក្នុងទំព័រ UI (key នៅ `.env` ក្នុង server)។
3. Push តាមឈ្មោះឯកសារ (`git add <file>`) មិនប្រើ `git add .` ក្នុងថត Home។
4. ទំព័រថ្មីទាញទិន្នន័យពី KI មិនបង្កើតកន្លែងទុកទិន្នន័យដាច់ដោយឡែកទេ។

_ធ្វើបច្ចុប្បន្នភាព៖ 2026-10-28_
