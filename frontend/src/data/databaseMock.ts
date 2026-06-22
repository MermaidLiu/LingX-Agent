export type ImagingRecord = {
  id: string;
  patientId: string;
  patientName: string;
  modality: string;
  examItem: string;
  examDate: string;
  bodyPart: string;
  suvMax: number | null;
  mtv: number | null;
  tlg: number | null;
  lesionCount: number;
  dicomCount: number;
  hasPet: boolean;
  reportSummary: string;
  status: "已归档" | "待审核" | "解析中";
};

export type PathologyRecord = {
  id: string;
  patientId: string;
  patientName: string;
  sampleSite: string;
  stainType: string;
  gradeLabel: string;
  whoGrade: string;
  ki67: string;
  p53: string;
  pmpSubtype: string;
  slideCount: number;
  reportDate: string;
  pathologist: string;
  summary: string;
  status: "已签发" | "待复核" | "制片中";
};

export type GeneticsRecord = {
  id: string;
  patientId: string;
  patientName: string;
  panel: string;
  sampleType: string;
  reportDate: string;
  egfr: string;
  kras: string;
  braf: string;
  msi: string;
  pdl1: string;
  brca: string;
  actionable: string[];
  tier: string;
  status: "已出报告" | "测序中" | "待送检";
};

export const MOCK_IMAGING_DB: ImagingRecord[] = [
  {
    id: "IMG-20240515-001",
    patientId: "PMP00012345",
    patientName: "王建国",
    modality: "PET-CT",
    examItem: "18F-FDG PET/CT 全身显像",
    examDate: "2024-05-15",
    bodyPart: "胸部+腹盆",
    suvMax: 8.6,
    mtv: 42.5,
    tlg: 186.3,
    lesionCount: 3,
    dicomCount: 1280,
    hasPet: true,
    reportSummary: "右肺上叶占位代谢增高，纵隔淋巴结肿大，SUVmax 8.6",
    status: "已归档",
  },
  {
    id: "IMG-20240518-002",
    patientId: "PMP00012345",
    patientName: "王建国",
    modality: "CT",
    examItem: "胸部 CT 平扫+增强",
    examDate: "2024-05-18",
    bodyPart: "胸部",
    suvMax: null,
    mtv: null,
    tlg: null,
    lesionCount: 1,
    dicomCount: 520,
    hasPet: false,
    reportSummary: "右肺上叶 3.2cm 软组织结节，纵隔淋巴结短径约 1.2cm",
    status: "已归档",
  },
  {
    id: "IMG-20240516-003",
    patientId: "PMP00012346",
    patientName: "李秀英",
    modality: "PET-CT",
    examItem: "18F-FDG PET/CT 腹盆",
    examDate: "2024-05-16",
    bodyPart: "腹盆",
    suvMax: 3.2,
    mtv: 120.0,
    tlg: 380.0,
    lesionCount: 5,
    dicomCount: 960,
    hasPet: true,
    reportSummary: "腹腔广泛粘液性种植，代谢中等，符合 PMP 表现",
    status: "已归档",
  },
  {
    id: "IMG-20240514-004",
    patientId: "PMP00012346",
    patientName: "李秀英",
    modality: "MRI",
    examItem: "上腹 MRI 增强",
    examDate: "2024-05-14",
    bodyPart: "上腹",
    suvMax: null,
    mtv: null,
    tlg: null,
    lesionCount: 2,
    dicomCount: 380,
    hasPet: false,
    reportSummary: "网膜饼状增厚，腹腔积液",
    status: "已归档",
  },
  {
    id: "IMG-20240512-005",
    patientId: "PMP00012347",
    patientName: "陈志远",
    modality: "CT",
    examItem: "全腹 CT 增强",
    examDate: "2024-05-12",
    bodyPart: "全腹",
    suvMax: null,
    mtv: null,
    tlg: null,
    lesionCount: 2,
    dicomCount: 640,
    hasPet: false,
    reportSummary: "升结肠壁增厚伴周围淋巴结肿大",
    status: "待审核",
  },
  {
    id: "IMG-20240513-006",
    patientId: "PMP00012347",
    patientName: "陈志远",
    modality: "超声",
    examItem: "腹部超声",
    examDate: "2024-05-13",
    bodyPart: "腹部",
    suvMax: null,
    mtv: null,
    tlg: null,
    lesionCount: 0,
    dicomCount: 24,
    hasPet: false,
    reportSummary: "右下腹低回声区，建议进一步 CT",
    status: "已归档",
  },
];

export const MOCK_PATHOLOGY_DB: PathologyRecord[] = [
  {
    id: "PATH-20240518-001",
    patientId: "PMP00012345",
    patientName: "王建国",
    sampleSite: "右肺上叶",
    stainType: "HE + IHC",
    gradeLabel: "高级别",
    whoGrade: "G2",
    ki67: "30%",
    p53: "突变型",
    pmpSubtype: "—",
    slideCount: 12,
    reportDate: "2024-05-18",
    pathologist: "李病理",
    summary: "浸润性腺癌，中分化，脉管侵犯(+)",
    status: "已签发",
  },
  {
    id: "PATH-20240518-002",
    patientId: "PMP00012345",
    patientName: "王建国",
    sampleSite: "纵隔淋巴结",
    stainType: "HE",
    gradeLabel: "高级别",
    whoGrade: "G2",
    ki67: "35%",
    p53: "突变型",
    pmpSubtype: "—",
    slideCount: 6,
    reportDate: "2024-05-18",
    pathologist: "李病理",
    summary: "转移性腺癌",
    status: "已签发",
  },
  {
    id: "PATH-20240517-003",
    patientId: "PMP00012346",
    patientName: "李秀英",
    sampleSite: "腹膜种植",
    stainType: "HE + 粘液染色",
    gradeLabel: "低级别",
    whoGrade: "G1",
    ki67: "5%",
    p53: "野生型",
    pmpSubtype: "DPAM",
    slideCount: 18,
    reportDate: "2024-05-17",
    pathologist: "王病理",
    summary: "扩散性腹膜腺瘤病（DPAM），以粘液分泌为主，浸润成分少",
    status: "已签发",
  },
  {
    id: "PATH-20240516-004",
    patientId: "PMP00012346",
    patientName: "李秀英",
    sampleSite: "阑尾",
    stainType: "HE",
    gradeLabel: "低级别",
    whoGrade: "G1",
    ki67: "8%",
    p53: "野生型",
    pmpSubtype: "LAMN",
    slideCount: 8,
    reportDate: "2024-05-16",
    pathologist: "王病理",
    summary: "低级别阑尾粘液性肿瘤（LAMN）",
    status: "已签发",
  },
  {
    id: "PATH-20240514-005",
    patientId: "PMP00012347",
    patientName: "陈志远",
    sampleSite: "升结肠",
    stainType: "HE + IHC",
    gradeLabel: "高级别",
    whoGrade: "G3",
    ki67: "45%",
    p53: "突变型",
    pmpSubtype: "—",
    slideCount: 10,
    reportDate: "2024-05-14",
    pathologist: "赵病理",
    summary: "粘液腺癌，中-低分化",
    status: "待复核",
  },
  {
    id: "PATH-20240514-006",
    patientId: "PMP00012347",
    patientName: "陈志远",
    sampleSite: "区域淋巴结",
    stainType: "HE",
    gradeLabel: "高级别",
    whoGrade: "G3",
    ki67: "40%",
    p53: "—",
    pmpSubtype: "—",
    slideCount: 4,
    reportDate: "2024-05-14",
    pathologist: "赵病理",
    summary: "见粘液癌转移",
    status: "制片中",
  },
];

export const MOCK_GENETICS_DB: GeneticsRecord[] = [
  {
    id: "GEN-20240519-001",
    patientId: "PMP00012345",
    patientName: "王建国",
    panel: "肺癌 8 基因 panel",
    sampleType: "组织 FFPE",
    reportDate: "2024-05-19",
    egfr: "19del 阳性",
    kras: "野生型",
    braf: "野生型",
    msi: "MSS",
    pdl1: "TPS 30%",
    brca: "未检出",
    actionable: ["EGFR-TKI", "免疫治疗评估"],
    tier: "I 类",
    status: "已出报告",
  },
  {
    id: "GEN-20240519-002",
    patientId: "PMP00012345",
    patientName: "王建国",
    panel: "NGS 568 基因",
    sampleType: "血浆 ctDNA",
    reportDate: "2024-05-19",
    egfr: "19del 阳性",
    kras: "野生型",
    braf: "野生型",
    msi: "MSS",
    pdl1: "—",
    brca: "未检出",
    actionable: ["奥希替尼", "耐药监测"],
    tier: "I 类",
    status: "已出报告",
  },
  {
    id: "GEN-20240518-003",
    patientId: "PMP00012346",
    patientName: "李秀英",
    panel: "PMP/阑尾肿瘤 panel",
    sampleType: "组织 FFPE",
    reportDate: "2024-05-18",
    egfr: "野生型",
    kras: "G12D 突变",
    braf: "野生型",
    msi: "MSS",
    pdl1: "TPS 5%",
    brca: "未检出",
    actionable: ["KRAS 抑制剂评估", "CRS+HIPEC 路径"],
    tier: "II 类",
    status: "已出报告",
  },
  {
    id: "GEN-20240517-004",
    patientId: "PMP00012347",
    patientName: "陈志远",
    panel: "结直肠癌 12 基因",
    sampleType: "组织 FFPE",
    reportDate: "2024-05-17",
    egfr: "野生型",
    kras: "G12V 突变",
    braf: "野生型",
    msi: "MSS",
    pdl1: "CPS 8",
    brca: "未检出",
    actionable: ["抗 EGFR 不适用", "化疗为主"],
    tier: "I 类",
    status: "已出报告",
  },
  {
    id: "GEN-20240516-005",
    patientId: "PMP00012347",
    patientName: "陈志远",
    panel: "MSI/PD-L1",
    sampleType: "组织",
    reportDate: "2024-05-16",
    egfr: "—",
    kras: "—",
    braf: "—",
    msi: "MSS",
    pdl1: "CPS 8",
    brca: "—",
    actionable: ["免疫治疗备选"],
    tier: "II 类",
    status: "测序中",
  },
];
