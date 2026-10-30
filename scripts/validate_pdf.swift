import Foundation
import PDFKit
import CryptoKit
let data=try Data(contentsOf:URL(fileURLWithPath:"errors.json"))
let raw=try JSONSerialization.jsonObject(with:data) as! [String:Any]
let rows=raw["errors"] as! [[String:Any]]
let doc=PDFDocument(url:URL(fileURLWithPath:"doctor_guide.pdf"))!
func norm(_ s:String)->String{s.replacingOccurrences(of:"\\s+",with:"",options:.regularExpression)}
let pages=(0..<doc.pageCount).map{norm(doc.page(at:$0)!.string ?? "")}
for r in rows {
 let id=r["id"] as! String
 guard let i=pages.firstIndex(where:{$0.contains("№"+id+"—")}) else {fatalError("Нет карточки "+id)}
 let required=[r["title"] as! String,r["cause"] as! String,r["escalation_instructions"] as! String]+(r["physician_instructions"] as! [String])
 for text in required {guard pages[i].contains(norm(text)) else {fatalError("Не совпадает текст карточки "+id+": "+text)}}
 if let code=r["error_code"] as? String {guard pages[i].contains(code) else {fatalError("Нет кода "+code)}}
 let expected=r["source_urls"] as! [String]
 let actual=doc.page(at:i)!.annotations.compactMap{$0.url?.absoluteString}
 guard Set(expected).isSubset(of:Set(actual)) else {fatalError("Не совпали ссылки "+id)}
}
guard doc.pageCount==rows.count+2 else {fatalError("Не совпало число страниц")}
guard let outline=doc.outlineRoot else {fatalError("Нет закладок")}
let count=(0..<outline.numberOfChildren).reduce(0){$0+outline.child(at:$1)!.numberOfChildren}
guard count==rows.count else {fatalError("Не совпало число закладок")}
let hash=SHA256.hash(data:data).map{String(format:"%02x",$0)}.joined()
let result:[String:Any] = ["страниц":doc.pageCount,"карточек":rows.count,"закладок_карточек":count,"ссылок_оглавления":doc.page(at:1)!.annotations.count,"исходный_json_sha256":hash,"текст_и_ссылки":"Проверены для каждой карточки","визуальная_проверка":"См. отдельный журнал визуального просмотра research/codes-v5/visual_review.md; этот скрипт проверяет текст и структуру, а не внешний вид."]
try JSONSerialization.data(withJSONObject:result,options:[.prettyPrinted,.sortedKeys]).write(to:URL(fileURLWithPath:"research/pdf_review/verification.json"))
print("PDF: тексты, коды, ссылки и закладки всех карточек проверены.")
