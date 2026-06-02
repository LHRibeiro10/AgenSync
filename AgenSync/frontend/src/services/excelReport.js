const XML_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function columnName(index) {
  let name = "";
  let value = index;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function cellRef(column, row) {
  return `${columnName(column)}${row}`;
}

function cellXml(cell, rowIndex, columnIndex) {
  const reference = cellRef(columnIndex, rowIndex);
  const style = cell.style !== undefined ? ` s="${cell.style}"` : "";
  const value = cell.value ?? "";

  if (value === "") return `<c r="${reference}"${style}/>`;
  if (typeof value === "number") return `<c r="${reference}"${style}><v>${value}</v></c>`;

  return `<c r="${reference}" t="inlineStr"${style}><is><t>${escapeXml(value)}</t></is></c>`;
}

function buildSheetXml(rows, merges = []) {
  const widths = [17, 26, 28, 18, 24, 18, 18];
  const cols = widths
    .map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`)
    .join("");
  const sheetRows = rows
    .map((row, rowIndex) => {
      const cells = row.cells.map((cell, columnIndex) => cellXml(cell, rowIndex + 1, columnIndex + 1)).join("");
      const height = row.height ? ` ht="${row.height}" customHeight="1"` : "";
      return `<row r="${rowIndex + 1}"${height}>${cells}</row>`;
    })
    .join("");
  const mergeXml = merges.length
    ? `<mergeCells count="${merges.length}">${merges.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="${XML_NS}" xmlns:r="${REL_NS}">
  <cols>${cols}</cols>
  <sheetData>${sheetRows}</sheetData>
  ${mergeXml}
</worksheet>`;
}

function buildWorkbookXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="${XML_NS}" xmlns:r="${REL_NS}">
  <sheets>
    <sheet name="Relatório financeiro" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;
}

function buildWorkbookRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function buildRootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
}

function buildContentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;
}

function buildStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="${XML_NS}">
  <numFmts count="1">
    <numFmt numFmtId="164" formatCode="&quot;R$&quot; #,##0.00"/>
  </numFmts>
  <fonts count="7">
    <font><sz val="11"/><color rgb="FF111827"/><name val="Inter"/></font>
    <font><b/><sz val="18"/><color rgb="FFFFFFFF"/><name val="Inter"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Inter"/></font>
    <font><b/><sz val="11"/><color rgb="FF111827"/><name val="Inter"/></font>
    <font><b/><sz val="11"/><color rgb="FF16A34A"/><name val="Inter"/></font>
    <font><b/><sz val="11"/><color rgb="FFDC2626"/><name val="Inter"/></font>
    <font><sz val="10"/><color rgb="FF6B7280"/><name val="Inter"/></font>
  </fonts>
  <fills count="6">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF2563EB"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFDBEAFE"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD1FAE5"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFE2E8F0"/></left>
      <right style="thin"><color rgb="FFE2E8F0"/></right>
      <top style="thin"><color rgb="FFE2E8F0"/></top>
      <bottom style="thin"><color rgb="FFE2E8F0"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="14">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center"/></xf>
    <xf numFmtId="0" fontId="6" fillId="0" borderId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="2" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyBorder="1"/>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" applyNumberFormat="1" applyBorder="1"/>
    <xf numFmtId="164" fontId="4" fillId="0" borderId="1" applyNumberFormat="1" applyFont="1" applyBorder="1"/>
    <xf numFmtId="164" fontId="5" fillId="0" borderId="1" applyNumberFormat="1" applyFont="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="3" fillId="3" borderId="1" applyFont="1" applyFill="1" applyBorder="1"/>
    <xf numFmtId="164" fontId="3" fillId="5" borderId="1" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
    <xf numFmtId="164" fontId="4" fillId="5" borderId="1" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
    <xf numFmtId="164" fontId="5" fillId="0" borderId="1" applyNumberFormat="1" applyFont="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="6" fillId="4" borderId="1" applyFont="1" applyFill="1" applyBorder="1"/>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

function makeCrcTable() {
  const table = [];
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

const crcTable = makeCrcTable();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(target, offset, value) {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
}

function writeUint32(target, offset, value) {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
  target[offset + 2] = (value >>> 16) & 0xff;
  target[offset + 3] = (value >>> 24) & 0xff;
}

function dosDateTime(date = new Date()) {
  const time =
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    Math.floor(date.getSeconds() / 2);
  const day =
    ((date.getFullYear() - 1980) << 9) |
    ((date.getMonth() + 1) << 5) |
    date.getDate();
  return { time, day };
}

function concatBytes(parts) {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function createZip(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  const entries = files.map((file) => ({
    nameBytes: encoder.encode(file.name),
    dataBytes: encoder.encode(file.content),
    name: file.name
  }));
  let offset = 0;
  const { time, day } = dosDateTime();

  for (const entry of entries) {
    const crc = crc32(entry.dataBytes);
    const local = new Uint8Array(30 + entry.nameBytes.length);
    writeUint32(local, 0, 0x04034b50);
    writeUint16(local, 4, 20);
    writeUint16(local, 6, 0);
    writeUint16(local, 8, 0);
    writeUint16(local, 10, time);
    writeUint16(local, 12, day);
    writeUint32(local, 14, crc);
    writeUint32(local, 18, entry.dataBytes.length);
    writeUint32(local, 22, entry.dataBytes.length);
    writeUint16(local, 26, entry.nameBytes.length);
    writeUint16(local, 28, 0);
    local.set(entry.nameBytes, 30);
    localParts.push(local, entry.dataBytes);

    const central = new Uint8Array(46 + entry.nameBytes.length);
    writeUint32(central, 0, 0x02014b50);
    writeUint16(central, 4, 20);
    writeUint16(central, 6, 20);
    writeUint16(central, 8, 0);
    writeUint16(central, 10, 0);
    writeUint16(central, 12, time);
    writeUint16(central, 14, day);
    writeUint32(central, 16, crc);
    writeUint32(central, 20, entry.dataBytes.length);
    writeUint32(central, 24, entry.dataBytes.length);
    writeUint16(central, 28, entry.nameBytes.length);
    writeUint16(central, 30, 0);
    writeUint16(central, 32, 0);
    writeUint16(central, 34, 0);
    writeUint16(central, 36, 0);
    writeUint32(central, 38, 0);
    writeUint32(central, 42, offset);
    central.set(entry.nameBytes, 46);
    centralParts.push(central);

    offset += local.length + entry.dataBytes.length;
  }

  const centralDirectory = concatBytes(centralParts);
  const end = new Uint8Array(22);
  writeUint32(end, 0, 0x06054b50);
  writeUint16(end, 4, 0);
  writeUint16(end, 6, 0);
  writeUint16(end, 8, entries.length);
  writeUint16(end, 10, entries.length);
  writeUint32(end, 12, centralDirectory.length);
  writeUint32(end, 16, offset);
  writeUint16(end, 20, 0);

  return concatBytes([...localParts, centralDirectory, end]);
}

function row(cells, height) {
  return { cells, height };
}

function section(title) {
  return row([
    { value: title, style: 3 },
    { value: "", style: 3 },
    { value: "", style: 3 },
    { value: "", style: 3 },
    { value: "", style: 3 },
    { value: "", style: 3 }
  ], 24);
}

function titleRow(title) {
  return row([
    { value: title, style: 1 },
    { value: "", style: 1 },
    { value: "", style: 1 },
    { value: "", style: 1 },
    { value: "", style: 1 },
    { value: "", style: 1 }
  ], 28);
}

function header(values) {
  return row(values.map((value) => ({ value, style: 4 })));
}

function sixCells(cells) {
  return Array.from({ length: 6 }, (_, index) => cells[index] || { value: "", style: 5 });
}

function blank() {
  return row([{ value: "" }]);
}

function sanitizeFilePart(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function exportFinancialReportExcel(report) {
  const rows = [];
  const merges = [];
  const paidSubscriptions = (report.periodSubscriptions || []).filter((cycle) => cycle.status === "paid");

  rows.push(titleRow("AgenSync"));
  merges.push("A1:G1");
  rows.push(row([{ value: `Relatório financeiro · ${report.periodLabel}`, style: 2 }], 22));
  merges.push("A2:G2");

  rows.push(section("ATENDIMENTOS"));
  merges.push(`A${rows.length}:G${rows.length}`);
  rows.push(header(["Data", "Hora", "Cliente", "Serviço", "Valor", "Status"]));
  if (report.completedAppointments.length) {
    report.completedAppointments.forEach((appointment) => {
      rows.push(row(sixCells([
        { value: appointment.date, style: 5 },
        { value: appointment.startTime, style: 5 },
        { value: appointment.client?.name || "", style: 5 },
        { value: appointment.service?.name || "", style: 5 },
        { value: Number(appointment.price || 0), style: 7 },
        { value: appointment.status, style: 5 }
      ])));
    });
  } else {
    rows.push(row([{ value: "Nenhum atendimento concluído no período.", style: 13 }]));
    merges.push(`A${rows.length}:G${rows.length}`);
  }
  rows.push(blank());

  rows.push(section("DESPESAS"));
  merges.push(`A${rows.length}:G${rows.length}`);
  rows.push(header(["Data", "Descrição", "Categoria", "Valor", "Observações", ""]));
  if (report.periodExpenses.length) {
    report.periodExpenses.forEach((expense) => {
      rows.push(row(sixCells([
        { value: expense.date, style: 5 },
        { value: expense.description, style: 5 },
        { value: expense.categoryLabel || expense.category, style: 5 },
        { value: Number(expense.amount || 0), style: 8 },
        { value: expense.notes || "", style: 5 },
        { value: "", style: 5 }
      ])));
    });
  } else {
    rows.push(row([{ value: "Nenhuma despesa no período.", style: 13 }]));
    merges.push(`A${rows.length}:G${rows.length}`);
  }
  rows.push(blank());

  rows.push(section("VENDAS DE PRODUTOS"));
  merges.push(`A${rows.length}:G${rows.length}`);
  rows.push(header(["Data", "Produto", "Quantidade", "Valor total", "Cliente", ""]));
  if (report.periodSales.length) {
    report.periodSales.forEach((sale) => {
      rows.push(row(sixCells([
        { value: sale.date, style: 5 },
        { value: sale.productName, style: 5 },
        { value: Number(sale.quantity || 0), style: 5 },
        { value: Number(sale.total || 0), style: 7 },
        { value: sale.clientName || "Venda avulsa", style: 5 },
        { value: "", style: 5 }
      ])));
    });
  } else {
    rows.push(row([{ value: "Nenhuma venda de produto no período.", style: 13 }]));
    merges.push(`A${rows.length}:G${rows.length}`);
  }

  rows.push(blank());
  rows.push(section("MENSALIDADES PAGAS"));
  merges.push(`A${rows.length}:G${rows.length}`);
  rows.push(header(["Data pagamento", "Cliente", "Plano", "Competencia", "Vencimento", "Valor", "Forma"]));
  if (paidSubscriptions.length) {
    paidSubscriptions.forEach((cycle) => {
      rows.push(row([
        { value: cycle.paidAt || cycle.dueDate || "", style: 5 },
        { value: cycle.clientName || "", style: 5 },
        { value: cycle.planName || "", style: 5 },
        { value: cycle.month || "", style: 5 },
        { value: cycle.dueDate || "", style: 5 },
        { value: Number(cycle.amount || 0), style: 7 },
        { value: cycle.paymentMethod || "", style: 5 }
      ]));
    });
  } else {
    rows.push(row([{ value: "Nenhuma mensalidade paga no periodo.", style: 13 }]));
    merges.push(`A${rows.length}:G${rows.length}`);
  }

  rows.push(blank());
  rows.push(section("RESUMO"));
  merges.push(`A${rows.length}:G${rows.length}`);
  rows.push(header([
    "Receita com produtos",
    "Receita com mensalidades",
    "Receita com serviços",
    "Atendimentos concluídos",
    "Faturamento bruto",
    "Total de despesas",
    "Faturamento líquido"
  ]));
  rows.push(row([
    { value: report.productsPeriod, style: 6 },
    { value: report.subscriptionsPeriod || 0, style: 6 },
    { value: report.servicesPeriod, style: 6 },
    { value: report.completedAppointments.length, style: 5 },
    { value: report.grossPeriod, style: 7 },
    { value: report.expensesPeriod, style: 12 },
    { value: report.netPeriod, style: report.netPeriod >= 0 ? 7 : 12 }
  ], 24));

  const files = [
    { name: "[Content_Types].xml", content: buildContentTypesXml() },
    { name: "_rels/.rels", content: buildRootRelsXml() },
    { name: "xl/workbook.xml", content: buildWorkbookXml() },
    { name: "xl/_rels/workbook.xml.rels", content: buildWorkbookRelsXml() },
    { name: "xl/styles.xml", content: buildStylesXml() },
    { name: "xl/worksheets/sheet1.xml", content: buildSheetXml(rows, merges) }
  ];

  const bytes = createZip(files);
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  const period = `${report.startDate || "inicio"}-${report.endDate || "fim"}`;
  const filename = `agensync-relatorio-${sanitizeFilePart(period)}.xlsx`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return filename;
}
