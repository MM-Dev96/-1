export interface WorkflowNode {
  id: string;
  label: string;
  desc: string;
  artifact: string;
  status: 'PENDING' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELED';
  result?: string;
  error?: string;
  maxRetries?: number;
  retryCount?: number;
  model?: string;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
}

export const defaultWorkflowNodes: WorkflowNode[] = [
  { id: 'n1', label: 'Product Manager', desc: 'تحليل المتطلبات وتحديد MVP', artifact: 'PRD.md', status: 'PENDING' },
  { id: 'n2', label: 'Business Analyst', desc: 'تحليل السوق والمنافسين', artifact: 'Market.md', status: 'PENDING' },
  { id: 'n3', label: 'UX Researcher', desc: 'رسم رحلة المستخدم', artifact: 'UserFlow.md', status: 'PENDING' },
  { id: 'n4', label: 'Product Designer', desc: 'تصميم واجهة المستخدم', artifact: 'Wireframes.fig', status: 'PENDING' },
  { id: 'n5', label: 'Design System Eng', desc: 'بناء النظام البصري', artifact: 'Tokens.json', status: 'PENDING' },
  { id: 'n6', label: 'System Architect', desc: 'هيكلة النظام الشاملة', artifact: 'Architecture.md', status: 'PENDING' },
  { id: 'n7', label: 'Database Architect', desc: 'تصميم قواعد البيانات', artifact: 'Schema.sql', status: 'PENDING' },
  { id: 'n8', label: 'API Architect', desc: 'تصميم الواجهات البرمجية', artifact: 'OpenAPI.yaml', status: 'PENDING' },
  { id: 'n9', label: 'Security Engineer', desc: 'نموذج الحماية والأمان', artifact: 'Security.md', status: 'PENDING' },
  { id: 'n10', label: 'UX Validation', desc: 'اعتماد تجربة المستخدم', artifact: 'UX_Audit.md', status: 'PENDING' },
  { id: 'n11', label: 'AI Architect', desc: 'تكامل الذكاء الاصطناعي', artifact: 'AI_Config.json', status: 'PENDING' },
  { id: 'n12', label: 'Frontend Lead', desc: 'واجهات المستخدم', artifact: 'Frontend.md', status: 'PENDING' },
  { id: 'n13', label: 'Backend Lead', desc: 'الخوادم والمنطق', artifact: 'Backend.md', status: 'PENDING' },
  { id: 'n14', label: 'Testing Architect', desc: 'ضمان الجودة والاختبار', artifact: 'Tests.md', status: 'PENDING' },
  { id: 'n15', label: 'DevOps Engineer', desc: 'الاستضافة والحاويات', artifact: 'Dockerfile', status: 'PENDING' },
  { id: 'n16', label: 'Technical Writer', desc: 'كتابة التوثيق', artifact: 'Docs.md', status: 'PENDING' },
  { id: 'n17', label: 'Legal & Privacy', desc: 'الامتثال للخصوصية', artifact: 'Privacy.md', status: 'PENDING' },
  { id: 'n18', label: 'Release Manager', desc: 'خطة الإطلاق', artifact: 'Release.yml', status: 'PENDING' },
  { id: 'n19', label: 'Principal Engineer', desc: 'التدقيق النهائي', artifact: 'FinalAudit.md', status: 'PENDING' },
  { id: 'n20', label: 'AI Orchestrator', desc: 'تجميع البرومبت', artifact: 'Pipeline.yml', status: 'PENDING' }
];

export const defaultWorkflowEdges: WorkflowEdge[] = [
  { id: 'e1-2', source: 'n1', target: 'n2' },
  { id: 'e1-3', source: 'n1', target: 'n3' },
  { id: 'e3-4', source: 'n3', target: 'n4' },
  { id: 'e4-5', source: 'n4', target: 'n5' },
  { id: 'e1-6', source: 'n1', target: 'n6' },
  { id: 'e6-7', source: 'n6', target: 'n7' },
  { id: 'e6-8', source: 'n6', target: 'n8' },
  { id: 'e6-9', source: 'n6', target: 'n9' },
  { id: 'e4-10', source: 'n4', target: 'n10' },
  { id: 'e6-11', source: 'n6', target: 'n11' },
  { id: 'e5-12', source: 'n5', target: 'n12' },
  { id: 'e8-12', source: 'n8', target: 'n12' },
  { id: 'e7-13', source: 'n7', target: 'n13' },
  { id: 'e8-13', source: 'n8', target: 'n13' },
  { id: 'e12-14', source: 'n12', target: 'n14' },
  { id: 'e13-14', source: 'n13', target: 'n14' },
  { id: 'e12-15', source: 'n12', target: 'n15' },
  { id: 'e13-15', source: 'n13', target: 'n15' },
  { id: 'e1-16', source: 'n1', target: 'n16' },
  { id: 'e1-17', source: 'n1', target: 'n17' },
  { id: 'e14-18', source: 'n14', target: 'n18' },
  { id: 'e15-18', source: 'n15', target: 'n18' },
  { id: 'e18-19', source: 'n18', target: 'n19' },
  { id: 'e19-20', source: 'n19', target: 'n20' }
];
