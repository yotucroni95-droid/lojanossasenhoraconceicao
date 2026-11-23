import PDFKit; import AppKit
// uso: folha.swift arquivo.pdf prefixo porFolha
let a = CommandLine.arguments; let d = PDFDocument(url: URL(fileURLWithPath: a[1]))!
let per = Int(a[3])!, cols = 4
let lista: [Int] = a.count > 4 ? a[4].split(separator: ",").map { Int($0)! - 1 } : Array(0..<d.pageCount), cw = 420.0, ch = 320.0
var i = 0, sheet = 1
while i < lista.count {
  let n = min(per, lista.count - i), rows = (n + cols - 1) / cols
  let img = NSImage(size: NSSize(width: cw*Double(cols), height: ch*Double(rows)))
  img.lockFocus(); NSColor.white.setFill(); NSRect(x:0,y:0,width:cw*Double(cols),height:ch*Double(rows)).fill()
  for k in 0..<n { let p = d.page(at: lista[i+k])!; let b = p.bounds(for: .mediaBox)
    let s = min((cw-10)/b.width, (ch-30)/b.height); let col = k % cols, row = k / cols
    let x = Double(col)*cw + 5, y = ch*Double(rows - row - 1) + 5
    NSGraphicsContext.current!.saveGraphicsState()
    let t = NSAffineTransform(); t.translateX(by: x, yBy: y); t.scale(by: s); t.concat()
    p.draw(with: .mediaBox, to: NSGraphicsContext.current!.cgContext)
    NSGraphicsContext.current!.restoreGraphicsState()
    ("p\(lista[i+k]+1)" as NSString).draw(at: NSPoint(x: x, y: y + ch - 28), withAttributes: [.font: NSFont.boldSystemFont(ofSize: 20), .foregroundColor: NSColor.red])
  }
  img.unlockFocus()
  let rep = NSBitmapImageRep(data: img.tiffRepresentation!)!
  try! rep.representation(using: .jpeg, properties: [.compressionFactor: 0.6])!.write(to: URL(fileURLWithPath: "\(a[2])-\(sheet).jpg"))
  i += n; sheet += 1 }
