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
- ❌ emotion ពីសំឡេង/រូបភាព មិនទាន់មាន

## ជំហានបន្ទាប់
1. ភ្ជាប់ emotion ទៅ `src/api/client.ts` ក្នុង KHOEM-AI
2. ព័ត៌មានឯកសារសំឡេង (ប្រើ `inspectWav` ពី `voiceEngine.mjs` របស់ KHOEM-AI)
3. ព័ត៌មានរូបភាព និងវីដេអូ
