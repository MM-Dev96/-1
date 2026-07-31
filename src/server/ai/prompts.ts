import type {
  JobKind,
  StageRuntime,
  WorkflowProfile,
} from '../../shared/contracts.ts';
import { PROFILE_META } from '../../shared/defaultWorkflow.ts';

const SYSTEM_INSTRUCTION = `أنت عضو تقني دقيق في فريق بناء منتجات رقمية.
اكتب بالعربية الواضحة، واحتفظ بأسماء التقنيات والواجهات بالإنجليزية عند الحاجة.
لا تدّعِ تنفيذ شيء لم تنفذه، ولا تخترع بيانات أو نتائج بحث.
اجعل المخرج عمليًا وقابلًا للاستخدام من المرحلة التالية.
لا تناقش النشر أو مراجعة الأمان في هذه المهمة لأنها أداة شخصية، إلا إذا كان ذلك ضروريًا لمنع كسر وظيفي مباشر.`;

function compactText(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const head = Math.ceil(limit * 0.72);
  const tail = limit - head;
  return `${text.slice(0, head)}\n\n… [اختُصر السياق] …\n\n${text.slice(-tail)}`;
}

export function dependencyContext(
  dependencies: StageRuntime[],
  profile: WorkflowProfile,
): { text: string; characterCount: number } {
  if (dependencies.length === 0) return { text: 'لا توجد مخرجات سابقة.', characterCount: 0 };
  const budget = PROFILE_META[profile].contextBudget;
  const perArtifact = Math.max(1_200, Math.floor(budget / dependencies.length));
  const sections = dependencies.map(
    (stage) =>
      `## ${stage.label} — ${stage.artifact}\n${compactText(stage.output, perArtifact)}`,
  );
  const text = compactText(sections.join('\n\n'), budget);
  return { text, characterCount: text.length };
}

export function stagePrompt(
  idea: string,
  stage: StageRuntime,
  dependencies: StageRuntime[],
  profile: WorkflowProfile,
): { prompt: string; systemInstruction: string; contextCharacters: number } {
  const context = dependencyContext(dependencies, profile);
  const finalRules =
    stage.kind === 'final'
      ? `أنتج برومبتًا نهائيًا واحدًا فقط، جاهزًا للنسخ إلى وكيل برمجي.
ادمج القرارات المتوافقة، احذف التكرار، وحل أي تعارض بقرار صريح.
ضع: الهدف، النطاق، تجربة الاستخدام، المتطلبات الوظيفية، البنية، معايير القبول، وخطوات التحقق.
لا تضع مقدمة موجهة للمستخدم ولا تحاصر النص بعلامات code fence.`
      : `أنشئ محتوى الملف ${stage.artifact}.
رتّب الأولويات، اذكر الافتراضات بوضوح، وأضف معايير قبول قابلة للاختبار.`;

  return {
    systemInstruction: SYSTEM_INSTRUCTION,
    contextCharacters: context.characterCount,
    prompt: `# فكرة المشروع
${idea}

# مهمتك
الدور: ${stage.label}
الوصف: ${stage.description}
نوع المرحلة: ${stage.kind}
مستوى التحليل: ${profile}

# السياق المعتمد من المراحل السابقة
${context.text}

# صيغة المخرج
${finalRules}`,
  };
}

export function standalonePrompt(
  kind: Exclude<JobKind, 'orchestration'>,
  source: string,
  instruction?: string,
): { prompt: string; systemInstruction: string } {
  const task: Record<Exclude<JobKind, 'orchestration'>, string> = {
    evaluation: `قيّم المحتوى التالي تقنيًا ووظيفيًا. ابدأ بالحكم، ثم نقاط القوة الفعلية، ثم المشكلات مرتبة حسب الأثر، ثم خطة إصلاح ومعايير قبول. لا تذكر الأمان أو النشر.`,
    'self-audit': `نفّذ تدقيقًا ذاتيًا صارمًا على المحتوى التالي. اكتشف التناقضات، الميزات الوهمية، الأزرار غير العاملة، أخطاء تدفق البيانات، مشاكل الجوال والوصول والأداء، ثم اقترح إصلاحات دقيقة. لا تستخدم Mermaid.`,
    mockup: `حوّل الوصف التالي إلى نموذج HTML ثابت واحد يعمل داخل iframe. أعد مستند HTML كاملًا فقط دون Markdown أو code fences. استخدم CSS وJavaScript داخليين، واجهة عربية RTL متجاوبة، حالات فارغة وأخطاء، وتفاعلات حقيقية بسيطة. لا تستخدم React أو Vite أو أي عملية build أو ملفات خارجية.`,
    'idea-improver': `حسّن الفكرة التالية دون تغيير غرضها. أعد نسخة واحدة أوضح وأغنى بالوظائف الذكية المناسبة فقط، مع تجنب تضخيم النطاق. أعد نص الفكرة المحسّن مباشرة دون مقدمة.`,
  };
  return {
    systemInstruction: SYSTEM_INSTRUCTION,
    prompt: `${task[kind]}

${instruction ? `تعليمات إضافية:\n${instruction}\n` : ''}

# المحتوى
${source}`,
  };
}

export function cleanStandaloneOutput(kind: JobKind, output: string): string {
  const trimmed = output.trim();
  if (kind !== 'mockup') return trimmed;
  const fenced = trimmed.match(/```(?:html)?\s*([\s\S]*?)```/i);
  return (fenced?.[1] ?? trimmed).trim();
}

export function validateModelOutput(kind: JobKind, output: string): void {
  if (!output.trim()) throw new Error('عاد النموذج بمخرج فارغ.');
  if (kind === 'mockup' && !/<html[\s>]|<!doctype html/i.test(output)) {
    throw new Error('مخرج النموذج لا يحتوي مستند HTML صالحًا للمعاينة.');
  }
}
