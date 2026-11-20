// DEMO ONLY — не реальный AI-подбор
import {
  ApiError,
  type Match,
  type MatchRequest,
  type FeedbackRequest,
  type ProfileMe,
} from "../types";
export const demoMatches: Match[] = [
  {
    id: "demo-a",
    name: "Демо-профиль А.",
    role: "IT Recruiter",
    score: 96,
    goal: "hire",
    reason:
      "Демонстрационный пример: рекрутер ищет специалиста для продуктовой команды. Общий интерес к технологиям может стать темой для разговора.",
    icebreaker: "Какие навыки сейчас особенно ценятся в вашей команде?",
  },
  {
    id: "demo-b",
    name: "Демо-профиль Б.",
    role: "Product Designer",
    score: 92,
    goal: "exchange_experience",
    reason:
      "Демонстрационный пример: дизайнеру интересно обсудить продуктовый подход и обменяться опытом работы над интерфейсами.",
    icebreaker:
      "Какой продуктовый эксперимент больше всего повлиял на вашу работу?",
  },
  {
    id: "demo-c",
    name: "Демо-профиль В.",
    role: "Startup Founder",
    score: 89,
    goal: "find_cofounder",
    reason:
      "Демонстрационный пример: основатель ищет партнёра для нового проекта. Разговор поможет понять, совпадают ли ваши интересы и подход к работе.",
    icebreaker: "Какую проблему решает ваш проект и кого вы ищете в команду?",
  },
  {
    id: "demo-d",
    name: "Демо-профиль Г.",
    role: "Engineering Lead",
    score: 87,
    goal: "be_mentor",
    reason:
      "Демонстрационный пример: технический руководитель готов делиться опытом построения команд и развития инженерной карьеры.",
    icebreaker: "Какой совет вы дали бы себе в начале карьеры?",
  },
  {
    id: "demo-e",
    name: "Демо-профиль Д.",
    role: "Data Analyst",
    score: 84,
    goal: "find_mentor",
    reason:
      "Демонстрационный пример: аналитик ищет наставника и обсуждение практических задач с данными. Это статические данные, а не результат анализа анкеты.",
    icebreaker: "С какими задачами анализа данных вы сейчас работаете?",
  },
];
let profile: ProfileMe = {};
const feedback = new Map<string, string>();
let feedbackSequence = 0;
const delay = () => new Promise((r) => setTimeout(r, 600));
export const mockApi = {
  async health() {
    return { status: "demo" };
  },
  async match(_request: MatchRequest) {
    await delay();
    return { matches: demoMatches.map((m) => ({ ...m })), __demo: true };
  },
  async feedback(req: FeedbackRequest) {
    await delay();
    feedback.set(req.match_id, req.action);
    return { id: ++feedbackSequence, status: "saved" as const };
  },
  async getProfile() {
    await delay();
    return structuredClone(profile);
  },
  async updateProfile(p: Partial<ProfileMe>) {
    await delay();
    profile = { ...profile, ...p };
    return structuredClone(profile);
  },
  async linkTelegram(): Promise<never> {
    throw new ApiError(501, "not implemented");
  },
};
export function clearMockSession() {
  profile = {};
  feedback.clear();
  feedbackSequence = 0;
}
