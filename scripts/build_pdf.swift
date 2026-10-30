import Foundation
import AppKit
import CoreText
import PDFKit

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let raw = try Data(contentsOf: root.appendingPathComponent("errors.json"))
let database = try JSONSerialization.jsonObject(with: raw) as! [String:Any]
let rows = database["errors"] as! [[String:Any]]
let width:CGFloat = 420, height:CGFloat = 840, margin:CGFloat = 26
let usable = width - 2*margin
let blue = NSColor(calibratedRed:0.08, green:0.25, blue:0.34, alpha:1)
func str(_ r:[String:Any],_ k:String)->String { r[k] as? String ?? "" }
func array(_ r:[String:Any],_ k:String)->[String] { r[k] as? [String] ?? [] }
func attributed(_ text:String, size:CGFloat, bold:Bool=false, color:NSColor = .black) -> NSAttributedString {
 let paragraph = NSMutableParagraphStyle(); paragraph.lineSpacing=3; paragraph.paragraphSpacing=5
 return NSAttributedString(string:text,attributes:[.font: NSFont(name:bold ? "Arial-BoldMT" : "ArialMT",size:size)!,.foregroundColor:color,.paragraphStyle:paragraph])
}
func textHeight(_ a:NSAttributedString)->CGFloat {
 let fs=CTFramesetterCreateWithAttributedString(a)
 return ceil(CTFramesetterSuggestFrameSizeWithConstraints(fs,CFRange(location:0,length:0),nil,CGSize(width:usable,height:10000),nil).height)+3
}
struct Block {let text:String; let size:CGFloat; let bold:Bool; let color:NSColor}
func b(_ text:String,_ size:CGFloat=14,_ bold:Bool=false,_ color:NSColor = .black)->Block {Block(text:text,size:size,bold:bold,color:color)}
var rect=CGRect(x:0,y:0,width:width,height:height)
let intermediate=root.appendingPathComponent("research/pdf_review/guide_layout.pdf")
guard let context=CGContext(intermediate as CFURL,mediaBox:&rect,nil) else {fatalError("Не удалось создать PDF")}
var pageCount=0
var sourceRects:[(Int,CGRect,String)]=[]
func drawPage(_ blocks:[Block], footer:String, sourceURLs:[String]=[]) {
 context.beginPDFPage(nil); pageCount += 1
 var top:CGFloat=margin
 var sourceIndex=0
 for block in blocks {
  let a=attributed(block.text,size:block.size,bold:block.bold,color:block.color)
  let h=textHeight(a)
  guard top+h < height-35 else {fatalError("Переполнение страницы \(pageCount): \(top+h)")}
  let frameRect=CGRect(x:margin,y:height-top-h,width:usable,height:h)
  let frame=CTFramesetterCreateFrame(CTFramesetterCreateWithAttributedString(a),CFRange(location:0,length:0),CGPath(rect:frameRect,transform:nil),nil)
  let visible=CTFrameGetVisibleStringRange(frame)
  guard visible.length == a.length else {fatalError("Обрезка текста \(pageCount)")}
  CTFrameDraw(frame,context)
  if block.text.hasPrefix("Источник:"), sourceIndex < sourceURLs.count {sourceRects.append((pageCount-1,frameRect,sourceURLs[sourceIndex]));sourceIndex += 1}
  top += h+4
 }
 let f=attributed(footer,size:9,color:.darkGray)
 let fr=CTFramesetterCreateFrame(CTFramesetterCreateWithAttributedString(f),CFRange(location:0,length:0),CGPath(rect:CGRect(x:margin,y:14,width:usable,height:18),transform:nil),nil)
 CTFrameDraw(fr,context); context.endPDFPage()
}
let cats=rows.reduce(into:[String]()){acc,r in let c=str(r,"category"); if !acc.contains(c){acc.append(c)}}
let ordered=cats.flatMap{cat in rows.filter{str($0,"category")==cat}}
var categoryPage:[String:Int]=[:]
for (i,r) in ordered.enumerated(){let c=str(r,"category"); if categoryPage[c]==nil{categoryPage[c]=i+2}}
drawPage([
 b("Справочник врача",27,true),b("Проблемы медицинских систем на 1С",22,true),
 b("Рабочая версия • 30 октября 2026 года",12,false,blue),
 b("\(rows.count) коротких карточек для поиска по сообщению, коду, двум-трём словам или выполняемой операции. Текст можно выделять и искать средствами просмотра PDF."),
 b("Сначала сверяйте ситуацию и версию",17,true),
 b("Конфигурация больницы в Иванове неизвестна. Ни одна карточка не проверена на её рабочих местах. Материалы 1C-MR, ЕЦП.МИС, СФР и МедФлекс имеют отдельные границы применимости."),
 b("Безопасный порядок",17,true),
 b("Проверьте нужного пациента и состояние исходной записи. Не повторяйте назначения, выписку, подпись и отправку вслепую. Настройки, права, обновления и сертификаты проверяет местная поддержка. На личный телефон не переносите данные пациентов."),
 b("Что означают отметки",17,true),
 b("Подтверждено — правило или исправление описано источником. Подтверждено пользователем — есть сообщение об успехе. Возможно — ограниченные основания для проверки. Не решено — надёжного решения нет. Местная проверка нужна всегда.",13),
 b("СЭМД — структурированный электронный медицинский документ; ЭМК — электронная медицинская карта; РЭМД — реестр электронных медицинских документов; ШМД — шаблон; ТАП — талон амбулаторного пациента.",11),
 b("Это рабочий результат исследования открытых источников, а не полное покрытие всех ошибок. При сбое действуйте по принятому в больнице порядку. Безопасные шаги проверки и эскалации составлены редакционно.",11)
],footer:"Справочник врача • Поиск доступен по всему документу")
var toc=[b("Оглавление",25,true),b("Нажмите название раздела или используйте закладки PDF. В карточках доступны ссылки на первоисточники.",13)]
for c in cats {toc.append(b("\(c)  ·  \(categoryPage[c]!+1)",14,true,blue))}
drawPage(toc,footer:"Справочник врача • Оглавление")
var layout:[[String:Any]]=[]
for r in ordered {
 let id=str(r,"id")
 var blocks:[Block]=[]
 for base:CGFloat in [14,13,12.5] {
  let code=str(r,"error_code")
  let exact=str(r,"original_error_text")
  let search=([code,exact].filter{ !$0.isEmpty }+array(r,"alternative_search_phrases")).reduce(into:[String]()){ acc, value in if !acc.contains(value) { acc.append(value) } }.joined(separator:"; ")
  blocks=[b(str(r,"category"),11,true,blue),b("№ \(id) — \(str(r,"title"))",20,true),b("Где возникает: "+str(r,"workflow"),base),b("Текст ошибки / Что искать: "+search,base-1),b("Почему: "+str(r,"cause"),base),b("Что делать",base,true)]
  for (i,step) in array(r,"physician_instructions").enumerated(){blocks.append(b("\(i+1). \(step)",base))}
  blocks += [b("Если не помогло: "+str(r,"escalation_instructions"),base-1),b("Проверено: "+array(r,"evidence_status").joined(separator:"; ")+". "+str(r,"evidence_note"),10.5),b("Конфигурация и версия: "+str(r,"software_product")+"; "+str(r,"software_version")+". Источник: "+str(r,"source_date")+". Проверка: 30.10.2026.",10.5)]
  for (i,_) in array(r,"source_urls").enumerated() { blocks.append(b("Источник: \(i+1). Открыть первоисточник. "+(i==0 ? str(r,"source_locator") : ""),10.5,false,blue)) }
  let total=blocks.reduce(CGFloat(0)){$0+textHeight(attributed($1.text,size:$1.size,bold:$1.bold,color:$1.color))+4}
  if total < height-2*margin-20 {layout.append(["id":id,"body_size":base,"height":total]);break}
  if base==12.5 {fatalError("Карточка не помещается: \(id)")}
 }
 drawPage(blocks,footer:"№ \(id) • Требует местной проверки • \(pageCount+1)",sourceURLs:array(r,"source_urls"))
}
context.closePDF()
guard let document=PDFDocument(url:intermediate) else {fatalError("Не удалось открыть созданный PDF")}
let outline=PDFOutline()
for c in cats {
 let cat=PDFOutline();cat.label=c;cat.destination=PDFDestination(page:document.page(at:categoryPage[c]!)!,at:CGPoint(x:0,y:height));outline.insertChild(cat,at:outline.numberOfChildren)
 for (i,r) in ordered.enumerated() where str(r,"category")==c {
  let item=PDFOutline();item.label="№ \(str(r,"id")) — \(str(r,"title"))";item.destination=PDFDestination(page:document.page(at:i+2)!,at:CGPoint(x:0,y:height));cat.insertChild(item,at:cat.numberOfChildren)
 }
}
document.outlineRoot=outline
for (idx,rect,url) in sourceRects {
 let link=PDFAnnotation(bounds:rect,forType:.link,withProperties:nil);link.url=URL(string:url);link.border=PDFBorder();link.border?.lineWidth=0;document.page(at:idx)!.addAnnotation(link)
}
var y=margin
for block in toc {
 let h=textHeight(attributed(block.text,size:block.size,bold:block.bold,color:block.color))
 if let c=cats.first(where:{block.text.hasPrefix($0+"  ·")}) {
  let link=PDFAnnotation(bounds:CGRect(x:margin,y:height-y-h,width:usable,height:h),forType:.link,withProperties:nil)
  link.destination=PDFDestination(page:document.page(at:categoryPage[c]!)!,at:CGPoint(x:0,y:height));link.border=PDFBorder();link.border?.lineWidth=0;document.page(at:1)!.addAnnotation(link)
 }
 y += h+4
}
document.documentAttributes=[PDFDocumentAttribute.titleAttribute:"Справочник врача по проблемам медицинских систем на 1С",PDFDocumentAttribute.authorAttribute:"Исследовательский проект medical-1c-guide"]
let output=root.appendingPathComponent("doctor_guide.pdf")
guard document.write(to:output) else {fatalError("Не удалось сохранить итоговый PDF")}
let check=PDFDocument(url:output)!
let text=(0..<check.pageCount).map{check.page(at:$0)!.string ?? ""}.joined(separator:"\n")
func normalized(_ text:String)->String {text.replacingOccurrences(of:"\\s+",with:" ",options:.regularExpression)}
let searchable=normalized(text)
for r in rows {guard searchable.contains("№ "+str(r,"id")) && searchable.contains(normalized(str(r,"title"))) else {fatalError("Не извлечён текст карточки "+str(r,"id"))}}
try text.write(to:root.appendingPathComponent("research/pdf_review/extracted.txt"),atomically:true,encoding:.utf8)
try JSONSerialization.data(withJSONObject:layout,options:[.prettyPrinted,.sortedKeys]).write(to:root.appendingPathComponent("research/pdf_review/layout.json"))
for i in 0..<check.pageCount {
 let im=check.page(at:i)!.thumbnail(of:CGSize(width:840,height:1680),for:.mediaBox)
 let rep=NSBitmapImageRep(data:im.tiffRepresentation!)!
 try rep.representation(using:.png,properties:[:])!.write(to:root.appendingPathComponent(String(format:"research/pdf_review/page-%03d.png",i+1)))
}
print("PDF создан; страниц: \(check.pageCount). Текст всех карточек извлечён; страницы отрисованы для проверки.")
