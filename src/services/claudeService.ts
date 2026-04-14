import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY } from '@env';

const client = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
});

export interface FoodCalorieResult {
  foods: { name: string; kcal: number; amount: string; confidence?: number }[];
  totalKcal: number;
  summary: string;
}

export interface BarcodeResult {
  productName: string;
  brand: string;
  calories: number;
  servingSize: string;
  nutrients: { carb: number; protein: number; fat: number; sodium: number };
  summary: string;
}

export async function scanBarcode(base64Image: string, mimeType = 'image/jpeg'): Promise<BarcodeResult> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType as any, data: base64Image } },
        { type: 'text', text: `이 제품 이미지(바코드 포함)를 분석해서 제품 정보와 영양성분을 알려주세요.
바코드 번호나 제품 포장의 텍스트를 최대한 활용해 정확하게 분석해주세요.
반드시 다음 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "productName": "제품명",
  "brand": "브랜드명",
  "calories": 칼로리숫자,
  "servingSize": "1회 제공량(예: 100g, 1개)",
  "nutrients": {"carb": 탄수화물g, "protein": 단백질g, "fat": 지방g, "sodium": 나트륨mg},
  "summary": "한줄요약"
}` },
      ],
    }],
  });
  const text = (response.content[0] as any).text;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('AI 응답 파싱 실패');
  return JSON.parse(match[0]);
}

export interface NutritionLabelResult {
  productName: string;
  servingSize: string;
  calories: number;
  nutrients: { carb: number; sugar: number; protein: number; fat: number; saturatedFat: number; sodium: number };
  summary: string;
}

export async function scanNutritionLabel(base64Image: string, mimeType = 'image/jpeg'): Promise<NutritionLabelResult> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType as any, data: base64Image } },
        { type: 'text', text: `이 영양성분표를 정확하게 파싱해주세요.
반드시 다음 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "productName": "제품명(알 수 없으면 '제품')",
  "servingSize": "1회 제공량",
  "calories": 칼로리숫자,
  "nutrients": {
    "carb": 탄수화물g,
    "sugar": 당류g,
    "protein": 단백질g,
    "fat": 지방g,
    "saturatedFat": 포화지방g,
    "sodium": 나트륨mg
  },
  "summary": "한줄요약"
}` },
      ],
    }],
  });
  const text = (response.content[0] as any).text;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('AI 응답 파싱 실패');
  return JSON.parse(match[0]);
}

export async function scanReceipt(base64Image: string, mimeType = 'image/jpeg'): Promise<FoodCalorieResult> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType as any, data: base64Image } },
        { type: 'text', text: `이 영수증에서 음식/식음료 항목을 찾아 칼로리를 추정해주세요.
음식이 아닌 항목(생필품 등)은 제외하고 먹을 수 있는 음식과 음료만 포함해주세요.
반드시 다음 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "foods": [
    {"name": "음식명", "kcal": 칼로리숫자, "amount": "수량"}
  ],
  "totalKcal": 총칼로리숫자,
  "summary": "한줄요약"
}` },
      ],
    }],
  });
  const text = (response.content[0] as any).text;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('AI 응답 파싱 실패');
  return JSON.parse(match[0]);
}

export async function extractBarcodeNumber(base64Image: string, mimeType = 'image/jpeg'): Promise<string | null> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 64,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType as any, data: base64Image } },
        { type: 'text', text: '이 이미지에서 바코드 번호(숫자)만 추출해주세요. 숫자만 출력하고 다른 텍스트는 쓰지 마세요. 바코드가 없으면 null이라고만 답하세요.' },
      ],
    }],
  });
  const text = ((response.content[0] as any).text || '').trim();
  if (!text || text.toLowerCase() === 'null') return null;
  const match = text.match(/\d{8,14}/);
  return match ? match[0] : null;
}

export async function lookupBarcodeByNumber(barcode: string): Promise<BarcodeResult> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `바코드 번호 ${barcode} 에 해당하는 식품 정보와 영양성분을 알려주세요. 한국 식품이면 한국 제품명으로 알려주세요.
반드시 다음 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "productName": "제품명",
  "brand": "브랜드명",
  "calories": 칼로리숫자,
  "servingSize": "1회 제공량",
  "nutrients": {"carb": 탄수화물g, "protein": 단백질g, "fat": 지방g, "sodium": 나트륨mg},
  "summary": "한줄요약"
}`,
    }],
  });
  const text = (response.content[0] as any).text;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('AI 응답 파싱 실패');
  return JSON.parse(match[0]);
}

export async function scanFoodImage(base64Image: string, mimeType: string = 'image/jpeg'): Promise<FoodCalorieResult> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType as any,
              data: base64Image,
            },
          },
          {
            type: 'text',
            text: `이 음식 사진을 분석해서 칼로리를 계산해주세요.
주의사항:
- 음식이 포장지/비닐/랩에 싸여 있다면 포장재가 아닌 포장 속 실제 음식 기준으로 계산하세요
- 포장지/비닐/랩/용기 자체를 음식으로 인식하지 마세요
- 인식이 불확실한 음식은 confidence 값을 낮게(0.5 미만) 설정하세요
반드시 다음 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "foods": [
    {"name": "음식명", "kcal": 숫자, "amount": "양(예: 1인분, 200g)", "confidence": 0.9}
  ],
  "totalKcal": 총칼로리숫자,
  "summary": "한줄요약"
}`,
          },
        ],
      },
    ],
  });

  const text = (response.content[0] as any).text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI 응답 파싱 실패');
  return JSON.parse(jsonMatch[0]);
}

export async function calculateCaloriesFromText(foodText: string): Promise<FoodCalorieResult> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `다음 음식의 칼로리를 계산해주세요: "${foodText}"
반드시 다음 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "foods": [
    {"name": "음식명", "kcal": 숫자, "amount": "양(예: 1인분, 200g)"}
  ],
  "totalKcal": 총칼로리숫자,
  "summary": "한줄요약"
}`,
      },
    ],
  });

  const text = (response.content[0] as any).text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI 응답 파싱 실패');
  return JSON.parse(jsonMatch[0]);
}

export const askClaude = async (prompt: string, maxTokens = 1500): Promise<string> => {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });
  return (response.content[0] as any).text;
};

// ─── 건강 리포트 내보내기 ─────────────────────────────────────────────────────

export async function generateHealthReport(data: {
  nickname: string;
  weeklyStats: any;
  recentMeals: any[];
  recentWorkouts: any[];
  weightList: any[];
  goalKcal: number;
}): Promise<string> {
  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

  const mealDesc = data.recentMeals.slice(0, 5).map((m: any) =>
    `${m.mealType || '식사'} ${m.totalKcal}kcal`).join(', ') || '기록 없음';
  const workoutDesc = data.recentWorkouts.slice(0, 5).map((w: any) =>
    `${w.exerciseName} ${w.kcalBurned}kcal`).join(', ') || '기록 없음';
  const weightDesc = data.weightList.slice(0, 3).map((w: any) =>
    `${w.logDate || ''} ${w.weightKg}kg`).join(', ') || '기록 없음';

  const prompt = `다음 건강 데이터를 바탕으로 메모장이나 카카오톡에 공유하기 좋은 건강 리포트를 작성해주세요.

사용자: ${data.nickname}
날짜: ${today}
목표 칼로리: ${data.goalKcal}kcal
최근 식사: ${mealDesc}
최근 운동: ${workoutDesc}
체중 기록: ${weightDesc}

아래 형식으로 이모지 포함해서 보기 좋게 작성해주세요. JSON 없이 순수 텍스트만:

📊 CalorieApp 건강 리포트
[날짜] | [사용자명]
────────────────────
[이번 주 한줄 평가]

🍽️ 식단 요약
[식단 분석 2~3줄]

💪 운동 요약
[운동 분석 1~2줄]

⚖️ 체중 변화
[체중 분석 1줄, 데이터 없으면 생략]

💡 AI 맞춤 조언
• [조언1]
• [조언2]
• [조언3]

[응원 메시지]
────────────────────
CalorieApp으로 기록됨`;

  return await askClaude(prompt, 2000);
}

// ─── 프리미엄 AI 기능 ─────────────────────────────────────────────────────────

export interface DietFeedback {
  score: number;
  summary: string;
  good: string[];
  improve: string[];
  warning: string | null;
  nutrients: { carb: number; protein: number; fat: number };
}

export async function analyzeDiet(meals: any[], totalKcal: number, goalKcal: number): Promise<DietFeedback> {
  const mealDesc = meals.length > 0
    ? meals.map((m: any) => `${m.mealType}: ${m.totalKcal}kcal`).join(', ')
    : '오늘 식사 기록 없음';

  const text = await askClaude(`오늘 식사 데이터를 분석해주세요.
식사: ${mealDesc}
총 섭취: ${totalKcal}kcal / 목표: ${goalKcal}kcal

반드시 다음 JSON 형식으로만 응답하세요:
{
  "score": 0~100점,
  "summary": "한줄평가",
  "good": ["잘한점1", "잘한점2"],
  "improve": ["개선점1", "개선점2"],
  "warning": "과식/영양불균형 경고 또는 null",
  "nutrients": {"carb": 탄수화물비율%, "protein": 단백질비율%, "fat": 지방비율%}
}`);
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('파싱 실패');
  return JSON.parse(match[0]);
}

export interface MealPlan {
  breakfast: { menu: string; kcal: number; desc: string };
  lunch: { menu: string; kcal: number; desc: string };
  dinner: { menu: string; kcal: number; desc: string };
  snack: { menu: string; kcal: number; desc: string };
  totalKcal: number;
  tip: string;
}

export async function getMealRecommendation(goalKcal: number, weightKg: number, heightCm: number): Promise<MealPlan> {
  const text = await askClaude(`맞춤 하루 식단을 추천해주세요.
목표 칼로리: ${goalKcal}kcal, 체중: ${weightKg}kg, 키: ${heightCm}cm

반드시 다음 JSON 형식으로만 응답하세요:
{
  "breakfast": {"menu": "메뉴명", "kcal": 숫자, "desc": "간단설명"},
  "lunch": {"menu": "메뉴명", "kcal": 숫자, "desc": "간단설명"},
  "dinner": {"menu": "메뉴명", "kcal": 숫자, "desc": "간단설명"},
  "snack": {"menu": "메뉴명", "kcal": 숫자, "desc": "간단설명"},
  "totalKcal": 합계,
  "tip": "오늘의 식사 팁"
}`);
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('파싱 실패');
  return JSON.parse(match[0]);
}

export interface WorkoutPlan {
  level: string;
  duration: number;
  exercises: { name: string; sets: string; kcal: number; desc: string }[];
  totalKcal: number;
  tip: string;
}

export async function getWorkoutRecommendation(weightKg: number, goalKcal: number, recentWorkouts: any[]): Promise<WorkoutPlan> {
  const workoutDesc = recentWorkouts.length > 0
    ? recentWorkouts.map((w: any) => w.exerciseName).join(', ')
    : '최근 운동 기록 없음';

  const text = await askClaude(`맞춤 운동 루틴을 추천해주세요.
체중: ${weightKg}kg, 목표 칼로리 소모: ${Math.round(goalKcal * 0.2)}kcal
최근 운동: ${workoutDesc}

반드시 다음 JSON 형식으로만 응답하세요:
{
  "level": "초급/중급/고급",
  "duration": 총시간분,
  "exercises": [
    {"name": "운동명", "sets": "3세트 12회", "kcal": 소모칼로리, "desc": "설명"}
  ],
  "totalKcal": 총소모칼로리,
  "tip": "오늘의 운동 팁"
}`);
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('파싱 실패');
  return JSON.parse(match[0]);
}

export interface WeeklyReport {
  avgKcal: number;
  goalAchievement: number;
  bestDay: string;
  worstDay: string;
  analysis: string;
  nextWeekTips: string[];
  trend: string;
}

export async function getWeeklyReport(weeklyData: any[], goalKcal: number): Promise<WeeklyReport> {
  const dataDesc = weeklyData.length > 0
    ? weeklyData.map((d: any) => `${d.date}: 섭취 ${d.foodKcal}kcal 소모 ${d.burnedKcal}kcal`).join('\n')
    : '이번 주 데이터 없음';

  const text = await askClaude(`이번 주 건강 리포트를 작성해주세요.
목표 칼로리: ${goalKcal}kcal/일
데이터:\n${dataDesc}

반드시 다음 JSON 형식으로만 응답하세요:
{
  "avgKcal": 평균섭취칼로리,
  "goalAchievement": 목표달성률%,
  "bestDay": "가장 잘한 날",
  "worstDay": "가장 아쉬운 날",
  "analysis": "이번 주 종합 분석 2~3문장",
  "nextWeekTips": ["다음 주 팁1", "팁2", "팁3"],
  "trend": "개선중/유지중/주의필요"
}`);
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('파싱 실패');
  return JSON.parse(match[0]);
}
