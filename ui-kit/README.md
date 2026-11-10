# ui-kit · ភ្ជាប់ IQ-AI ទៅ UI (repo `AI`)

ឯកសារ ២ ក្នុងថតនេះ ចម្លងទៅ repo `AI`៖

| ពី (IQ-AI) | ទៅ (AI) |
|---|---|
| `ui-kit/iqaiClient.ts` | `AI/src/lib/iqaiClient.ts` |
| `ui-kit/IqAiStudio.tsx` | `AI/src/components/IqAiStudio.tsx` |

```bash
cp ~/IQ-AI/ui-kit/iqaiClient.ts  ~/ai-project/AI/src/lib/
cp ~/IQ-AI/ui-kit/IqAiStudio.tsx ~/ai-project/AI/src/components/
```

## ជំហានភ្ជាប់ (ក្នុង repo AI)

1. **Proxy** — `vite.config.ts` ត្រូវមាន `/iqai` ស្រាប់ហើយ (បន្ថែម token ឱ្យ)។ ពិនិត្យ៖
   `'/iqai': { target: 'http://127.0.0.1:8799', changeOrigin: true, rewrite: p => p.replace(/^\/iqai/, '/api/v1'), headers: { Authorization: `Bearer ${process.env.IQAI_TOKEN}` } }`
2. **ម៉ឺនុយ** — នាំចូលហើយបន្ថែមទំព័រ៖ `import IqAiStudio from './components/IqAiStudio'` រួច render `<IqAiStudio />` ក្នុងម៉ឺនុយ។
3. **បើកសេវា** — `./ai.sh start` ក្នុង `~/IQ-AI` (token ក្នុង `.env` ត្រូវដូច `~/.iqai-token`)។

## អ្វីដែលបានភ្ជាប់

- `GET /capabilities` → UI ដឹងថា ffmpeg / ពុម្ពអក្សរខ្មែរ មាន ឬអត់ ហើយបង្ហាញសារ "ត្រូវការអ្វី" ជំនួស error ស្រពិចស្រពិល
- ✂️ កែវីដេអូ (trim/speed/mute) · thumbnail · ដកសំឡេង → `/videos/edit|thumbnail|audio`
- 🖼️ រូប→វីដេអូ · 🔤 អត្ថបទ→វីដេអូ · 🎙️ ប្តូរសំឡេង · 🧠 អារម្មណ៍
- client មាន function រួចជាស្រេចសម្រាប់ inspect, sfx, sound library (list/patch/upload) ដែលមិនទាន់មានផ្ទាំង

## ចំណាំ

- `AvStudio.tsx` ដែលនិយាយថា "not connected" ត្រូវជំនួសដោយ `<IqAiStudio />` ឬហៅ `iqai.videoEdit(...)` ដោយផ្ទាល់។
- ផ្ទាំងនេះប្រើ inline style ដើម្បីដំណើរការដោយមិនពឹងលើ CSS របស់ AI; ប្តូរទៅ class របស់អ្នកបានតាមចិត្ត។
- ខ្ញុំ (Claude) មិនមាន repo `AI` ទេ ដូច្នេះ TSX នេះ **មិនទាន់ត្រូវបានតេស្តក្នុង Vite ពិត**។ `iqaiClient.ts` ឆ្លងកាត់ `tsc --strict`; ផ្ទាំង TSX ពិនិត្យតែប្រភេទ (type) ជាមួយ shim ។
