import ExcelJS from 'exceljs';

const source='C:/Users/PC/Downloads/FORM QUẢN LÝ TSCD.xlsx';
const output='C:/Users/PC/Downloads/FORM QUẢN LÝ TSCD - Template nhập.xlsx';
const wb=new ExcelJS.Workbook(); await wb.xlsx.readFile(source);
const clone=value=>value===undefined?undefined:structuredClone(value);
const original=wb.worksheets.map(s=>({name:s.name,rows:s.rowCount,cols:s.columnCount,merges:[...s.model.merges],widths:s.columns.map(c=>c.width),heights:Array.from({length:s.rowCount},(_,i)=>s.getRow(i+1).height),styles:new Map()}));
for(const meta of original){const s=wb.getWorksheet(meta.name);for(let r=1;r<=meta.rows;r++)for(let c=1;c<=meta.cols;c++){const style=s.getCell(r,c).style;if(style&&Object.keys(style).length)meta.styles.set(`${r}:${c}`,JSON.stringify(style));}}
let frozen=0,cleared=0;
for(const sheet of wb.worksheets)sheet.eachRow({includeEmpty:false},row=>row.eachCell({includeEmpty:false},cell=>{
  const value=cell.value;
  if(value&&typeof value==='object'&&!Array.isArray(value)&&('formula'in value||'sharedFormula'in value)){
    const result=value.result;
    const isError=(result&&typeof result==='object'&&'error'in result)||(typeof result==='string'&&result.startsWith('#'));
    if(result===undefined||result===null||isError){cell.value=null;cleared++;}else cell.value=result;
    frozen++;
  }else if((value&&typeof value==='object'&&'error'in value)||(typeof value==='string'&&value.startsWith('#'))){cell.value=null;cleared++;}
}));
const detail=wb.getWorksheet('TSCĐ (2)');
detail.getCell(9,19).value='Tình trạng';
let normalizedStatus=0;
for(let r=10;r<=1762;r++){const cell=detail.getCell(r,19);const value=String(cell.value??'').trim().toLocaleLowerCase('vi');if(value==='bình thường'){cell.value='1 - Còn tốt';normalizedStatus++;}else if(value==='hư hỏng'){cell.value='2 - Hỏng hóc';normalizedStatus++;}}
const definitions=[
 {header:'Mã vật tư',width:22,value:()=>null},
 {header:'Mã mẫu vật tư',width:22,value:()=>null},
 {header:'Tên mẫu vật tư',width:34,value:()=>null},
 {header:'Mã nhóm vật tư',width:22,value:()=>null},
 {header:'Mã đơn vị quản lý',width:22,value:r=>detail.getCell(r,18).value??null},
 {header:'Tên đơn vị quản lý',width:30,value:()=>null},
];
const start=23;
for(let i=0;i<definitions.length;i++){const col=start+i,d=definitions[i];detail.getColumn(col).width=d.width;for(let r=1;r<=detail.rowCount;r++){const cell=detail.getCell(r,col),styleSource=detail.getCell(r,22);cell.style=clone(styleSource.style);if(styleSource.numFmt)cell.numFmt=styleSource.numFmt;if(r===9)cell.value=d.header;else if(r>=10&&r<=1762)cell.value=d.value(r);else cell.value=null;}}
const cfg=wb.addWorksheet('Cấu hình mã liên kết');cfg.columns=[{width:25},{width:34},{width:22},{width:28},{width:60}];cfg.mergeCells('A1:E1');cfg.getCell('A1').value='CẤU HÌNH MÃ LIÊN KẾT NGOÀI';cfg.getCell('A1').font=clone(detail.getCell(4,5).font);cfg.getCell('A1').alignment={horizontal:'center',vertical:'middle'};cfg.getRow(1).height=30;
['Sheet dữ liệu','Cột dữ liệu','Phạm vi lưu','Nhãn mã liên kết','Ghi chú'].forEach((v,i)=>{const c=cfg.getCell(3,i+1);c.value=v;c.style=clone(detail.getCell(9,22).style);c.alignment={horizontal:'center',vertical:'middle',wrapText:true};});cfg.getRow(3).height=32;
[['TSCĐ (2)','Số thẻ','Vật tư','Số thẻ','Mã riêng của từng tài sản.'],['TSCĐ (2)','Mã số TSCĐ','Vật tư','Mã số TSCĐ','Mã riêng của từng tài sản.']].forEach((row,ri)=>row.forEach((v,ci)=>{const c=cfg.getCell(ri+4,ci+1);c.value=v;c.style=clone(detail.getCell(10+ri,22).style);c.alignment={vertical:'middle',wrapText:true};}));for(let r=4;r<=5;r++)cfg.getCell(r,3).dataValidation={type:'list',allowBlank:false,formulae:['"Vật tư,Mẫu vật tư"']};cfg.autoFilter={from:{row:3,column:1},to:{row:3,column:5}};cfg.views=[{state:'frozen',ySplit:3}];
const guide=wb.addWorksheet('Hướng dẫn');guide.columns=[{width:28},{width:105}];guide.mergeCells('A1:B1');guide.getCell('A1').value='HƯỚNG DẪN SỬ DỤNG BIỂU MẪU NHẬP';guide.getCell('A1').font=clone(detail.getCell(4,5).font);guide.getCell('A1').alignment={horizontal:'center',vertical:'middle'};guide.getRow(1).height=30;
const notes=[['Mã vật tư','Mã quản lý riêng của phần mềm; không dùng Số thẻ hoặc Mã số TSCĐ thay thế.'],['Mã mẫu và nhóm','Điền Mã mẫu vật tư, Tên mẫu vật tư và Mã nhóm vật tư theo danh mục phần mềm.'],['Mã liên kết ngoài','Khai báo từng cột trong sheet Cấu hình mã liên kết; chọn phạm vi Vật tư hoặc Mẫu vật tư.'],['Số lượng','Tài sản có mã riêng nên để 1; không gộp nhiều tài sản có mã liên kết cấp vật tư vào cùng dòng.'],['Tình trạng','Đã chuẩn hóa Bình thường thành 1 - Còn tốt và Hư Hỏng thành 2 - Hỏng hóc.'],['Đơn vị quản lý','Mã đơn vị quản lý lấy từ cột PX/PB quản lý của file gốc; cần đối chiếu danh mục phần mềm.'],['Cột tham khảo','Hao mòn, giá trị còn lại, khấu hao, nguồn vốn, biên bản và thanh lý được giữ làm tham khảo.'],['Công thức','Công thức được đổi thành giá trị tính sẵn; ô lỗi hoặc không có kết quả được để trống.']];
notes.forEach((row,ri)=>row.forEach((v,ci)=>{const c=guide.getCell(ri+3,ci+1);c.value=v;c.style=clone(detail.getCell(10+ri,22).style);c.alignment={vertical:'middle',wrapText:true};}));notes.forEach((_,i)=>guide.getRow(i+3).height=34);guide.views=[{state:'frozen',ySplit:2}];
await wb.xlsx.writeFile(output);
const check=new ExcelJS.Workbook();await check.xlsx.readFile(output);const styleReport=[];
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
for(const meta of original){const s=check.getWorksheet(meta.name),bad=[];for(const [address,serialized] of meta.styles){const [r,c]=address.split(':').map(Number);if(JSON.stringify(stable(s.getCell(r,c).style))!==JSON.stringify(stable(JSON.parse(serialized))))bad.push(address);}for(let i=0;i<meta.cols;i++)if(s.getColumn(i+1).width!==meta.widths[i])bad.push(`width:${i+1}`);for(let i=0;i<meta.rows;i++)if(s.getRow(i+1).height!==meta.heights[i])bad.push(`height:${i+1}`);if(JSON.stringify([...s.model.merges])!==JSON.stringify(meta.merges))bad.push('merges');styleReport.push({sheet:meta.name,styles:meta.styles.size,mismatches:bad.length,examples:bad.slice(0,8)});}
console.log(JSON.stringify({output,sheets:check.worksheets.map(s=>s.name),newColumns:definitions.map(d=>d.header),normalizedStatus,frozenFormulas:frozen,clearedErrors:cleared,styleReport},null,2));
