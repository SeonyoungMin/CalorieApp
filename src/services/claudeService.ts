import Anthropic from '@anthropic-ai/sdk';

// API 키는 환경변수 또는 직접 입력
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'your-api-key-here';

const client = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
});

export interface FoodCalorieResult {
  foods: { name: string; kcal: number; amount: string }[];
  totalKcal: number;
  summary: string;
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

const askClaude = async (prompt: string, maxTokens = 1500): Promise<string> => {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });
  return (response.content[0] as any).text;
};

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
