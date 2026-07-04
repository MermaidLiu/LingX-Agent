import * as XLSX from "xlsx";

/** 生成对标深睿的 Excel 导入模板并触发下载 */
export function downloadClinicalExcelTemplate() {
  const typeRow = [
    "患者ID",
    "患者信息",
    "",
    "",
    "影像文件",
    "",
    "病理文件",
    "",
    "波形文件",
    "",
  ];
  const varRow = [
    "",
    "年龄",
    "性别",
    "RBC",
    "术后CT检查{文件名}",
    "随访CT检查2{检查号}",
    "术前病理{文件名}",
    "术后病理{文件名}",
    "心电数据{患者ID}",
    "脑电数据{患者ID}",
  ];
  const sampleRows = [
    ["A123456", "20", "男", "5.5", "keyan/dataset_detail_id3", "1082120", "path_pre_001", "path_post_001", "A123456", "A123456"],
    ["A123457", "21", "女", "3.5", "1082121", "1012103", "path_pre_002", "path_post_002", "A123457", "A123457"],
    ["A123458", "22", "男", "5.4", "1082122", "1012104", "path_pre_003", "path_post_003", "A123458", "A123458"],
    ["A123459", "23", "女", "5.3", "1082123", "1012105", "path_pre_004", "path_post_004", "A123459", "A123459"],
    ["A123460", "24", "男", "5.2", "1082124", "1012106", "path_pre_005", "path_post_005", "A123460", "A123460"],
  ];

  const ws = XLSX.utils.aoa_to_sheet([typeRow, varRow, ...sampleRows]);
  ws["!merges"] = [
    { s: { r: 0, c: 1 }, e: { r: 0, c: 3 } },
    { s: { r: 0, c: 4 }, e: { r: 0, c: 5 } },
    { s: { r: 0, c: 6 }, e: { r: 0, c: 7 } },
    { s: { r: 0, c: 8 }, e: { r: 0, c: 9 } },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "临床数据");

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "临床数据导入模板.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}
